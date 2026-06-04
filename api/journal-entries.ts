import {
  createRedisJournalDatabase,
  hasJournalDatabaseEnv
} from "../src/journalDatabase.js";
import {
  upsertJournalEntry,
  type JournalEntry
} from "../src/journalStorage.js";
import { requireAuthenticatedRequest } from "./clerkAuth.js";

const MAX_TITLE_LENGTH = 140;
const MAX_BODY_LENGTH = 20_000;
const JOURNAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: any, res: any) {
  if (!(await requireAuthenticatedRequest(req, res))) return;

  if (!hasJournalDatabaseEnv(process.env)) {
    return res.status(503).json({
      success: false,
      error: "Journal database is not configured."
    });
  }

  const database = createRedisJournalDatabase();

  try {
    if (req.method === "GET") {
      return res.json({ success: true, entries: await database.listEntries() });
    }

    if (req.method === "POST") {
      const { date, title, body } = req.body || {};
      if (typeof date !== "string" || typeof title !== "string" || typeof body !== "string") {
        return res.status(400).json({ success: false, error: "A date, title, and body are required." });
      }
      if (!JOURNAL_DATE_PATTERN.test(date)) {
        return res.status(400).json({ success: false, error: "Date must use YYYY-MM-DD format." });
      }
      if (title.length > MAX_TITLE_LENGTH || body.length > MAX_BODY_LENGTH) {
        return res.status(413).json({ success: false, error: "Journal entry is too large." });
      }

      const nextEntries = upsertJournalEntry(await database.listEntries(), { date, title, body });
      const entry = nextEntries.find((journalEntry) => journalEntry.date === date) as JournalEntry | undefined;
      if (!entry) {
        return res.status(500).json({ success: false, error: "Journal entry could not be prepared." });
      }

      return res.json({ success: true, entries: await database.upsertEntry(entry) });
    }

    if (req.method === "DELETE") {
      const date = typeof req.query?.date === "string" ? req.query.date : "";
      if (!JOURNAL_DATE_PATTERN.test(date)) {
        return res.status(400).json({ success: false, error: "A valid date is required." });
      }

      return res.json({ success: true, entries: await database.deleteEntry(date) });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error: any) {
    console.error("Journal database request failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Journal database request failed."
    });
  }
}
