import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";
import cron from "node-cron";
import NodeCache from "node-cache";

dotenv.config();

const cache = new NodeCache({ stdTTL: 60 });
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

cron.schedule("*/1 * * * *", async () => {
  getLastRow();
});

app.post("/increase", async (req, res) => {
  try {
    const lastRow = await getLastRow();
    if (lastRow[2] == 1) {
      lastRow[0] = 0;
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Master!A:B",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[Number(lastRow[0]) + 1, "FALSE"]],
      },
    });
    cache.del("lastRow");
    res.json({ message: "Data written successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/decrease", async (req, res) => {
  try {
    const lastRow = await getLastRow();

    if (lastRow[0] == -1 || lastRow[2] == 1) {
      return res.status(404).json({ message: "No data to delete" });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: parseInt(process.env.SHEET_ID, 10), // You need to set SHEET_ID
                dimension: "ROWS",
                startIndex: lastRow[2] - 1, // 0-based index
                endIndex: lastRow[2], // Delete only 1 row
              },
            },
          },
        ],
      },
    });
    cache.del("lastRow");
    res.json({ message: "Data Deleted successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function getLastRow() {
  const cachedData = cache.get("lastRow");
  if (cachedData) {
    return cachedData;
  }

  const range = `Master!A:B`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: range,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return [-1];
  }
  const lastRow = rows[rows.length - 1];
  cache.set("lastRow", [...lastRow, rows.length]);
  return [...lastRow, rows.length];
}

app.post("/update-used", async (req, res) => {
  try {
    const { number } = req.body; // Get row number and new value from request

    const range = `Master!B${Number(number) + 1}`; // Update only column B of the given row

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [["TRUE"]], // New value for column B
      },
    });

    res.json({ message: `Number ${number} updated successfully!` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/unused", async (req, res) => {
  try {
    const cachedData = cache.get("all");
    if (cachedData) {
      return cachedData;
    }

    const range = `Master!A:B`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range,
    });

    const rows = response.data.values;

    cache.set(
      "all",
      rows.filter(([number, isUsed]) => isUsed === "FALSE")
    );
    res.json(rows.filter(([number, isUsed]) => isUsed === "FALSE"));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/last-row", async (req, res) => {
  try {
    const lastRow = await getLastRow();

    if (lastRow[0] == -1) {
      return res.json({ message: "No data found." });
    }

    if (lastRow[2] == 1) {
      lastRow[0] = 0;
    }
    res.json(lastRow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
