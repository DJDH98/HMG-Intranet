import {
  generateJournalAiText,
  isJournalAiAction
} from "../src/journalAi";
import { requireAuthenticatedRequest } from "./clerkAuth";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (!(await requireAuthenticatedRequest(req, res))) return;

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: "Google Gemini API key is not configured."
    });
  }

  const { action, entry } = req.body || {};
  if (!isJournalAiAction(action) || typeof entry !== "string" || !entry.trim()) {
    return res.status(400).json({
      success: false,
      error: "A valid action and journal entry are required."
    });
  }

  try {
    const text = await generateJournalAiText({
      apiKey,
      action,
      entry,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite"
    });

    return res.json({ success: true, text });
  } catch (error: any) {
    console.error("Journal AI request failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Journal AI request failed."
    });
  }
}
