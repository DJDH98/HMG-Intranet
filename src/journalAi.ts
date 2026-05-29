export type JournalAiAction = "title" | "cleanup";

export interface JournalAiRequest {
  action: JournalAiAction;
  entry: string;
}

export function isJournalAiAction(action: unknown): action is JournalAiAction {
  return action === "title" || action === "cleanup";
}

export function buildJournalPrompt({ action, entry }: JournalAiRequest) {
  if (action === "title") {
    return [
      "Create one concise personal journal title from this entry.",
      "Rules:",
      "- Return only the title.",
      "- Use 3 to 8 words.",
      "- Keep it natural, specific, and calm.",
      "- Do not use quotation marks, markdown, emojis, or a trailing full stop.",
      "",
      "Entry:",
      entry
    ].join("\n");
  }

  return [
    "Clean up this personal journal entry while preserving the writer's meaning, voice, and first-person perspective.",
    "Rules:",
    "- Fix spelling, punctuation, grammar, and awkward phrasing.",
    "- Keep the same facts and emotional tone.",
    "- Do not add new events, advice, analysis, headings, markdown, or commentary.",
    "- Return only the cleaned journal entry.",
    "",
    "Entry:",
    entry
  ].join("\n");
}

export function buildGeminiRequest(prompt: string) {
  return {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 512
    }
  };
}

export function extractGeminiText(response: any) {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => part?.text)
    .filter((text): text is string => typeof text === "string")
    .join("")
    .trim();
}

export function normalizeJournalAiOutput(action: JournalAiAction, text: string) {
  const cleaned = text
    .replace(/^```(?:text)?/i, "")
    .replace(/```$/i, "")
    .trim();

  if (action === "title") {
    return cleaned
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/[.。]+$/g, "")
      .split(/\s+/)
      .slice(0, 10)
      .join(" ")
      .trim();
  }

  return cleaned;
}

export async function generateJournalAiText({
  apiKey,
  action,
  entry,
  model = "gemini-2.5-flash-lite"
}: JournalAiRequest & { apiKey: string; model?: string }) {
  const trimmedEntry = entry.trim();
  if (!trimmedEntry) {
    throw new Error("Journal entry text is required.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(buildGeminiRequest(buildJournalPrompt({ action, entry: trimmedEntry })))
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed with ${response.status}: ${errorText.slice(0, 240)}`);
  }

  const data = await response.json();
  const text = normalizeJournalAiOutput(action, extractGeminiText(data));
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}
