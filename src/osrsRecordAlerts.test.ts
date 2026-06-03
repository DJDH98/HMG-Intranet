import assert from "node:assert/strict";
import {
  buildDiscordRecordEmbed,
  evaluateRecordAlerts,
  type OsrsRecordFlip
} from "./osrsRecordAlerts";

const baseFlip: OsrsRecordFlip = {
  id: "flip-1",
  accountName: "Main",
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
  taxPaid: 8_800_000
};

const firstRun = evaluateRecordAlerts(null, [baseFlip], new Date("2026-06-03T12:00:00.000Z"));
assert.equal(firstRun.alerts.length, 0);
assert.equal(firstRun.nextState.biggestProfit?.id, "flip-1");

const newProfitFlip: OsrsRecordFlip = {
  ...baseFlip,
  id: "flip-2",
  itemName: "Twisted bow",
  profit: 18_420_000
};

const profitRun = evaluateRecordAlerts(firstRun.nextState, [baseFlip, newProfitFlip], new Date("2026-06-03T13:00:00.000Z"));
assert.equal(profitRun.alerts.length, 1);
assert.equal(profitRun.alerts[0].kind, "profit");
assert.equal(profitRun.alerts[0].previous?.profit, 11_150_000);

const profitEmbed = buildDiscordRecordEmbed(profitRun.alerts[0]);
assert.equal(profitEmbed.embeds[0].color, 0xf1c40f);
assert.equal(profitEmbed.embeds[0].title, "PROFIT RECORD: +18,420,000 gp");
assert.equal(profitEmbed.embeds[0].description.includes("\u001b[1;33m+18,420,000 gp\u001b[0m"), true);
assert.equal(profitEmbed.embeds[0].fields[0].value, "**+18,420,000 gp**");

const lossFlip: OsrsRecordFlip = {
  ...baseFlip,
  id: "flip-3",
  itemName: "Kodai wand",
  profit: -2_220_000
};

const lossRun = evaluateRecordAlerts(profitRun.nextState, [baseFlip, newProfitFlip, lossFlip], new Date("2026-06-03T14:00:00.000Z"));
assert.equal(lossRun.alerts.length, 1);
assert.equal(lossRun.alerts[0].kind, "loss");

const lossEmbed = buildDiscordRecordEmbed(lossRun.alerts[0]);
assert.equal(lossEmbed.embeds[0].color, 0xe11d48);
assert.equal(lossEmbed.embeds[0].title, "LOSS RECORD: -2,220,000 gp");
assert.equal(lossEmbed.embeds[0].description.includes("\u001b[1;31m-2,220,000 gp\u001b[0m"), true);
assert.equal(lossEmbed.embeds[0].fields[0].value, "**-2,220,000 gp**");
