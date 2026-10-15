import io
import re
from urllib.parse import parse_qs, urlparse

import pandas as pd
import plotly.express as px
import requests
import streamlit as st


def google_csv_url(link):
    parsed = urlparse(link.strip())
    match = re.fullmatch(r"/spreadsheets/d/([A-Za-z0-9_-]+)(?:/.*)?", parsed.path)
    if parsed.scheme != "https" or parsed.hostname != "docs.google.com" or not match:
        raise ValueError("Enter a Google Sheets URL starting with https://docs.google.com/spreadsheets/d/.")
    params = parse_qs(parsed.query)
    fragment = parse_qs(parsed.fragment)
    gid = fragment.get("gid", params.get("gid", ["0"]))[0]
    if not gid.isdigit():
        raise ValueError("The sheet tab ID (gid) must be numeric.")
    return f"https://docs.google.com/spreadsheets/d/{match[1]}/export?format=csv&gid={gid}"


def numeric(series):
    # Supports decimal-point amounts such as $1,200.50; missing/invalid values stay missing.
    return pd.to_numeric(series.astype(str).str.replace(r"[,$£€₹\s]", "", regex=True), errors="coerce")


def summarize(frame, class_col, customer_col, revenue_col, count_col=None):
    data = pd.DataFrame({
        "Class": frame[class_col].fillna("").astype(str).str.strip(),
        "Customer": frame[customer_col].fillna("").astype(str).str.strip(),
        "Revenue": numeric(frame[revenue_col]),
        "Registrations": numeric(frame[count_col]) if count_col else 1,
    })
    invalid_counts = data.Registrations.isna() | (data.Registrations < 0) | (data.Registrations % 1 != 0)
    if invalid_counts.any():
        raise ValueError("Registration counts must all be nonnegative whole numbers. Fix the count column or use one registration per row.")
    classes = data[data.Class != ""].groupby("Class", as_index=False).agg(
        Registrations=("Registrations", "sum"), Revenue=("Revenue", "sum")
    )
    customers = data[data.Customer != ""].groupby("Customer", as_index=False).agg(
        Registrations=("Registrations", "sum")
    ).sort_values(["Registrations", "Customer"], ascending=[False, True]).head(10)
    return data, classes, customers


def main():
    st.set_page_config(page_title="Dance Class Insights", page_icon="💃", layout="wide")
    st.title("Dance Class Insights")
    st.write("Find your most popular classes, biggest revenue earners, and most active customers.")
    source = st.radio("Spreadsheet source", ["Google Sheets", "Upload CSV or Excel", "Demo data"], horizontal=True)
    frame = None
    try:
        if source == "Google Sheets":
            st.caption("Use a sheet shared as ‘Anyone with the link can view’. For private sheets, upload an export instead. The selected tab comes from the link's gid.")
            with st.form("sheet"):
                link = st.text_input("Google Sheets link")
                submitted = st.form_submit_button("Load spreadsheet")
            if submitted:
                response = requests.get(google_csv_url(link), timeout=30)
                response.raise_for_status()
                if "text/html" in response.headers.get("Content-Type", ""):
                    raise ValueError("Google returned a web page. Check the sharing permission, or upload a CSV/Excel export.")
                st.session_state["sheet_data"] = pd.read_csv(io.BytesIO(response.content))
            frame = st.session_state.get("sheet_data")
        elif source == "Upload CSV or Excel":
            upload = st.file_uploader("Choose a spreadsheet", type=["csv", "xlsx"])
            if upload:
                if upload.name.lower().endswith(".xlsx"):
                    book = pd.ExcelFile(upload)
                    tab = st.selectbox("Worksheet", book.sheet_names)
                    frame = pd.read_excel(book, sheet_name=tab)
                else:
                    frame = pd.read_csv(upload)
        else:
            frame = pd.DataFrame({"Class": ["Salsa", "Ballet", "Hip Hop", "Salsa", "Hip Hop"],
                                  "Customer": ["Alex", "Sam", "Alex", "Taylor", "Sam"],
                                  "Revenue": [25, 30, 20, 25, 20]})
    except (ValueError, requests.RequestException, OSError) as exc:
        st.error(f"Could not load spreadsheet: {exc}")
        return
    if frame is None:
        st.info("Load a spreadsheet to get started. The first row should contain column names.")
        return
    if frame.empty or len(frame.columns) < 3:
        st.error("Provide at least one data row and columns for class, customer, and revenue.")
        return
    st.subheader("Map your columns")
    columns = list(frame.columns)

    def choose(label, hints):
        default = next((i for i, c in enumerate(columns) if str(c).strip().lower() in hints), 0)
        return st.selectbox(label, columns, index=default)

    left, middle, right = st.columns(3)
    with left:
        class_col = choose("Class name", ["class", "class name", "class_name"])
    with middle:
        customer_col = choose("Customer identifier (email or name)", ["customer", "customer name", "email", "customer_email"])
    with right:
        revenue_col = choose("Revenue received per row", ["revenue", "amount", "total", "paid", "revenue generated"])
    count_col = st.selectbox("Registration counting", ["One registration per row"] + columns)
    count_col = None if count_col == "One registration per row" else count_col
    st.caption("Revenue is summed once per row. Choose total revenue received, not unit price. Use a single currency and decimal-point amounts. Customers are grouped by the exact identifier; email is preferable to names.")
    if len({class_col, customer_col, revenue_col}) != 3 or count_col in {class_col, customer_col, revenue_col}:
        st.error("Choose different columns for each field.")
        return
    try:
        data, classes, customers = summarize(frame, class_col, customer_col, revenue_col, count_col)
    except ValueError as exc:
        st.error(str(exc))
        return
    if data.Revenue.isna().any():
        st.warning(f"{data.Revenue.isna().sum()} rows have missing or invalid revenue and contribute zero to revenue totals.")
    if (data.Class == "").any() or (data.Customer == "").any():
        st.warning("Rows without a class are excluded from class charts; rows without a customer are excluded from the customer ranking.")
    st.caption("All rows are included, including cancellations or refunds. Remove unwanted rows before loading. Negative revenue reduces totals.")
    for title, table, category, value in [
        ("Classes by registrations", classes, "Class", "Registrations"),
        ("Classes by revenue", classes, "Class", "Revenue"),
        ("Top 10 customers by bookings", customers, "Customer", "Registrations"),
    ]:
        st.subheader(title)
        ranked = table.sort_values([value, category], ascending=[False, True])
        fig = px.bar(ranked, x=value, y=category, orientation="h", text_auto=True)
        fig.update_layout(yaxis={"autorange": "reversed"}, height=max(350, 30 * len(ranked) + 100))
        st.plotly_chart(fig, use_container_width=True)
        st.download_button("Download chart data", ranked.to_csv(index=False), file_name=f"{category.lower()}-{value.lower()}.csv", mime="text/csv", key=title)
    with st.expander("Preview source data"):
        st.dataframe(frame, hide_index=True)


if __name__ == "__main__":
    main()
