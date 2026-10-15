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
- For Excel, select the worksheet. The first nonempty row must contain unique headers.
- Select class, customer (preferably email), revenue, and optionally registration count columns.
- Explore class registration/revenue charts and the top 10 customers. Each chart
  includes a ranking table and CSV export. The source preview shows the first 20 rows.

Google Sheets must be publicly viewable via “Anyone with the link can view”. The
link's `gid` selects the tab. Browser cross-origin restrictions or Google permissions
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
Names are matched exactly after trimming whitespace; ties sort alphabetically.
All rows are included, so remove cancellations before import if appropriate.
Excel formulas require saved results; this app does not calculate formulas.

## Validate and build

```bash
npm test
npm run build
npm run preview
```

The production build is generated in `dist/` and can be hosted as a static site.
