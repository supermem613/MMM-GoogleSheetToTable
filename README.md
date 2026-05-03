# MMM-GoogleSheetToTable

A [MagicMirror²](https://magicmirror.builders/) module that fetches a public Google Sheet and displays a filtered table of matching entries.

Given a spreadsheet with dates in one column and category assignments across other columns, the module searches for configured values and renders a clean Date | Name | Group table on your mirror.

## Features

- **Public Google Sheet support** — fetches via CSV export, no API key or authentication needed
- **Config-driven names** — specify which people to search for in the sheet
- **Config-driven column mapping** — map spreadsheet columns to group names (e.g., `D → "K/1 Boys"`)
- **Configurable date column** — choose which column contains date values
- **Future-only filtering** — optionally hide past dates (enabled by default)
- **Smart date parsing** — handles "Month Nth" format (e.g., "April 4th", "May 2nd") with automatic year inference
- **Multi-row date blocks** — correctly handles sheets where each date spans multiple rows
- **Auto-refreshing** — configurable refresh interval (default: every 4 hours)
- **Zero external dependencies** — uses only Node built-ins

## Prerequisites

- MagicMirror²
- A publicly accessible Google Sheet

## Setup

Add to your `config/config.js`:

```js
{
    module: "MMM-GoogleSheetToTable",
    position: "bottom_right",
    header: "Kids Schedule",
    config: {
        sheetId: "YOUR_GOOGLE_SHEET_ID",
        names: ["First Last", "Another Person"],
        displayNames: {
            "First Last": "First"
        },
        columns: {
            "B": "Group 1",
            "C": "Group 2",
            "D": "Group 3"
        }
    }
}
```

The `sheetId` is the long string in your Google Sheet URL:
```
https://docs.google.com/spreadsheets/d/THIS_IS_THE_SHEET_ID/edit#gid=0
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `sheetId` | `""` | Google Sheet ID (from the sheet URL) |
| `names` | `[]` | Array of names to search for (case-insensitive exact match) |
| `displayNames` | `{}` | Optional matched name → displayed label mapping. Keys are case-insensitive, so `{ "Jane Smith": "Jane" }` renders `"Jane"` while still matching `"Jane Smith"` in the sheet. |
| `columns` | `{}` | Column letter → group name mapping (e.g., `{ "B": "Kitantan", "C": "Nursery/Prek" }`) |
| `dateColumn` | `"A"` | Which column contains the date values |
| `updateInterval` | `14400000` (4 hr) | How often to refresh data from Google Sheets (ms) |
| `maxEntries` | `6` | Maximum number of entries to display |
| `showPastDates` | `false` | Whether to include past dates in the table |
| `includeSectionHeaders` | `false` | When `true`, rows under a non-date label in the date column (e.g. `"Learning Program"`) are included and displayed under that label instead of a date. Header entries appear after dated entries in the table. |
| `maxSectionHeaders` | `2` | Maximum number of section-header entries to display. Independent of `maxEntries` — dated and header entries each have their own cap, so a full slate of dated matches does not squeeze out undated ones. Only relevant when `includeSectionHeaders` is `true`. |
| `animationSpeed` | `1000` | DOM update animation speed (ms) |

## Example

For a schedule sheet where column A has dates and columns B–J have group assignments:

```js
{
    module: "MMM-GoogleSheetToTable",
    position: "bottom_right",
    header: "Kids Schedule",
    config: {
        sheetId: "1gxCeHBjVvxdyZ8hSD5FjDrhPA4Zr23PguLeBjMdh8jU",
        updateInterval: 4 * 60 * 60 * 1000,
        maxEntries: 6,
        showPastDates: false,
        names: ["Jane Smith", "John Smith"],
        displayNames: {
            "Jane Smith": "Jane",
            "John Smith": "John"
        },
        columns: {
            "B": "Kitantan",
            "C": "Nursery/Prek",
            "D": "K/1 Boys",
            "E": "K/1 Girls",
            "F": "2/3 Boys",
            "G": "2/3 Girls",
            "H": "4/5 Boys",
            "I": "4/5 Girls",
            "J": "Shadows"
        }
    }
}
```

This produces a table like:

| Date | Name | Group |
|------|------|-------|
| Apr 11 | Jane | K/1 Boys |
| May 2 | Jane | K/1 Boys |
| May 16 | Jane | K/1 Boys |

## How It Works

1. The node helper fetches the Google Sheet as CSV via the public export URL
2. Parses CSV into rows, classifying each value in the date column as one of:
   - **parseable date** → opens a new date block
   - **non-date text** → section header (e.g. `"Learning Program"`) that ends the previous date block; rows beneath belong to the section, not to a date
   - **empty** → continues the current date block or section
3. Searches all configured columns for any configured name (case-insensitive exact match)
4. Applies optional display labels from `displayNames`
5. Parses dates, sorts chronologically, filters to future-only (by default)
6. Section-header matches are dropped by default; enable `includeSectionHeaders` to display them after dated entries with the header text in the Date column
7. Sends the top N entries to the frontend for table rendering

## Notes

- The Google Sheet must be publicly accessible (anyone with the link can view)
- Date parsing handles ordinal suffixes (1st, 2nd, 3rd, 4th, etc.) and infers the current year
- If a date is more than 6 months in the past, it's assumed to be next year

## License

MIT
