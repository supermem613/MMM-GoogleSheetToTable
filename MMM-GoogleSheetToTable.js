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
    displayNames: {},
    columns: {},
    dateColumn: "A",
    updateInterval: 4 * 60 * 60 * 1000, // 4 hours
    maxEntries: 6,
    showPastDates: false,
    includeSectionHeaders: false,
    maxSectionHeaders: 2,
    headerAlignment: "left",
    frameWidth: 300, // px width of the rendered module column; raise to align with neighbouring modules
    animationSpeed: 1000
  },

  getStyles: function () {
    return ["MMM-GoogleSheetToTable.css"];
  },

  start: function () {
    Log.info(`Starting module: ${this.name}`);
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
    wrapper.style.width = `${this.config.frameWidth}px`;

    // Loading state
    if (!this.loaded && !this.error) {
      wrapper.innerHTML =
        '<span class="gsheet-loading dimmed small">Loading schedule…</span>';
      return wrapper;
    }

    // Error state with no data
    if (this.error && !this.entries) {
      wrapper.innerHTML = `<span class="gsheet-error small">${this.error}</span>`;
      return wrapper;
    }

    // No results
    if (!this.entries || this.entries.length === 0) {
      wrapper.innerHTML =
        '<span class="gsheet-empty dimmed small">No upcoming entries found.</span>';
      return wrapper;
    }

    // Build table
    var table = document.createElement("table");
    table.className = "gsheet-table small";
    var headerAlignment =
      this.config.headerAlignment === "right" ? "right" : "left";
    table.classList.add(`gsheet-header-align-${headerAlignment}`);

    var columns = [
      { label: "Date", className: "gsheet-date" },
      { label: "Name", className: "gsheet-name" },
      { label: "Group", className: "gsheet-group" }
    ];

    var colgroup = document.createElement("colgroup");
    for (var c = 0; c < columns.length; c++) {
      var col = document.createElement("col");
      col.className = `${columns[c].className}-column`;
      colgroup.appendChild(col);
    }
    table.appendChild(colgroup);

    // Header row
    var thead = document.createElement("thead");
    var headerRow = document.createElement("tr");
    for (var h = 0; h < columns.length; h++) {
      var th = document.createElement("th");
      th.className = `gsheet-header ${columns[h].className}`;
      th.textContent = columns[h].label;
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
