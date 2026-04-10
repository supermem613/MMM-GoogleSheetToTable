/**
 * MMM-GoogleSheetToTable — Frontend Module
 *
 * Displays a filtered table from a Google Sheet showing
 * date, name, and group assignments for configured people.
 */
Module.register("MMM-GoogleSheetToTable", {
  defaults: {
    sheetId: "",
    names: [],
    columns: {},
    dateColumn: "A",
    updateInterval: 4 * 60 * 60 * 1000, // 4 hours
    maxEntries: 6,
    showPastDates: false,
    animationSpeed: 1000
  },

  getStyles: function () {
    return ["MMM-GoogleSheetToTable.css"];
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    this.entries = null;
    this.updatedAt = null;
    this.error = null;
    this.loaded = false;

    this.sendSocketNotification("FETCH_SHEET", this.config);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "SHEET_DATA") {
      this.entries = payload.entries;
      this.updatedAt = payload.updatedAt;
      this.error = null;
      this.loaded = true;
      this.updateDom(this.config.animationSpeed);
    } else if (notification === "SHEET_ERROR") {
      this.error = payload.error;
      this.updateDom(this.config.animationSpeed);
    }
  },

  getDom: function () {
    var wrapper = document.createElement("div");
    wrapper.className = "gsheet-wrapper";

    // Loading state
    if (!this.loaded && !this.error) {
      wrapper.innerHTML = '<span class="gsheet-loading dimmed small">Loading schedule…</span>';
      return wrapper;
    }

    // Error state with no data
    if (this.error && !this.entries) {
      wrapper.innerHTML = '<span class="gsheet-error small">' + this.error + '</span>';
      return wrapper;
    }

    // No results
    if (!this.entries || this.entries.length === 0) {
      wrapper.innerHTML = '<span class="gsheet-empty dimmed small">No upcoming entries found.</span>';
      return wrapper;
    }

    // Build table
    var table = document.createElement("table");
    table.className = "gsheet-table small";

    // Header row
    var thead = document.createElement("thead");
    var headerRow = document.createElement("tr");
    var headers = ["Date", "Name", "Group"];
    for (var h = 0; h < headers.length; h++) {
      var th = document.createElement("th");
      th.className = "gsheet-header";
      th.textContent = headers[h];
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Data rows — merge duplicate dates visually
    var tbody = document.createElement("tbody");
    var lastDate = "";
    for (var i = 0; i < this.entries.length; i++) {
      var entry = this.entries[i];
      var tr = document.createElement("tr");
      tr.className = "gsheet-row";

      // Date cell — show only on first occurrence
      var tdDate = document.createElement("td");
      tdDate.className = "gsheet-date";
      if (entry.dateStr !== lastDate) {
        tdDate.textContent = entry.dateStr;
        tdDate.className += " bright";
        lastDate = entry.dateStr;
      }
      tr.appendChild(tdDate);

      // Name cell
      var tdName = document.createElement("td");
      tdName.className = "gsheet-name";
      tdName.textContent = entry.name;
      tr.appendChild(tdName);

      // Group cell
      var tdGroup = document.createElement("td");
      tdGroup.className = "gsheet-group dimmed";
      tdGroup.textContent = entry.group;
      tr.appendChild(tdGroup);

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
  }
});
