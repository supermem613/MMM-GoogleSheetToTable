/**
 * Parse a CSV string into a 2D array of strings.
 * Handles quoted fields with embedded commas and escaped quotes.
 *
 * @param {string} text Raw CSV text.
 * @returns {string[][]} Rows of string fields; empty rows are dropped.
 */
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const row = [];
    while (i < len) {
      if (text[i] === '"') {
        i++;
        let field = "";
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            field += text[i];
            i++;
          }
        }
        row.push(field);
        if (i < len && text[i] === ",") {
          i++;
        } else if (i < len && (text[i] === "\r" || text[i] === "\n")) {
          if (text[i] === "\r" && i + 1 < len && text[i + 1] === "\n") i++;
          i++;
          break;
        }
      } else if (text[i] === ",") {
        row.push("");
        i++;
      } else if (text[i] === "\r" || text[i] === "\n") {
        row.push("");
        if (text[i] === "\r" && i + 1 < len && text[i + 1] === "\n") i++;
        i++;
        break;
      } else {
        let field = "";
        while (
          i < len &&
          text[i] !== "," &&
          text[i] !== "\r" &&
          text[i] !== "\n"
        ) {
          field += text[i];
          i++;
        }
        row.push(field);
        if (i < len && text[i] === ",") {
          i++;
        } else if (i < len && (text[i] === "\r" || text[i] === "\n")) {
          if (text[i] === "\r" && i + 1 < len && text[i + 1] === "\n") i++;
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
 *
 * @param {string} letter Single column letter A–Z (case-insensitive).
 * @returns {number} Zero-based column index.
 */
function colLetterToIndex(letter) {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

/**
 * Parse a date string like "April 4th", "May 2nd", "June 13th" into a Date object.
 * Infers the year: uses the current year, but if the date is more than 6 months in the past,
 * assumes next year.
 * Returns null if parsing fails.
 *
 * @param {string} dateStr Cell value such as "April 4th" or "May 2nd".
 * @returns {Date|null} Parsed Date with inferred year, or null if unparseable.
 */
function parseSheetDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;

  const cleaned = dateStr.trim().replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  const firstLine = cleaned.split("\n")[0].trim();
  const match = firstLine.match(/^([A-Za-z]+)\s+(\d+)/);
  if (!match) return null;

  const monthStr = match[1];
  const day = parseInt(match[2], 10);
  const months = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11
  };
  const monthNum = months[monthStr.toLowerCase()];
  if (monthNum === undefined) return null;

  const now = new Date();
  const candidate = new Date(now.getFullYear(), monthNum, day);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  if (candidate < sixMonthsAgo) {
    candidate.setFullYear(now.getFullYear() + 1);
  }

  return candidate;
}

/**
 * Format a Date as a short display string like "Apr 4" or "May 23".
 *
 * @param {Date} date Date to format.
 * @returns {string} Short display string, e.g. "Apr 4".
 */
function formatDateShort(date) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Detect note-like labels that should stay within an active date block.
 *
 * @param {string} value Date-column cell value.
 * @returns {boolean} True when the value looks like an inline annotation.
 */
function isInlineDateAnnotation(value) {
  return /[:;]/.test(value);
}

/**
 * Build the frontend entry list from parsed sheet rows and module config.
 *
 * @param {string[][]} rows Parsed sheet rows, including the header row.
 * @param {object} config Module config.
 * @returns {{dateStr: string, name: string, group: string}[]} Display entries.
 */
function buildEntries(rows, config) {
  const columnMap = {};
  const columns = config.columns || {};
  for (const letter of Object.keys(columns)) {
    columnMap[colLetterToIndex(letter)] = columns[letter];
  }

  const names = (config.names || []).map((name) => name.toLowerCase());
  const displayNames = {};
  for (const [name, displayName] of Object.entries(config.displayNames || {})) {
    displayNames[name.trim().toLowerCase()] = displayName;
  }

  const showPastDates =
    config.showPastDates !== undefined ? config.showPastDates : false;
  const maxEntries = config.maxEntries || 6;
  const includeSectionHeaders = config.includeSectionHeaders === true;
  const maxSectionHeaders =
    config.maxSectionHeaders !== undefined ? config.maxSectionHeaders : 2;
  const dateColIdx = colLetterToIndex(config.dateColumn || "A");

  const results = [];
  let currentDateStr = null;
  let currentDate = null;
  let currentSectionHeader = null;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const dateCell = (row[dateColIdx] || "").trim();

    if (dateCell) {
      const parsedDate = parseSheetDate(dateCell);
      if (parsedDate) {
        currentDateStr = dateCell;
        currentDate = parsedDate;
        currentSectionHeader = null;
      } else if (!(currentDate && isInlineDateAnnotation(dateCell))) {
        currentDateStr = null;
        currentDate = null;
        currentSectionHeader = dateCell;
      }
    }

    if (!currentDate && !(includeSectionHeaders && currentSectionHeader)) {
      continue;
    }

    for (const colIdx of Object.keys(columnMap)) {
      const idx = parseInt(colIdx, 10);
      const cellValue = (row[idx] || "").trim().toLowerCase();
      if (!cellValue) continue;

      for (const name of names) {
        if (cellValue !== name) continue;

        const matchedName = row[idx].trim();
        const displayName = Object.prototype.hasOwnProperty.call(
          displayNames,
          cellValue
        )
          ? displayNames[cellValue]
          : matchedName;

        results.push({
          date: currentDate,
          dateStr: currentDate
            ? formatDateShort(currentDate)
            : currentSectionHeader,
          rawDateStr: currentDateStr,
          name: matchedName,
          displayName: displayName,
          group: columnMap[idx],
          isSectionHeader: !currentDate
        });
      }
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const filtered = results.filter((result) => {
    if (result.isSectionHeader) return true;
    return showPastDates || result.date >= today;
  });

  filtered.sort((a, b) => {
    if (a.isSectionHeader && !b.isSectionHeader) return 1;
    if (!a.isSectionHeader && b.isSectionHeader) return -1;
    if (a.isSectionHeader && b.isSectionHeader) return 0;
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.name.localeCompare(b.name);
  });

  const dated = filtered
    .filter((result) => !result.isSectionHeader)
    .slice(0, maxEntries);
  const headers = filtered
    .filter((result) => result.isSectionHeader)
    .slice(0, maxSectionHeaders);

  return dated.concat(headers).map((result) => ({
    dateStr: result.dateStr,
    name: result.displayName,
    group: result.group
  }));
}

module.exports = {
  buildEntries,
  colLetterToIndex,
  formatDateShort,
  parseCSV,
  parseSheetDate
};
