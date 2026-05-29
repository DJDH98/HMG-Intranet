import { Redis } from "@upstash/redis";
import type { JournalEntry } from "./journalStorage";

export const JOURNAL_REDIS_KEY = "hmg:journal:entries:v1";

export interface JournalDatabase {
  listEntries(): Promise<JournalEntry[]>;
  upsertEntry(entry: JournalEntry): Promise<JournalEntry[]>;
  deleteEntry(date: string): Promise<JournalEntry[]>;
}

export function parseRedisJournalEntries(values: Record<string, unknown> | null | undefined) {
  if (!values) return [];

  return Object.values(values)
    .map((value) => {
      try {
        return typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is JournalEntry => (
      typeof entry?.id === "string" &&
      typeof entry.date === "string" &&
      typeof entry.title === "string" &&
      typeof entry.body === "string" &&
      typeof entry.createdAt === "string" &&
      typeof entry.updatedAt === "string"
    ))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function hasJournalDatabaseEnv(env: NodeJS.ProcessEnv) {
  return Boolean(
    (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) ||
    (env.KV_REST_API_URL && env.KV_REST_API_TOKEN)
  );
}

export function createRedisJournalDatabase(env: NodeJS.ProcessEnv = process.env): JournalDatabase {
  if (!hasJournalDatabaseEnv(env)) {
    throw new Error("Journal database is not configured.");
  }

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN!
  });

  const listEntries = async () => parseRedisJournalEntries(await redis.hgetall(JOURNAL_REDIS_KEY));

  return {
    listEntries,
    async upsertEntry(entry) {
      await redis.hset(JOURNAL_REDIS_KEY, { [entry.date]: JSON.stringify(entry) });
      return listEntries();
    },
    async deleteEntry(date) {
      await redis.hdel(JOURNAL_REDIS_KEY, date);
      return listEntries();
    }
  };
}
