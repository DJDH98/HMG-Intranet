import assert from "node:assert/strict";
import {
  hasJournalDatabaseEnv,
  parseRedisJournalEntries
} from "./journalDatabase";

const entries = parseRedisJournalEntries({
  "2026-05-28": JSON.stringify({
    id: "journal-2026-05-28",
    date: "2026-05-28",
    title: "Older",
    body: "Older entry",
    createdAt: "2026-05-28T10:00:00.000Z",
    updatedAt: "2026-05-28T10:00:00.000Z"
  }),
  "2026-05-29": {
    id: "journal-2026-05-29",
    date: "2026-05-29",
    title: "Newer",
    body: "Newer entry",
    createdAt: "2026-05-29T10:00:00.000Z",
    updatedAt: "2026-05-29T10:00:00.000Z"
  },
  broken: "{broken",
  invalid: JSON.stringify({ date: "2026-05-30" })
});

assert.equal(entries.length, 2);
assert.equal(entries[0].date, "2026-05-29");
assert.equal(entries[1].date, "2026-05-28");

assert.equal(hasJournalDatabaseEnv({}), false);
assert.equal(hasJournalDatabaseEnv({
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token"
} as NodeJS.ProcessEnv), true);
