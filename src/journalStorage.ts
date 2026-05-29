export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const JOURNAL_STORAGE_KEY = "dalen_journal_entries";

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isPastOrToday(dateKey: string, todayKey = toDateKey(new Date())) {
  return dateKey <= todayKey;
}

export function loadJournalEntries(storage: StorageLike): JournalEntry[] {
  const saved = storage.getItem(JOURNAL_STORAGE_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is JournalEntry => (
      typeof entry?.id === "string" &&
      typeof entry.date === "string" &&
      typeof entry.title === "string" &&
      typeof entry.body === "string" &&
      typeof entry.createdAt === "string" &&
      typeof entry.updatedAt === "string"
    ));
  } catch {
    return [];
  }
}

export function saveJournalEntries(storage: StorageLike, entries: JournalEntry[]) {
  storage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
}

export function upsertJournalEntry(
  entries: JournalEntry[],
  input: { date: string; title: string; body: string },
  now = new Date()
) {
  const existing = entries.find((entry) => entry.date === input.date);
  const timestamp = now.toISOString();
  const title = input.title.trim();
  const body = input.body.trim();

  if (existing) {
    return entries.map((entry) => (
      entry.date === input.date
        ? { ...entry, title, body, updatedAt: timestamp }
        : entry
    ));
  }

  return [
    ...entries,
    {
      id: `journal-${input.date}-${now.getTime()}`,
      date: input.date,
      title,
      body,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ].sort((a, b) => b.date.localeCompare(a.date));
}

export function getMonthCalendarDays(monthDate: Date) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const calendarStart = new Date(firstOfMonth);
  calendarStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);

    return {
      date,
      dateKey: toDateKey(date),
      isCurrentMonth: date.getMonth() === monthDate.getMonth()
    };
  });
}
