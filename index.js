import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 5000;

app.use(express.json());

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

app.post("/write", async (req, res) => {
  try {
    const { number, is_used } = req.body;

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Master!A:B",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[number, is_used]],
      },
    });

    res.json({ message: "Data written successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/last-row", async (req, res) => {
  try {
    const range = `Master!A:B`; // Adjust range based on your sheet

    // Get all rows from columns A & B
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.json({ message: "No data found." });
    }

    const lastRow = rows[rows.length - 1]; // Get the last row
    res.json({ lastRow });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
