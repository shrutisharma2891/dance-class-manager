import unittest

import pandas as pd
from streamlit.testing.v1 import AppTest

from app import google_csv_url, summarize


class DashboardTests(unittest.TestCase):
    def test_rankings_and_totals(self):
        frame = pd.DataFrame({
            "class": ["Salsa", "Ballet", "Salsa"],
            "customer": ["Alex", "Sam", "Alex"],
            "amount": ["$1,200.50", "30", "-20"],
            "count": [2, 1, 1],
        })
        _, classes, customers = summarize(frame, "class", "customer", "amount", "count")
        salsa = classes.set_index("Class").loc["Salsa"]
        self.assertEqual(salsa.Registrations, 3)
        self.assertEqual(salsa.Revenue, 1180.5)
        self.assertEqual(customers.iloc[0].Customer, "Alex")
        self.assertEqual(customers.iloc[0].Registrations, 3)

    def test_invalid_counts(self):
        frame = pd.DataFrame({"c": ["Salsa"], "u": ["Alex"], "r": [20], "n": [1.5]})
        with self.assertRaises(ValueError):
            summarize(frame, "c", "u", "r", "n")

    def test_google_link(self):
        self.assertEqual(google_csv_url("https://docs.google.com/spreadsheets/d/abc123/edit#gid=42"),
                         "https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=42")
        with self.assertRaises(ValueError):
            google_csv_url("https://example.com/spreadsheets/d/abc123/edit")

    def test_demo_dashboard(self):
        app = AppTest.from_file("app.py").run()
        app.radio[0].set_value("Demo data").run()
        self.assertEqual(len(app.exception), 0)
        self.assertEqual(len(app.get("plotly_chart")), 3)
        self.assertEqual(len(app.get("download_button")), 3)


if __name__ == "__main__":
    unittest.main()
