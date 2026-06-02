import type { VercelRequest, VercelResponse } from "@vercel/node";

type FlipStatus = "BUYING" | "SELLING" | "FINISHED";

interface OsrsFlip {
  id: string | null;
  accountId: number;
  accountName: string;
  itemId: number;
  itemName: string;
  itemIconUrl?: string;
  openedTime: number;
  openedQuantity: number;
  spent: number;
  closedTime: number;
  closedQuantity: number;
  receivedPostTax: number;
  profit: number;
  taxPaid: number;
  status: FlipStatus;
  updatedTime: number;
  deleted: boolean;
  portfolioId: number;
  seqNo: number;
  userId: number;
}

interface OsrsFlipSummary {
  totalProfit: number;
  totalGross: number;
  taxPaid: number;
  flipsMade: number;
  activeFlips: number;
  biggestWin: number;
  biggestLoss: number;
  roi: number;
  lastUpdated: string;
}

interface CachePayload {
  accounts: Record<string, number>;
  flips: OsrsFlip[];
  summary: OsrsFlipSummary;
}

const API_HOST = process.env.FLIPPING_COPILOT_HOST || "https://api.flippingcopilot.com";
const CACHE_MS = 2 * 60 * 1000;
const COOKIE_NAME = "hmg_fc_jwt";
const USER_ID_COOKIE_NAME = "hmg_fc_user_id";
const OSRS_WIKI_MAPPING_URL = "https://prices.runescape.wiki/api/v1/osrs/mapping";

let cachedPayload: { cacheKey: string; data: CachePayload; cachedAt: number } | null = null;
let cachedLogin: { jwt: string; userId: number; expiresAt: number } | null = null;
let cachedItemMeta: { items: Record<number, { name: string; iconUrl?: string }>; cachedAt: number } | null = null;

const sampleFlips: OsrsFlip[] = [
  {
    id: "sample-ely",
    accountId: 1,
    accountName: "Setup required",
    itemId: 12817,
    itemName: "Elysian spirit shield",
    itemIconUrl: "https://oldschool.runescape.wiki/w/Special:Redirect/file/Elysian%20spirit%20shield.png",
    openedTime: 1780317000,
    openedQuantity: 1,
    spent: 861_250_000,
    closedTime: 1780324200,
    closedQuantity: 1,
    receivedPostTax: 872_400_000,
    profit: 11_150_000,
    taxPaid: 8_800_000,
    status: "FINISHED",
    updatedTime: 1780324200,
    deleted: false,
    portfolioId: 0,
    seqNo: 1,
    userId: 0
  },
  {
    id: "sample-shadow",
    accountId: 1,
    accountName: "Setup required",
    itemId: 27277,
    itemName: "Tumeken's shadow",
    itemIconUrl: "https://oldschool.runescape.wiki/w/Special:Redirect/file/Tumeken%27s%20shadow.png",
    openedTime: 1780311000,
    openedQuantity: 1,
    spent: 1_401_000_000,
    closedTime: 0,
    closedQuantity: 0,
    receivedPostTax: 0,
    profit: 0,
    taxPaid: 0,
    status: "SELLING",
    updatedTime: 1780325000,
    deleted: false,
    portfolioId: 0,
    seqNo: 2,
    userId: 0
  }
];

function summarize(flips: OsrsFlip[]): OsrsFlipSummary {
  const tracked = flips.filter((flip) => !flip.deleted);
  const finished = tracked.filter((flip) => flip.status === "FINISHED");
  const totalProfit = finished.reduce((sum, flip) => sum + flip.profit, 0);
  const totalGross = finished.reduce((sum, flip) => sum + flip.spent, 0);
  const taxPaid = finished.reduce((sum, flip) => sum + flip.taxPaid, 0);

  return {
    totalProfit,
    totalGross,
    taxPaid,
    flipsMade: finished.length,
    activeFlips: tracked.filter((flip) => flip.status !== "FINISHED").length,
    biggestWin: finished.reduce((max, flip) => Math.max(max, flip.profit), 0),
    biggestLoss: finished.reduce((min, flip) => Math.min(min, flip.profit), 0),
    roi: totalGross > 0 ? totalProfit / totalGross : 0,
    lastUpdated: new Date().toISOString()
  };
}

function buildSamplePayload(): CachePayload {
  return {
    accounts: { "Setup required": 1 },
    flips: sampleFlips,
    summary: summarize(sampleFlips)
  };
}

class ProtoReader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get done() {
    return this.offset >= this.bytes.length;
  }

  readVarint(): number {
    let result = 0;
    let shift = 0;

    while (this.offset < this.bytes.length) {
      const byte = this.bytes[this.offset++];
      result += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7;
    }

    throw new Error("Unexpected end of protobuf varint");
  }

  readBytes(length: number) {
    const end = this.offset + length;
    if (end > this.bytes.length) throw new Error("Unexpected end of protobuf bytes");
    const value = this.bytes.slice(this.offset, end);
    this.offset = end;
    return value;
  }

  readString(length: number) {
    return new TextDecoder().decode(this.readBytes(length));
  }

  skip(wireType: number) {
    if (wireType === 0) {
      this.readVarint();
      return;
    }
    if (wireType === 1) {
      this.readBytes(8);
      return;
    }
    if (wireType === 2) {
      this.readBytes(this.readVarint());
      return;
    }
    if (wireType === 5) {
      this.readBytes(4);
      return;
    }
    throw new Error(`Unsupported protobuf wire type ${wireType}`);
  }
}

function bytesToUuid(bytes: Uint8Array) {
  if (bytes.length !== 16) return null;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function statusFromValue(value: string): FlipStatus {
  if (value.toUpperCase() === "F") return "FINISHED";
  if (value.toUpperCase() === "C") return "SELLING";
  return "BUYING";
}

function decodeFlip(bytes: Uint8Array, accountNamesById: Record<number, string>): OsrsFlip {
  const reader = new ProtoReader(bytes);
  const flip: OsrsFlip = {
    id: null,
    accountId: 0,
    accountName: "Unknown",
    itemId: 0,
    itemName: "Unknown item",
    itemIconUrl: "",
    openedTime: 0,
    openedQuantity: 0,
    spent: 0,
    closedTime: 0,
    closedQuantity: 0,
    receivedPostTax: 0,
    profit: 0,
    taxPaid: 0,
    status: "BUYING",
    updatedTime: 0,
    deleted: false,
    portfolioId: 0,
    seqNo: 0,
    userId: 0
  };
  let closedFlag = false;

  while (!reader.done) {
    const tag = reader.readVarint();
    if (tag === 0) break;
    const field = tag >> 3;
    const wireType = tag & 7;

    switch (field) {
      case 1:
        flip.id = bytesToUuid(reader.readBytes(reader.readVarint()));
        break;
      case 2:
        flip.accountId = reader.readVarint();
        flip.accountName = accountNamesById[flip.accountId] || "Unknown";
        break;
      case 3:
        flip.itemId = reader.readVarint();
        break;
      case 4:
        flip.itemName = reader.readString(reader.readVarint()) || "Unknown item";
        break;
      case 5:
        flip.openedTime = reader.readVarint();
        break;
      case 6:
        flip.openedQuantity = reader.readVarint();
        break;
      case 7:
        flip.spent = reader.readVarint();
        break;
      case 8:
        flip.closedTime = reader.readVarint();
        break;
      case 9:
        flip.closedQuantity = reader.readVarint();
        break;
      case 10:
        flip.receivedPostTax = reader.readVarint();
        break;
      case 11:
        flip.taxPaid = reader.readVarint();
        break;
      case 12:
        flip.profit = reader.readVarint();
        break;
      case 13:
        closedFlag = reader.readVarint() === 1;
        break;
      case 14:
        flip.status = statusFromValue(reader.readString(reader.readVarint()));
        break;
      case 16:
        flip.updatedTime = reader.readVarint();
        break;
      case 17:
        flip.deleted = reader.readVarint() === 1;
        break;
      case 19:
        flip.portfolioId = reader.readVarint();
        break;
      case 20:
        flip.seqNo = reader.readVarint();
        break;
      case 21:
        flip.userId = reader.readVarint();
        break;
      default:
        reader.skip(wireType);
    }
  }

  if (flip.status === "BUYING" && closedFlag) flip.status = "FINISHED";
  return flip;
}

function decodeFlipsDelta(bytes: Uint8Array, accountNamesById: Record<number, string>) {
  const reader = new ProtoReader(bytes);
  const flips: OsrsFlip[] = [];
  let time = 0;

  while (!reader.done) {
    const tag = reader.readVarint();
    if (tag === 0) break;
    const field = tag >> 3;
    const wireType = tag & 7;

    if (field === 1) {
      time = reader.readVarint();
    } else if (field === 2) {
      flips.push(decodeFlip(reader.readBytes(reader.readVarint()), accountNamesById));
    } else {
      reader.skip(wireType);
    }
  }

  return { time, flips };
}

function wikiFileUrl(icon: string) {
  return `https://oldschool.runescape.wiki/w/Special:Redirect/file/${encodeURIComponent(icon)}`;
}

async function getItemMetaById() {
  const now = Date.now();
  if (cachedItemMeta && now - cachedItemMeta.cachedAt < 24 * 60 * 60 * 1000) {
    return cachedItemMeta.items;
  }

  const response = await fetch(OSRS_WIKI_MAPPING_URL, {
    headers: {
      "User-Agent": "HMG-Intranet OSRS flipping dashboard - item name lookup"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to load OSRS item mapping: ${response.status}`);
  }

  const mapping = await response.json();
  const items = Object.fromEntries(
    (Array.isArray(mapping) ? mapping : [])
      .filter((item: any) => Number.isFinite(item?.id) && typeof item?.name === "string")
      .map((item: any) => [
        item.id,
        {
          name: item.name,
          iconUrl: typeof item?.icon === "string" ? wikiFileUrl(item.icon) : undefined
        }
      ])
  );

  cachedItemMeta = { items, cachedAt: now };
  return items;
}

async function fillItemMeta(flips: OsrsFlip[]) {
  const needsMeta = flips.some((flip) => !flip.itemName || flip.itemName === "Unknown item" || !flip.itemIconUrl);
  if (!needsMeta) return flips;

  try {
    const itemMeta = await getItemMetaById();
    return flips.map((flip) => ({
      ...flip,
      itemName: flip.itemName && flip.itemName !== "Unknown item"
        ? flip.itemName
        : itemMeta[flip.itemId]?.name || `Item #${flip.itemId}`,
      itemIconUrl: flip.itemIconUrl || itemMeta[flip.itemId]?.iconUrl || ""
    }));
  } catch (error) {
    console.warn("Unable to enrich OSRS item metadata", error);
    return flips.map((flip) => ({
      ...flip,
      itemName: flip.itemName && flip.itemName !== "Unknown item" ? flip.itemName : `Item #${flip.itemId}`,
      itemIconUrl: flip.itemIconUrl || ""
    }));
  }
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.text();
  if (!response.ok) {
    let message = body;
    try {
      message = JSON.parse(body).message || body;
    } catch {
      // Keep the raw body.
    }
    throw new Error(message || `Flipping Copilot returned ${response.status}`);
  }
  return body ? JSON.parse(body) : {};
}

function readCookie(req: VercelRequest, name: string) {
  const rawCookie = req.headers.cookie || "";
  const cookie = rawCookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!cookie) return "";
  return decodeURIComponent(cookie.slice(name.length + 1));
}

async function getLogin(req: VercelRequest) {
  const jwtFromCookie = readCookie(req, COOKIE_NAME);
  if (jwtFromCookie) {
    return { jwt: jwtFromCookie, userId: Number(readCookie(req, USER_ID_COOKIE_NAME) || 0) };
  }

  const jwtFromEnv = process.env.FLIPPING_COPILOT_JWT;
  if (jwtFromEnv) {
    return { jwt: jwtFromEnv, userId: Number(process.env.FLIPPING_COPILOT_USER_ID || 0) };
  }

  const email = process.env.FLIPPING_COPILOT_EMAIL;
  const password = process.env.FLIPPING_COPILOT_PASSWORD;
  if (!email || !password) {
    throw new Error("Set FLIPPING_COPILOT_EMAIL and FLIPPING_COPILOT_PASSWORD to enable live flip tracking.");
  }

  if (cachedLogin && cachedLogin.expiresAt > Date.now()) return cachedLogin;

  const token = Buffer.from(`${email}:${password}`).toString("base64");
  const login = await requestJson(`${API_HOST}/login`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json"
    },
    body: ""
  });

  cachedLogin = {
    jwt: login.jwt,
    userId: login.user_id,
    expiresAt: Date.now() + 30 * 60 * 1000
  };
  return cachedLogin;
}

function getCacheKey(req: VercelRequest) {
  return readCookie(req, COOKIE_NAME)
    || process.env.FLIPPING_COPILOT_JWT
    || process.env.FLIPPING_COPILOT_EMAIL
    || "";
}

async function fetchLivePayload(req: VercelRequest): Promise<CachePayload> {
  const login = await getLogin(req);
  const authHeader = { Authorization: `Bearer ${login.jwt}` };
  const accounts = await requestJson(`${API_HOST}/profit-tracking/rs-account-names`, {
    method: "GET",
    headers: authHeader
  });
  const accountEntries = Object.entries(accounts || {}) as [string, number][];
  const accountNamesById = Object.fromEntries(accountEntries.map(([name, id]) => [id, name]));
  const account_id_time = Object.fromEntries(accountEntries.map(([, id]) => [id, 0]));

  const response = await fetch(`${API_HOST}/profit-tracking/client-flips-delta`, {
    method: "POST",
    headers: {
      ...authHeader,
      Accept: "application/protobuf",
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({ account_id_time })
  });

  if (!response.ok) {
    throw new Error(`Failed to load flips: ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const decoded = decodeFlipsDelta(bytes, accountNamesById);
  const flips = (await fillItemMeta(decoded.flips))
    .sort((a, b) => (b.updatedTime || b.closedTime || b.openedTime) - (a.updatedTime || a.closedTime || a.openedTime));

  return {
    accounts,
    flips,
    summary: summarize(flips)
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const cacheKey = getCacheKey(req);

  try {
    const now = Date.now();
    if (cachedPayload && cachedPayload.cacheKey === cacheKey && now - cachedPayload.cachedAt < CACHE_MS) {
      return res.json({ success: true, data: cachedPayload.data, cached: true, setupRequired: false });
    }

    const payload = await fetchLivePayload(req);
    cachedPayload = { cacheKey, data: payload, cachedAt: now };
    return res.json({ success: true, data: payload, cached: false, setupRequired: false });
  } catch (error: any) {
    console.error("Error in /api/osrs-flips:", error.message || error);
    if (cachedPayload && cachedPayload.cacheKey === cacheKey && cacheKey) {
      return res.json({ success: true, data: cachedPayload.data, cached: true, setupRequired: false, warning: error.message });
    }
    return res.json({ success: true, data: buildSamplePayload(), cached: false, setupRequired: true, warning: error.message });
  }
}
