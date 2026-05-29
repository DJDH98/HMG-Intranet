import assert from "node:assert/strict";
import {
  JOURNAL_STORAGE_KEY,
  getMonthCalendarDays,
  isPastOrToday,
  loadJournalEntries,
  saveJournalEntries,
  toDateKey,
  upsertJournalEntry,
  type StorageLike
} from "./journalStorage";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const may2026 = getMonthCalendarDays(new Date(2026, 4, 29));
assert.equal(may2026.length, 42);
assert.equal(may2026[0].dateKey, "2026-04-26");
assert.equal(may2026[5].dateKey, "2026-05-01");
assert.equal(may2026[41].dateKey, "2026-06-06");
assert.equal(may2026[5].isCurrentMonth, true);
assert.equal(may2026[0].isCurrentMonth, false);

assert.equal(toDateKey(new Date(2026, 0, 5)), "2026-01-05");
assert.equal(isPastOrToday("2026-05-28", "2026-05-29"), true);
assert.equal(isPastOrToday("2026-05-29", "2026-05-29"), true);
assert.equal(isPastOrToday("2026-05-30", "2026-05-29"), false);

const storage = new MemoryStorage();
const created = upsertJournalEntry([], {
  date: "2026-05-29",
  title: "  First note  ",
  body: "  A useful local entry.  "
}, new Date("2026-05-29T10:00:00.000Z"));

assert.equal(created.length, 1);
assert.equal(created[0].title, "First note");
assert.equal(created[0].body, "A useful local entry.");
assert.equal(created[0].createdAt, "2026-05-29T10:00:00.000Z");

const updated = upsertJournalEntry(created, {
  date: "2026-05-29",
  title: "Second note",
  body: "Same day, revised."
}, new Date("2026-05-29T11:00:00.000Z"));

assert.equal(updated.length, 1);
assert.equal(updated[0].title, "Second note");
assert.equal(updated[0].createdAt, "2026-05-29T10:00:00.000Z");
assert.equal(updated[0].updatedAt, "2026-05-29T11:00:00.000Z");

saveJournalEntries(storage, updated);
assert.equal(storage.getItem(JOURNAL_STORAGE_KEY)?.includes("Second note"), true);
assert.deepEqual(loadJournalEntries(storage), updated);

storage.setItem(JOURNAL_STORAGE_KEY, "{broken");
assert.deepEqual(loadJournalEntries(storage), []);
