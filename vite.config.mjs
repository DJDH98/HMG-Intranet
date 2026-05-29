import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

dotenv.config();

const JOURNAL_REDIS_KEY = 'hmg:journal:entries:v1';

const isJournalAiAction = (action) => action === 'title' || action === 'cleanup';

const buildJournalPrompt = ({ action, entry }) => {
  if (action === 'title') {
    return [
      'Create one concise personal journal title from this entry.',
      'Rules:',
      '- Return only the title.',
      '- Use 3 to 8 words.',
      '- Keep it natural, specific, and calm.',
      '- Do not use quotation marks, markdown, emojis, or a trailing full stop.',
      '',
      'Entry:',
      entry,
    ].join('\n');
  }

  return [
    "Clean up this personal journal entry while preserving the writer's meaning, voice, and first-person perspective.",
    'Rules:',
    '- Fix spelling, punctuation, grammar, and awkward phrasing.',
    "- Keep the same facts and emotional tone.",
    '- Do not add new events, advice, analysis, headings, markdown, or commentary.',
    '- Return only the cleaned journal entry.',
    '',
    'Entry:',
    entry,
  ].join('\n');
};

const extractGeminiText = (response) => {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => part?.text)
    .filter((text) => typeof text === 'string')
    .join('')
    .trim();
};

const normalizeJournalAiOutput = (action, text) => {
  const cleaned = text
    .replace(/^```(?:text)?/i, '')
    .replace(/```$/i, '')
    .trim();

  if (action === 'title') {
    return cleaned
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .replace(/[.。]+$/g, '')
      .split(/\s+/)
      .slice(0, 10)
      .join(' ')
      .trim();
  }

  return cleaned;
};

const readJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
};

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const journalAiDevMiddleware = () => ({
  name: 'journal-ai-dev-middleware',
  configureServer(server) {
    server.middlewares.use('/api/journal-ai', async (req, res) => {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(res, 405, { success: false, error: 'Method not allowed' });
        return;
      }

      const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        sendJson(res, 503, { success: false, error: 'Google Gemini API key is not configured.' });
        return;
      }

      try {
        const { action, entry } = await readJsonBody(req);
        if (!isJournalAiAction(action) || typeof entry !== 'string' || !entry.trim()) {
          sendJson(res, 400, { success: false, error: 'A valid action and journal entry are required.' });
          return;
        }

        const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: buildJournalPrompt({ action, entry: entry.trim() }) }],
              },
            ],
            generationConfig: {
              temperature: 0.35,
              topP: 0.9,
              maxOutputTokens: 512,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          sendJson(res, 500, { success: false, error: `Gemini request failed with ${response.status}: ${errorText.slice(0, 240)}` });
          return;
        }

        const data = await response.json();
        const text = normalizeJournalAiOutput(action, extractGeminiText(data));
        if (!text) {
          sendJson(res, 500, { success: false, error: 'Gemini returned an empty response.' });
          return;
        }

        sendJson(res, 200, { success: true, text });
      } catch (error) {
        sendJson(res, 500, { success: false, error: error?.message || 'Journal AI request failed.' });
      }
    });
  },
});

const hasJournalDatabaseEnv = () => Boolean(
  (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  || (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
);

const createDevJournalDatabase = () => {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  });

  const parseEntries = (values) => {
    if (!values) return [];

    return Object.values(values)
      .map((value) => {
        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          return null;
        }
      })
      .filter((entry) => (
        typeof entry?.id === 'string'
        && typeof entry.date === 'string'
        && typeof entry.title === 'string'
        && typeof entry.body === 'string'
        && typeof entry.createdAt === 'string'
        && typeof entry.updatedAt === 'string'
      ))
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  const listEntries = async () => parseEntries(await redis.hgetall(JOURNAL_REDIS_KEY));

  return {
    listEntries,
    async upsertEntry({ date, title, body }) {
      const current = await listEntries();
      const existing = current.find((entry) => entry.date === date);
      const timestamp = new Date().toISOString();
      const entry = {
        id: existing?.id || `journal-${date}-${Date.now()}`,
        date,
        title: title.trim(),
        body: body.trim(),
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
      };

      await redis.hset(JOURNAL_REDIS_KEY, { [date]: JSON.stringify(entry) });
      return listEntries();
    },
    async deleteEntry(date) {
      await redis.hdel(JOURNAL_REDIS_KEY, date);
      return listEntries();
    },
  };
};

const journalEntriesDevMiddleware = () => ({
  name: 'journal-entries-dev-middleware',
  configureServer(server) {
    server.middlewares.use('/api/journal-entries', async (req, res) => {
      if (!hasJournalDatabaseEnv()) {
        sendJson(res, 503, { success: false, error: 'Journal database is not configured.' });
        return;
      }

      try {
        const database = createDevJournalDatabase();

        if (req.method === 'GET') {
          sendJson(res, 200, { success: true, entries: await database.listEntries() });
          return;
        }

        if (req.method === 'POST') {
          const { date, title, body } = await readJsonBody(req);
          if (typeof date !== 'string' || typeof title !== 'string' || typeof body !== 'string') {
            sendJson(res, 400, { success: false, error: 'A date, title, and body are required.' });
            return;
          }

          sendJson(res, 200, { success: true, entries: await database.upsertEntry({ date, title, body }) });
          return;
        }

        if (req.method === 'DELETE') {
          const requestUrl = new URL(req.url || '', 'http://localhost');
          const date = requestUrl.searchParams.get('date');
          if (!date) {
            sendJson(res, 400, { success: false, error: 'A date is required.' });
            return;
          }

          sendJson(res, 200, { success: true, entries: await database.deleteEntry(date) });
          return;
        }

        res.setHeader('Allow', 'GET, POST, DELETE');
        sendJson(res, 405, { success: false, error: 'Method not allowed' });
      } catch (error) {
        sendJson(res, 500, { success: false, error: error?.message || 'Journal database request failed.' });
      }
    });
  },
});

export default defineConfig({
  base: '/',
  plugins: [journalAiDevMiddleware(), journalEntriesDevMiddleware(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    // HMR can be disabled via DISABLE_HMR for constrained preview environments.
    // File watching is also disabled in that mode to keep edits responsive.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
