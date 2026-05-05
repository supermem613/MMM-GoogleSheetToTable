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
const { buildEntries, parseCSV } = require("./sheet_utils");

/**
 * Minimal HTTPS/HTTP GET with redirect following.
 *
 * @param {string} url Absolute http(s) URL to fetch.
 * @param {number} [redirects=0] Internal redirect counter; callers should omit.
 * @returns {Promise<string>} Resolves with the response body as a UTF-8 string.
 */
function httpGet(url, redirects) {
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    mod
      .get(url, (res) => {
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          if (redirects >= 5) return reject(new Error("Too many redirects"));
          return httpGet(res.headers.location, redirects + 1)
            .then(resolve)
            .catch(reject);
        }
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

module.exports = NodeHelper.create({
  start: function () {
    Log.log(`Starting node helper for: ${this.name}`);
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
      this.sendSocketNotification("SHEET_ERROR", {
        error: "No sheetId configured"
      });
      return;
    }

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

    try {
      Log.log("MMM-GoogleSheetToTable: Fetching sheet...");
      const csvText = await httpGet(csvUrl);
      const rows = parseCSV(csvText);

      if (rows.length < 2) {
        this.sendSocketNotification("SHEET_ERROR", {
          error: "Sheet has no data rows"
        });
        return;
      }

      const entries = buildEntries(rows, this.config);
      Log.log(`MMM-GoogleSheetToTable: Found ${entries.length} entries`);
      this.sendSocketNotification("SHEET_DATA", {
        entries: entries,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      Log.error(`MMM-GoogleSheetToTable: Fetch failed: ${err.message}`);
      this.sendSocketNotification("SHEET_ERROR", { error: err.message });
    }
  }
});
