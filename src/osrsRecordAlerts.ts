import { Redis } from "@upstash/redis";

export type OsrsRecordKind = "profit" | "loss";

export interface OsrsRecordFlip {
  id: string;
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
}

export interface OsrsRecordState {
  biggestProfit?: OsrsRecordFlip;
  biggestLoss?: OsrsRecordFlip;
  updatedAt: string;
}

export interface OsrsRecordAlert {
  kind: OsrsRecordKind;
  flip: OsrsRecordFlip;
  previous?: OsrsRecordFlip;
}

export const OSRS_RECORDS_REDIS_KEY_PREFIX = "hmg:osrs:flip-records:v1";

const wholeNumber = new Intl.NumberFormat("en-GB");

export function hasOsrsRecordStoreEnv(env: NodeJS.ProcessEnv) {
  return Boolean(
    (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) ||
    (env.KV_REST_API_URL && env.KV_REST_API_TOKEN)
  );
}

export function getStableFlipId(flip: Partial<OsrsRecordFlip> & { id?: string | null }) {
  return flip.id || [
    flip.accountName || "unknown",
    flip.itemId || 0,
    flip.openedTime || 0,
    flip.closedTime || 0,
    flip.profit || 0
  ].join(":");
}

export function formatExactGp(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${wholeNumber.format(value)} gp`;
}

function formatDiscordAnsiGp(value: number) {
  const colorCode = value >= 0 ? 33 : 31;
  return `\`\`\`ansi\n\u001b[1;${colorCode}m${formatExactGp(value)}\u001b[0m\n\`\`\``;
}

export function getRecordRedisKey(cacheKeyHash: string) {
  return `${OSRS_RECORDS_REDIS_KEY_PREFIX}:${cacheKeyHash || "default"}`;
}

export function findRecordFlips(flips: OsrsRecordFlip[]) {
  const finished = flips.filter((flip) => flip.closedTime > 0);
  return {
    biggestProfit: finished.reduce<OsrsRecordFlip | undefined>((best, flip) => (
      !best || flip.profit > best.profit ? flip : best
    ), undefined),
    biggestLoss: finished.reduce<OsrsRecordFlip | undefined>((worst, flip) => (
      !worst || flip.profit < worst.profit ? flip : worst
    ), undefined)
  };
}

export function evaluateRecordAlerts(
  previousState: OsrsRecordState | null,
  flips: OsrsRecordFlip[],
  now = new Date()
) {
  const currentRecords = findRecordFlips(flips);
  const alerts: OsrsRecordAlert[] = [];
  const nextState: OsrsRecordState = {
    biggestProfit: previousState?.biggestProfit,
    biggestLoss: previousState?.biggestLoss,
    updatedAt: now.toISOString()
  };

  if (!previousState) {
    return {
      alerts,
      nextState: {
        biggestProfit: currentRecords.biggestProfit,
        biggestLoss: currentRecords.biggestLoss,
        updatedAt: now.toISOString()
      }
    };
  }

  if (
    currentRecords.biggestProfit &&
    (!previousState.biggestProfit || currentRecords.biggestProfit.profit > previousState.biggestProfit.profit) &&
    getStableFlipId(currentRecords.biggestProfit) !== getStableFlipId(previousState.biggestProfit || {})
  ) {
    alerts.push({ kind: "profit", flip: currentRecords.biggestProfit, previous: previousState.biggestProfit });
    nextState.biggestProfit = currentRecords.biggestProfit;
  }

  if (
    currentRecords.biggestLoss &&
    (!previousState.biggestLoss || currentRecords.biggestLoss.profit < previousState.biggestLoss.profit) &&
    getStableFlipId(currentRecords.biggestLoss) !== getStableFlipId(previousState.biggestLoss || {})
  ) {
    alerts.push({ kind: "loss", flip: currentRecords.biggestLoss, previous: previousState.biggestLoss });
    nextState.biggestLoss = currentRecords.biggestLoss;
  }

  return { alerts, nextState };
}

export function buildDiscordRecordEmbed(alert: OsrsRecordAlert) {
  const isProfit = alert.kind === "profit";
  const flip = alert.flip;
  const quantity = flip.closedQuantity || flip.openedQuantity || 0;
  const buyEach = flip.openedQuantity > 0 ? Math.round(flip.spent / flip.openedQuantity) : 0;
  const sellEach = flip.closedQuantity > 0 ? Math.round((flip.receivedPostTax + flip.taxPaid) / flip.closedQuantity) : 0;
  const recordLabel = isProfit ? "PROFIT RECORD" : "LOSS RECORD";

  return {
    username: "OSRS FLIP RECORD",
    embeds: [
      {
        title: `${recordLabel}: ${formatExactGp(flip.profit)}`,
        description: `**${flip.itemName}**\n${formatDiscordAnsiGp(flip.profit)}`,
        color: isProfit ? 0xf1c40f : 0xe11d48,
        thumbnail: flip.itemIconUrl ? { url: flip.itemIconUrl } : undefined,
        fields: [
          {
            name: isProfit ? "New biggest profit" : "New biggest loss",
            value: `**${formatExactGp(flip.profit)}**`,
            inline: false
          },
          {
            name: "Previous record",
            value: alert.previous ? formatExactGp(alert.previous.profit) : "First record",
            inline: true
          },
          {
            name: "Quantity",
            value: wholeNumber.format(quantity),
            inline: true
          },
          {
            name: "Account",
            value: flip.accountName,
            inline: true
          },
          {
            name: "Buy ea",
            value: formatExactGp(buyEach),
            inline: true
          },
          {
            name: "Sell ea",
            value: sellEach > 0 ? formatExactGp(sellEach) : "Open",
            inline: true
          },
          {
            name: "Tax paid",
            value: formatExactGp(flip.taxPaid),
            inline: true
          }
        ],
        footer: { text: "HMG Intranet OSRS flips" },
        timestamp: new Date((flip.closedTime || Date.now() / 1000) * 1000).toISOString()
      }
    ]
  };
}

export function createOsrsRecordStore(env: NodeJS.ProcessEnv = process.env) {
  if (!hasOsrsRecordStoreEnv(env)) {
    throw new Error("OSRS record store is not configured.");
  }

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN!
  });

  return {
    async getState(cacheKeyHash: string): Promise<OsrsRecordState | null> {
      const value = await redis.get(getRecordRedisKey(cacheKeyHash));
      return isRecordState(value) ? value : null;
    },
    async setState(cacheKeyHash: string, state: OsrsRecordState) {
      await redis.set(getRecordRedisKey(cacheKeyHash), state);
    }
  };
}

export async function sendDiscordRecordAlert(webhookUrl: string, alert: OsrsRecordAlert) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildDiscordRecordEmbed(alert))
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.status}`);
  }
}

function isRecordFlip(value: any): value is OsrsRecordFlip {
  return (
    typeof value?.id === "string" &&
    typeof value.accountName === "string" &&
    typeof value.itemId === "number" &&
    typeof value.itemName === "string" &&
    typeof value.openedTime === "number" &&
    typeof value.openedQuantity === "number" &&
    typeof value.spent === "number" &&
    typeof value.closedTime === "number" &&
    typeof value.closedQuantity === "number" &&
    typeof value.receivedPostTax === "number" &&
    typeof value.profit === "number" &&
    typeof value.taxPaid === "number"
  );
}

function isRecordState(value: any): value is OsrsRecordState {
  return (
    typeof value?.updatedAt === "string" &&
    (!value.biggestProfit || isRecordFlip(value.biggestProfit)) &&
    (!value.biggestLoss || isRecordFlip(value.biggestLoss))
  );
}
