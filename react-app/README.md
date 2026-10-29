# Dance Class Insights — React + TypeScript

A separate browser app; the original Python dashboard remains in the repository root.
Built with React, TypeScript, Vite, and Recharts. CSV and Excel files are processed
in your browser, with no application backend or API key needed.

## Run in VS Code

Install Node.js **22.12+** (Node 24 LTS recommended) and open the repository in VS Code.
In **Terminal → New Terminal**, run:

```bash
cd react-app
npm ci
npm run dev
```

Open the local address printed by Vite (normally http://localhost:5173).
Press Ctrl+C to stop. These commands work in Windows, macOS, and Linux terminals.

## Use

- Demo data loads automatically.
- Upload CSV or XLSX (up to 20 MB), or paste a Google Sheets link.
- For Excel, every worksheet represents a class. The worksheet name becomes the class
  name, and all worksheets are combined automatically. No class column is required.
  Use Email, Name, and Revenue columns. Extra columns (such as Email Sent or
  Venue Change) may differ between sheets. Header capitalization and surrounding
  spaces are normalized for these fields. The first nonempty row must contain
  unique headers. Empty/header-only sheets and tabs without Email/customer or
  Revenue are skipped with a notice. Pass/summary tabs without Revenue are not
  added to class totals; no revenue is guessed or allocated to classes.
- Email, Name, and Revenue are selected automatically when present. You can
  select the customer email, display name, revenue, and optional registration count columns.
  For CSV or a single Google Sheets tab, also select the class column.
- Explore class registration/revenue charts and the top 2 repeat customers. Each chart
  includes a ranking table and CSV export. The source preview shows the first 20 rows.

Google Sheets must be publicly viewable via “Anyone with the link can view”. The
link's `gid` selects one tab. To combine classes across Google Sheets tabs, download
the spreadsheet as Microsoft Excel (.xlsx) and upload it. Browser cross-origin restrictions or Google permissions
may prevent a direct import; use a CSV/XLSX export in that case. Private customer
spreadsheets should be uploaded, rather than made public. Google Sheets is fetched
from Google; uploaded files are not sent to an application server. No Google OAuth
integration is included.

By default each row is one booking. An optional count column must contain
nonnegative whole numbers. Revenue is total received per row and is never
multiplied by counts. Use a single currency with decimal-point amounts such as
1,200.50. Currency symbols $, £, €, and ₹ are accepted; refunds may be negative.
Missing/invalid revenue is zero with a warning. Blank class/customer identifiers
are excluded from the corresponding rankings, but included in overall totals.
Customers are grouped by trimmed, lowercase email, not display name. Only customers
with more than one booking appear, with at most two shown. Ties sort alphabetically
by email; the first available name is shown in the ranking table and CSV download.
All rows are included, so remove cancellations before import if appropriate.
Excel formulas require saved results; this app does not calculate formulas.

## Validate and build

```bash
npm test
npm run build
npm run preview
```

The production build is generated in `dist/` and can be hosted as a static site.

## Example Excel layout

Create worksheets named **Salsa**, **Ballet**, and **Hip Hop**. Each sheet uses:

| Email | Name | Revenue | Count |
| --- | --- | ---: | ---: |
| alex@example.com | Alex | 50 | 2 |
| sam@example.com | Sam | 25 | 1 |

`Count` is optional; without it, each row counts as one registration. Select it
in Registration counting if present. A customer appearing in multiple class
sheets is combined in the top-two repeat ranking. Existing Class columns are ignored for
class grouping in Excel; worksheet names determine the class.
