import assert from "node:assert/strict";
import {
  buildGeminiRequest,
  buildJournalPrompt,
  extractGeminiText,
  isJournalAiAction,
  normalizeJournalAiOutput
} from "./journalAi";

assert.equal(isJournalAiAction("title"), true);
assert.equal(isJournalAiAction("cleanup"), true);
assert.equal(isJournalAiAction("summarize"), false);

const titlePrompt = buildJournalPrompt({
  action: "title",
  entry: "I went for a walk and felt better afterwards."
});
assert.equal(titlePrompt.includes("Return only the title."), true);
assert.equal(titlePrompt.includes("I went for a walk"), true);

const cleanupPrompt = buildJournalPrompt({
  action: "cleanup",
  entry: "today was good but i was tired"
});
assert.equal(cleanupPrompt.includes("preserving the writer's meaning"), true);
assert.equal(cleanupPrompt.includes("today was good"), true);

const geminiRequest = buildGeminiRequest("Make a title");
assert.deepEqual(geminiRequest.contents[0].parts[0], { text: "Make a title" });
assert.equal(geminiRequest.generationConfig.maxOutputTokens, 512);

const geminiText = extractGeminiText({
  candidates: [
    {
      content: {
        parts: [
          { text: "A Better " },
          { text: "Evening" }
        ]
      }
    }
  ]
});
assert.equal(geminiText, "A Better Evening");

assert.equal(normalizeJournalAiOutput("title", "\"A Better Evening.\""), "A Better Evening");
assert.equal(normalizeJournalAiOutput("title", "One Two Three Four Five Six Seven Eight Nine Ten Eleven"), "One Two Three Four Five Six Seven Eight Nine Ten");
assert.equal(normalizeJournalAiOutput("cleanup", "```text\nToday was good.\n```"), "Today was good.");
