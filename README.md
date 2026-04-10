# MMM-GoogleSheetToTable

A [MagicMirror²](https://magicmirror.builders/) module that fetches a public Google Sheet and displays a filtered table of entries for specific people.

Given a schedule spreadsheet with dates in one column and group assignments across other columns, the module searches for configured names and renders a clean Date | Name | Group table on your mirror.

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
| `columns` | `{}` | Column letter → group name mapping (e.g., `{ "B": "Kitantan", "C": "Nursery/Prek" }`) |
| `dateColumn` | `"A"` | Which column contains the date values |
| `updateInterval` | `14400000` (4 hr) | How often to refresh data from Google Sheets (ms) |
| `maxEntries` | `6` | Maximum number of entries to display |
| `showPastDates` | `false` | Whether to include past dates in the table |
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
        names: ["Asher Markiewicz", "Miriam Markiewicz"],
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
| Apr 11 | Asher Markiewicz | K/1 Boys |
| May 2 | Asher Markiewicz | K/1 Boys |
| May 16 | Asher Markiewicz | K/1 Boys |

## How It Works

1. The node helper fetches the Google Sheet as CSV via the public export URL
2. Parses CSV into rows, grouping by date blocks (a non-empty date column starts a new block)
3. Searches all configured columns for any configured name (case-insensitive exact match)
4. Parses dates, sorts chronologically, filters to future-only (by default)
5. Sends the top N entries to the frontend for table rendering

## Notes

- The Google Sheet must be publicly accessible (anyone with the link can view)
- Date parsing handles ordinal suffixes (1st, 2nd, 3rd, 4th, etc.) and infers the current year
- If a date is more than 6 months in the past, it's assumed to be next year

## License

MIT
