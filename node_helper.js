/**
 * MMM-GoogleSheetToTable — Node Helper
 *
 * Fetches a public Google Sheet as CSV, parses date-blocked rows,
 * searches for configured names, and sends structured results to the frontend.
 */

const http = require("http");
const https = require("https");
const NodeHelper = require("node_helper");
const Log = require("logger");

/**
 * Minimal HTTPS/HTTP GET with redirect following.
 * @param {string} url
 * @param {number} [redirects=0]
 * @returns {Promise<string>}
 */
function httpGet(url, redirects) {
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    mod.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (redirects >= 5) return reject(new Error("Too many redirects"));
        return httpGet(res.headers.location, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) {
        return reject(new Error("HTTP " + res.statusCode));
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

/**
 * Parse a CSV string into a 2D array of strings.
 * Handles quoted fields with embedded commas and escaped quotes.
 * @param {string} text
 * @returns {string[][]}
 */
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const row = [];
    while (i < len) {
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = "";
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i];
            i++;
          }
        }
        row.push(field);
        // Skip comma or newline after quoted field
        if (i < len && text[i] === ',') {
          i++;
        } else if (i < len && (text[i] === '\r' || text[i] === '\n')) {
          if (text[i] === '\r' && i + 1 < len && text[i + 1] === '\n') i++;
          i++;
          break;
        }
      } else if (text[i] === ',' ) {
        row.push("");
        i++;
      } else if (text[i] === '\r' || text[i] === '\n') {
        row.push("");
        if (text[i] === '\r' && i + 1 < len && text[i + 1] === '\n') i++;
        i++;
        break;
      } else {
        // Unquoted field
        let field = "";
        while (i < len && text[i] !== ',' && text[i] !== '\r' && text[i] !== '\n') {
          field += text[i];
          i++;
        }
        row.push(field);
        if (i < len && text[i] === ',') {
          i++;
        } else if (i < len && (text[i] === '\r' || text[i] === '\n')) {
          if (text[i] === '\r' && i + 1 < len && text[i + 1] === '\n') i++;
          i++;
          break;
        }
      }
    }
    if (row.length > 0 && !(row.length === 1 && row[0] === "")) {
      rows.push(row);
    }
  }
  return rows;
}

/**
 * Convert spreadsheet column letter (A, B, ..., Z) to 0-based index.
 * @param {string} letter
 * @returns {number}
 */
function colLetterToIndex(letter) {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

/**
 * Parse a date string like "April 4th", "May 2nd", "June 13th" into a Date object.
 * Infers the year: uses the current year, but if the date is more than 6 months in the past,
 * assumes next year.
 * Returns null if parsing fails.
 * @param {string} dateStr
 * @returns {Date|null}
 */
function parseSheetDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;

  // Clean up: remove ordinal suffixes (st, nd, rd, th)
  const cleaned = dateStr.trim().replace(/(\d+)(st|nd|rd|th)/gi, "$1");

  // Also handle multi-line date cells — take just the first line
  const firstLine = cleaned.split("\n")[0].trim();

  // Try parsing "Month Day" format
  const match = firstLine.match(/^([A-Za-z]+)\s+(\d+)/);
  if (!match) return null;

  const monthStr = match[1];
  const day = parseInt(match[2], 10);

  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };
  const monthNum = months[monthStr.toLowerCase()];
  if (monthNum === undefined) return null;

  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, monthNum, day);

  // If more than 6 months in the past, assume next year
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  if (candidate < sixMonthsAgo) {
    candidate.setFullYear(year + 1);
  }

  return candidate;
}

/**
 * Format a Date as a short display string like "Apr 4" or "May 23".
 * @param {Date} date
 * @returns {string}
 */
function formatDateShort(date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[date.getMonth()] + " " + date.getDate();
}

module.exports = NodeHelper.create({
  start: function () {
    Log.log("Starting node helper for: " + this.name);
    this.timer = null;
  },

  stop: function () {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "FETCH_SHEET") {
      this.config = payload;
      this.fetchSheet();
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => {
        this.fetchSheet();
      }, this.config.updateInterval || 4 * 60 * 60 * 1000);
    }
  },

  /**
   * Main pipeline: fetch CSV → parse → search → send results.
   */
  fetchSheet: async function () {
    const sheetId = this.config.sheetId;
    if (!sheetId) {
      Log.error("MMM-GoogleSheetToTable: No sheetId configured");
      this.sendSocketNotification("SHEET_ERROR", { error: "No sheetId configured" });
      return;
    }

    const csvUrl = "https://docs.google.com/spreadsheets/d/" + sheetId + "/gviz/tq?tqx=out:csv";

    try {
      Log.log("MMM-GoogleSheetToTable: Fetching sheet...");
      const csvText = await httpGet(csvUrl);
      const rows = parseCSV(csvText);

      if (rows.length < 2) {
        this.sendSocketNotification("SHEET_ERROR", { error: "Sheet has no data rows" });
        return;
      }

      // Build column index map from config
      const columnMap = {}; // index -> group name
      const columns = this.config.columns || {};
      for (const letter of Object.keys(columns)) {
        columnMap[colLetterToIndex(letter)] = columns[letter];
      }

      const names = (this.config.names || []).map((n) => n.toLowerCase());
      const showPastDates = this.config.showPastDates !== undefined ? this.config.showPastDates : false;
      const maxEntries = this.config.maxEntries || 6;

      const dateColIdx = colLetterToIndex(this.config.dateColumn || "A");

      // Walk rows: group into date blocks and search for names
      const results = [];
      let currentDateStr = null;
      let currentDate = null;

      // Skip header row (index 0)
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const cellA = (row[dateColIdx] || "").trim();

        // Non-empty column A starts a new date block
        if (cellA) {
          const parsed = parseSheetDate(cellA);
          if (parsed) {
            currentDateStr = cellA;
            currentDate = parsed;
          } else {
            // Not a parseable date — could be a sub-label like "Starts after 8:45 minyan"
            // Keep the current date block
          }
        }

        if (!currentDate) continue;

        // Search configured columns for configured names
        for (const colIdx of Object.keys(columnMap)) {
          const idx = parseInt(colIdx, 10);
          const cellValue = (row[idx] || "").trim().toLowerCase();
          if (!cellValue) continue;

          for (const name of names) {
            if (cellValue === name) {
              results.push({
                date: currentDate,
                dateStr: formatDateShort(currentDate),
                rawDateStr: currentDateStr,
                name: row[idx].trim(),
                group: columnMap[idx]
              });
            }
          }
        }
      }

      // Filter past dates if configured
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filtered = showPastDates
        ? results
        : results.filter((r) => r.date >= today);

      // Sort by date ascending, then name ascending
      filtered.sort((a, b) => {
        const dateDiff = a.date.getTime() - b.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.name.localeCompare(b.name);
      });

      // Truncate and strip Date objects (not serializable)
      const entries = filtered.slice(0, maxEntries).map((r) => ({
        dateStr: r.dateStr,
        name: r.name,
        group: r.group
      }));

      Log.log("MMM-GoogleSheetToTable: Found " + entries.length + " entries");
      this.sendSocketNotification("SHEET_DATA", {
        entries: entries,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      Log.error("MMM-GoogleSheetToTable: Fetch failed: " + err.message);
      this.sendSocketNotification("SHEET_ERROR", { error: err.message });
    }
  }
});
