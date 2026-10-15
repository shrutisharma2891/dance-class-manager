# Dance Class Insights

A Streamlit dashboard for Google Sheets, CSV, and Excel spreadsheets.

## Run

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/streamlit run app.py --server.address 0.0.0.0
```

Select **Demo data** to explore the dashboard, or load your own sheet. Google
Sheets links must be viewable by anyone with the link; private sheets can be
downloaded and uploaded as CSV or XLSX. Do not make sensitive customer data public
just to use a link. Uploaded data is processed by the running dashboard server.

The first row must contain headers. Map class, customer identifier, and revenue
columns in the dashboard. By default each row is one registration; aggregated
sheets can supply a nonnegative whole-number registration count column. Revenue
must be the total received for that row in a single currency, using decimal-point
notation (e.g. 1,200.50). It is never multiplied by the registration count.

Charts rank classes by registrations and revenue, plus the top 10 customers by
registrations. Ties are ordered alphabetically. Download buttons export each
ranking. Customer identifiers are matched exactly after trimming whitespace.
Missing class/customer identifiers are excluded from their respective charts;
invalid revenue contributes zero with a warning. Refund amounts can be negative.
All input rows are included: filter out cancellations beforehand if needed.
