import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import {
  ArrowLeft,
  BarChart3,
  Camera,
  Coins,
  ExternalLink,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet
} from "lucide-react";

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

interface OsrsFlipPayload {
  accounts: Record<string, number>;
  flips: OsrsFlip[];
  summary: OsrsFlipSummary;
}

interface ApiResponse {
  success: boolean;
  data: OsrsFlipPayload;
  setupRequired?: boolean;
  warning?: string;
}

const wholeNumber = new Intl.NumberFormat("en-GB");
const chartColors = ["#22c55e", "#38bdf8", "#a78bfa", "#f59e0b", "#fb7185", "#2dd4bf"];
const chartProfitColor = "#22c55e";
const chartLossColor = "#fb7185";
const chartFlatColor = "#94a3b8";
const timeframes = [
  { id: "hour", label: "Hour", seconds: 60 * 60 },
  { id: "day", label: "Day", seconds: 60 * 60 * 24 },
  { id: "week", label: "Week", seconds: 60 * 60 * 24 * 7 },
  { id: "month", label: "Month", seconds: 60 * 60 * 24 * 31 },
  { id: "year", label: "Year", seconds: 60 * 60 * 24 * 365 },
  { id: "all", label: "All", seconds: 0 }
] as const;

type TimeframeId = typeof timeframes[number]["id"];
type GraphMode = "combined" | "individual";

function formatCompactNumber(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(abs / 1_000_000)
      .toFixed(3)
      .replace(/\.?0+$/, "")}m`;
  }
  if (abs >= 10_000) return `${wholeNumber.format(Math.round(abs / 1_000))}k`;
  if (abs >= 1_000) return `${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return wholeNumber.format(abs);
}

function formatGp(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCompactNumber(value)} gp`;
}

function formatExactGp(value: number) {
  return `${wholeNumber.format(value)} gp`;
}

function formatAxisGp(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${formatCompactNumber(value)} gp`;
}

function formatTime(epochSeconds: number) {
  if (!epochSeconds) return "Open";
  return new Date(epochSeconds * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatShortTime(epochSeconds: number) {
  if (!epochSeconds) return "Open";
  return new Date(epochSeconds * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short"
  });
}

function buyPriceEach(flip: OsrsFlip) {
  return flip.openedQuantity > 0 ? Math.round(flip.spent / flip.openedQuantity) : 0;
}

function sellPriceEach(flip: OsrsFlip) {
  return flip.closedQuantity > 0 ? Math.round((flip.receivedPostTax + flip.taxPaid) / flip.closedQuantity) : 0;
}

function statusClass(status: FlipStatus) {
  if (status === "FINISHED") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (status === "SELLING") return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  return "border-amber-500/20 bg-amber-500/10 text-amber-300";
}

function summarizeFlips(flips: OsrsFlip[]): OsrsFlipSummary {
  const finished = flips.filter((flip) => !flip.deleted && flip.status === "FINISHED");
  const totalProfit = finished.reduce((sum, flip) => sum + flip.profit, 0);
  const totalGross = finished.reduce((sum, flip) => sum + flip.spent, 0);
  const taxPaid = finished.reduce((sum, flip) => sum + flip.taxPaid, 0);

  return {
    totalProfit,
    totalGross,
    taxPaid,
    flipsMade: finished.length,
    activeFlips: flips.filter((flip) => !flip.deleted && flip.status !== "FINISHED").length,
    biggestWin: finished.reduce((max, flip) => Math.max(max, flip.profit), 0),
    biggestLoss: finished.reduce((min, flip) => Math.min(min, flip.profit), 0),
    roi: totalGross > 0 ? totalProfit / totalGross : 0,
    lastUpdated: new Date().toISOString()
  };
}

const sampleFlips: OsrsFlip[] = [
  {
    id: "sample-1",
    accountId: 1,
    accountName: "Main",
    itemId: 12817,
    itemName: "Elysian spirit shield",
    itemIconUrl: "https://oldschool.runescape.wiki/w/Special:Redirect/file/Elysian%20spirit%20shield.png",
    openedTime: 1780317000,
    openedQuantity: 1,
    spent: 861250000,
    closedTime: 1780324200,
    closedQuantity: 1,
    receivedPostTax: 872400000,
    profit: 11150000,
    taxPaid: 8800000,
    status: "FINISHED",
    updatedTime: 1780324200,
    deleted: false
  },
  {
    id: "sample-2",
    accountId: 1,
    accountName: "Main",
    itemId: 27277,
    itemName: "Tumeken's shadow",
    itemIconUrl: "https://oldschool.runescape.wiki/w/Special:Redirect/file/Tumeken%27s%20shadow.png",
    openedTime: 1780311000,
    openedQuantity: 1,
    spent: 1401000000,
    closedTime: 0,
    closedQuantity: 0,
    receivedPostTax: 0,
    profit: 0,
    taxPaid: 0,
    status: "SELLING",
    updatedTime: 1780325000,
    deleted: false
  },
  {
    id: "sample-3",
    accountId: 2,
    accountName: "Alt",
    itemId: 26382,
    itemName: "Torva platebody",
    itemIconUrl: "https://oldschool.runescape.wiki/w/Special:Redirect/file/Torva%20platebody.png",
    openedTime: 1780309000,
    openedQuantity: 1,
    spent: 487000000,
    closedTime: 1780312600,
    closedQuantity: 1,
    receivedPostTax: 492850000,
    profit: 5850000,
    taxPaid: 4970000,
    status: "FINISHED",
    updatedTime: 1780312600,
    deleted: false
  },
  {
    id: "sample-4",
    accountId: 2,
    accountName: "Alt",
    itemId: 21006,
    itemName: "Kodai wand",
    itemIconUrl: "https://oldschool.runescape.wiki/w/Special:Redirect/file/Kodai%20wand.png",
    openedTime: 1780299000,
    openedQuantity: 2,
    spent: 162400000,
    closedTime: 1780302600,
    closedQuantity: 2,
    receivedPostTax: 160180000,
    profit: -2220000,
    taxPaid: 1620000,
    status: "FINISHED",
    updatedTime: 1780302600,
    deleted: false
  }
];

const samplePayload: OsrsFlipPayload = {
  accounts: { Main: 1, Alt: 2 },
  flips: sampleFlips,
  summary: summarizeFlips(sampleFlips)
};

function profitClass(value: number) {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-rose-300";
  return "text-stone-300";
}

function ItemIcon({ src, name, className = "w-9 h-9" }: { src?: string; name: string; className?: string }) {
  return (
    <div className={`${className} shrink-0 rounded-lg border border-[#3f4147]/30 bg-[#0b0f16] flex items-center justify-center overflow-hidden`}>
      {src ? (
        <img
          src={src}
          alt=""
          className="max-w-[78%] max-h-[78%] object-contain image-rendering-auto"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="text-[10px] font-mono text-stone-500">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}

function aggregateBy<T extends string | number>(flips: OsrsFlip[], key: (flip: OsrsFlip) => T) {
  const map = new Map<T, { key: T; label: string; iconUrl?: string; profit: number; flips: number; quantity: number }>();
  for (const flip of flips) {
    if (flip.deleted || flip.status !== "FINISHED") continue;
    const groupKey = key(flip);
    const existing = map.get(groupKey) || {
      key: groupKey,
      label: typeof groupKey === "number" ? String(groupKey) : groupKey,
      iconUrl: flip.itemIconUrl,
      profit: 0,
      flips: 0,
      quantity: 0
    };
    existing.label = typeof groupKey === "number" ? flip.itemName : String(groupKey);
    existing.iconUrl = existing.iconUrl || flip.itemIconUrl;
    existing.profit += flip.profit;
    existing.flips += 1;
    existing.quantity += flip.closedQuantity || flip.openedQuantity;
    map.set(groupKey, existing);
  }
  return [...map.values()].sort((a, b) => b.profit - a.profit);
}

function getFlipTime(flip: OsrsFlip) {
  return flip.closedTime || flip.updatedTime || flip.openedTime;
}

function buildCumulativeSeries(flips: OsrsFlip[], mode: GraphMode) {
  const finished = flips
    .filter((flip) => !flip.deleted && flip.status === "FINISHED")
    .sort((a, b) => getFlipTime(a) - getFlipTime(b));

  const groups = mode === "combined"
    ? new Map([["Combined", finished]])
    : finished.reduce((map, flip) => {
        const accountFlips = map.get(flip.accountName) || [];
        accountFlips.push(flip);
        map.set(flip.accountName, accountFlips);
        return map;
      }, new Map<string, OsrsFlip[]>());

  return [...groups.entries()].map(([name, groupFlips], index) => {
    let total = 0;
    return {
      name,
      color: chartColors[index % chartColors.length],
      points: groupFlips.map((flip) => {
        total += flip.profit;
        return {
          time: getFlipTime(flip),
          profit: total,
          flipProfit: flip.profit,
          itemName: flip.itemName,
          accountName: flip.accountName
        };
      })
    };
  }).filter((series) => series.points.length > 0);
}

function CumulativeProfitChart({
  flips,
  mode,
  svgRef,
  domainStart,
  domainEnd
}: {
  flips: OsrsFlip[];
  mode: GraphMode;
  svgRef: RefObject<SVGSVGElement | null>;
  domainStart: number;
  domainEnd: number;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    chartX: number;
    chartY: number;
    color: string;
    itemName: string;
    accountName: string;
    seriesName: string;
    time: number;
    flipProfit: number;
    cumulativeProfit: number;
  } | null>(null);
  const series = useMemo(() => buildCumulativeSeries(flips, mode), [flips, mode]);
  const allPoints = series.flatMap((item) => item.points);
  const width = 1100;
  const height = 360;
  const pad = { top: 36, right: 34, bottom: 48, left: 126 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const minTime = domainStart;
  const maxTime = Math.max(domainEnd, domainStart + 1);
  const minProfit = Math.min(0, ...allPoints.map((point) => point.profit));
  const maxProfit = Math.max(1, ...allPoints.map((point) => point.profit));
  const profitRange = Math.max(1, maxProfit - minProfit);
  const timeRange = Math.max(1, maxTime - minTime);
  const toX = (time: number) => pad.left + ((time - minTime) / timeRange) * plotWidth;
  const toY = (profit: number) => pad.top + plotHeight - ((profit - minProfit) / profitRange) * plotHeight;
  const zeroY = toY(0);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => minProfit + profitRange * ratio);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => minTime + timeRange * ratio);
  const rangeLabel = `${new Date(minTime * 1000).toLocaleDateString("en-GB", { month: "short", day: "2-digit" })} - ${new Date(maxTime * 1000).toLocaleDateString("en-GB", { month: "short", day: "2-digit" })}`;
  const segmentTone = (profit: number) => (profit > 0 ? chartProfitColor : profit < 0 ? chartLossColor : chartFlatColor);
  const showTooltip = (
    event: ReactMouseEvent<SVGRectElement>
  ) => {
    const svg = svgRef.current;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!svg || !rect || !allPoints.length) return;

    const svgRect = svg.getBoundingClientRect();
    const svgX = ((event.clientX - svgRect.left) / svgRect.width) * width;
    const hoverTime = minTime + ((Math.min(Math.max(svgX, pad.left), width - pad.right) - pad.left) / plotWidth) * timeRange;
    let nearest = { point: allPoints[0], distance: Math.abs(allPoints[0].time - hoverTime), seriesName: series[0]?.name || "Combined" };

    for (const item of series) {
      for (const point of item.points) {
        const distance = Math.abs(point.time - hoverTime);
        if (distance < nearest.distance) {
          nearest = { point, distance, seriesName: item.name };
        }
      }
    }

    const localX = rect ? event.clientX - rect.left : event.clientX;
    const localY = rect ? event.clientY - rect.top : event.clientY;
    const maxX = Math.max(8, (rect?.width || 600) - 278);
    setTooltip({
      x: Math.min(Math.max(localX + 14, 8), maxX),
      y: Math.max(localY - 112, 8),
      chartX: toX(nearest.point.time),
      chartY: toY(nearest.point.profit),
      color: segmentTone(nearest.point.flipProfit),
      itemName: nearest.point.itemName,
      accountName: nearest.point.accountName,
      seriesName: nearest.seriesName,
      time: nearest.point.time,
      flipProfit: nearest.point.flipProfit,
      cumulativeProfit: nearest.point.profit
    });
  };

  return (
    <div ref={wrapperRef} className="relative overflow-x-auto rounded-xl border border-[#1e1f22] bg-[#0b0f16]/60">
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="min-w-[780px] w-full h-auto" role="img" aria-label="Cumulative profit over time">
        <defs>
          <linearGradient id="osrsChartBackground" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#111827" />
            <stop offset="100%" stopColor="#070b12" />
          </linearGradient>
          <filter id="osrsChartGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor="#22c55e" floodOpacity="0.24" />
          </filter>
        </defs>
        <rect width={width} height={height} fill="url(#osrsChartBackground)" />
        <rect
          x={pad.left}
          y={pad.top}
          width={plotWidth}
          height={plotHeight}
          fill="#0b0f16"
          opacity="0.52"
          rx="10"
        />
        <text x={pad.left} y={28} fill="#ffffff" fontSize="17" fontWeight="800">Cumulative Profit Over Time</text>
        <text x={width - pad.right} y={28} fill="#94a3b8" fontSize="11" fontFamily="monospace" textAnchor="end">{rangeLabel}</text>
        {yTicks.map((tick) => {
          const y = toY(tick);
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#223047" strokeDasharray="4 7" opacity="0.72" />
              <text x={pad.left - 12} y={y + 4} fill="#a9bdd6" fontSize="12" fontFamily="monospace" textAnchor="end">{formatAxisGp(tick)}</text>
            </g>
          );
        })}
        {xTicks.map((tick) => {
          const x = toX(tick);
          return (
            <g key={tick}>
              <line x1={x} x2={x} y1={pad.top} y2={height - pad.bottom} stroke="#1c2a40" strokeDasharray="3 7" opacity="0.58" />
              <text x={x} y={height - 18} fill="#8da0b6" fontSize="11" fontFamily="monospace" textAnchor="middle">
                {new Date(tick * 1000).toLocaleDateString("en-GB", { month: "short", day: "2-digit" })}
              </text>
            </g>
          );
        })}
        <line x1={pad.left} x2={width - pad.right} y1={zeroY} y2={zeroY} stroke="#64748b" strokeWidth="1.2" opacity="0.8" />
        <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke="#64748b" strokeWidth="1.2" opacity="0.72" />
        {series.map((item) => {
          let previousProfit = 0;
          return (
            <g key={item.name}>
              {item.points.map((point, index) => {
                const startTime = index === 0 ? minTime : item.points[index - 1].time;
                const startProfit = index === 0 ? 0 : previousProfit;
                previousProfit = point.profit;
                const startX = toX(startTime);
                const endX = toX(point.time);
                const startY = toY(startProfit);
                const endY = toY(point.profit);
                const segmentColor = segmentTone(point.flipProfit);
                return (
                  <g key={`${item.name}-${point.time}-${point.profit}`}>
                    <path
                      d={`M ${startX.toFixed(2)} ${zeroY.toFixed(2)} L ${startX.toFixed(2)} ${startY.toFixed(2)} L ${endX.toFixed(2)} ${endY.toFixed(2)} L ${endX.toFixed(2)} ${zeroY.toFixed(2)} Z`}
                      fill={segmentColor}
                      opacity={mode === "individual" ? 0.07 : 0.11}
                    />
                    <path
                      d={`M ${startX.toFixed(2)} ${startY.toFixed(2)} L ${endX.toFixed(2)} ${endY.toFixed(2)}`}
                      fill="none"
                      stroke={segmentColor}
                      strokeWidth={mode === "individual" ? 3 : 4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      filter={mode === "combined" && point.flipProfit > 0 ? "url(#osrsChartGlow)" : undefined}
                      opacity={mode === "individual" ? 0.9 : 1}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
        {tooltip && (
          <g pointerEvents="none">
            <line
              x1={tooltip.chartX}
              x2={tooltip.chartX}
              y1={pad.top}
              y2={height - pad.bottom}
              stroke="#cbd5e1"
              strokeDasharray="3 6"
              opacity="0.34"
            />
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={tooltip.chartY}
              y2={tooltip.chartY}
              stroke="#cbd5e1"
              strokeDasharray="3 6"
              opacity="0.22"
            />
            <circle cx={tooltip.chartX} cy={tooltip.chartY} r="6.5" fill="#0b0f16" stroke={tooltip.color} strokeWidth="2.4" />
            <circle cx={tooltip.chartX} cy={tooltip.chartY} r="2.5" fill={tooltip.color} />
          </g>
        )}
        <rect
          x={pad.left}
          y={pad.top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          className="cursor-crosshair"
          onMouseMove={showTooltip}
          onMouseEnter={showTooltip}
          onMouseLeave={() => setTooltip(null)}
        />
        {series.length === 0 && (
          <text x={width / 2} y={height / 2} fill="#64748b" fontSize="14" fontFamily="monospace" textAnchor="middle">No finished flips in this time window</text>
        )}
      </svg>
      {tooltip && (
        <div
          className="absolute z-20 w-64 rounded-xl border border-emerald-500/25 bg-[#0b0f16]/95 p-3 text-xs shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y
          }}
        >
          <div className="text-white font-black truncate">{tooltip.itemName}</div>
          <div className="mt-0.5 text-[10px] text-stone-400 font-mono">
            {tooltip.seriesName !== "Combined" ? `${tooltip.accountName} / ` : ""}{formatTime(tooltip.time)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-stone-500 font-mono">Flip</div>
              <div className={`font-mono font-bold ${profitClass(tooltip.flipProfit)}`}>{formatExactGp(tooltip.flipProfit)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-stone-500 font-mono">Total</div>
              <div className={`font-mono font-bold ${profitClass(tooltip.cumulativeProfit)}`}>{formatExactGp(tooltip.cumulativeProfit)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "neutral"
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: "green" | "red" | "blue" | "neutral";
}) {
  const toneClass = {
    green: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    red: "text-rose-300 bg-rose-500/10 border-rose-500/20",
    blue: "text-sky-300 bg-sky-500/10 border-sky-500/20",
    neutral: "text-[#5865F2] bg-[#5865F2]/10 border-[#5865F2]/25"
  }[tone];

  return (
    <div className="bg-[#2b2d31] border border-[#1e1f22]/95 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${toneClass}`}>{icon}</div>
        <span className="text-[9px] font-mono uppercase tracking-widest text-stone-500 font-bold">{label}</span>
      </div>
      <div className="mt-4 text-xl font-black text-white tracking-tight">{value}</div>
      <div className="mt-1 text-[10px] text-stone-400 font-mono">{detail}</div>
    </div>
  );
}

function FlipMovementCard({ label, flip, tone }: { label: string; flip?: OsrsFlip; tone: "green" | "red" }) {
  const isGreen = tone === "green";
  return (
    <div className="bg-[#1e1f22]/55 border border-[#3f4147]/25 rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <ItemIcon src={flip?.itemIconUrl} name={flip?.itemName || label} className="w-11 h-11" />
          <div className="min-w-0">
            <span className="text-[9px] uppercase font-mono tracking-widest text-stone-500 font-bold">{label}</span>
            <div className="text-sm font-black text-white truncate">{flip?.itemName || "No finished flips"}</div>
            {flip && <div className="text-[10px] text-stone-500 font-mono">{flip.accountName} / {formatShortTime(getFlipTime(flip))}</div>}
          </div>
        </div>
        <div className={`text-right text-sm font-mono font-black shrink-0 ${isGreen ? "text-emerald-300" : "text-rose-300"}`}>
          {flip ? formatGp(flip.profit) : "--"}
        </div>
      </div>
      {flip && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-mono">
          <div className="rounded-lg bg-[#0b0f16]/70 border border-[#3f4147]/20 p-2">
            <div className="text-stone-500 uppercase tracking-wider">Buy ea</div>
            <div className="text-stone-200 font-bold mt-0.5">{formatExactGp(buyPriceEach(flip))}</div>
          </div>
          <div className="rounded-lg bg-[#0b0f16]/70 border border-[#3f4147]/20 p-2">
            <div className="text-stone-500 uppercase tracking-wider">Sell ea</div>
            <div className="text-stone-200 font-bold mt-0.5">{flip.closedQuantity ? formatExactGp(sellPriceEach(flip)) : "Open"}</div>
          </div>
          <div className="rounded-lg bg-[#0b0f16]/70 border border-[#3f4147]/20 p-2">
            <div className="text-stone-500 uppercase tracking-wider">Qty</div>
            <div className="text-stone-200 font-bold mt-0.5">{wholeNumber.format(flip.closedQuantity || flip.openedQuantity)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OsrsFlipsPage({ onBackHome }: { onBackHome: () => void }) {
  const chartRef = useRef<SVGSVGElement | null>(null);
  const [payload, setPayload] = useState<OsrsFlipPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [warning, setWarning] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [timeframe, setTimeframe] = useState<TimeframeId>("month");
  const [graphMode, setGraphMode] = useState<GraphMode>("combined");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const loadFlips = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/osrs-flips", { cache: "no-store", credentials: "include" });
      const data = (await response.json()) as ApiResponse;
      setPayload(data.data);
      setSetupRequired(Boolean(data.setupRequired));
      setWarning(data.warning || "");
    } catch (error: any) {
      setPayload(samplePayload);
      setSetupRequired(true);
      const message = error.message || "Unable to load flips";
      setWarning(message.includes("Unexpected token")
        ? "Preview mode is using example flips. Live data will appear here after you connect on the deployed site."
        : message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    try {
      const response = await fetch("/api/osrs-flips-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Flipping Copilot login failed.");
      }

      setLoginPassword("");
      setSetupRequired(false);
      setWarning("");
      await loadFlips();
    } catch (error: any) {
      setLoginError(error.message || "Flipping Copilot login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/osrs-flips-session", { method: "DELETE", credentials: "include" });
    setPayload(samplePayload);
    setSetupRequired(true);
    setWarning("Disconnected from Flipping Copilot. Sign in again to load live flips.");
  };

  const downloadChartJpeg = async () => {
    if (!chartRef.current) return;

    const svg = chartRef.current;
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 520;
      const context = canvas.getContext("2d");
      if (!context) return;

      context.fillStyle = "#0b0f16";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const link = document.createElement("a");
      link.download = `osrs-flip-profit-${timeframe}-${graphMode}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.94);
      link.click();
    };

    image.src = url;
  };

  useEffect(() => {
    loadFlips();
  }, []);

  const flips = payload?.flips || [];
  const visibleFlips = accountFilter === "all" ? flips : flips.filter((flip) => flip.accountName === accountFilter);
  const timelineDomain = useMemo(() => {
    const selected = timeframes.find((item) => item.id === timeframe);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const flipTimes = visibleFlips.map((flip) => getFlipTime(flip)).filter((time) => time > 0);

    if (!selected || selected.id === "all") {
      const domainStart = flipTimes.length ? Math.min(...flipTimes) : nowSeconds - 60 * 60 * 24 * 30;
      const domainEnd = Math.max(nowSeconds, ...(flipTimes.length ? flipTimes : [nowSeconds]));
      return { domainStart, domainEnd };
    }

    return {
      domainStart: nowSeconds - selected.seconds,
      domainEnd: nowSeconds
    };
  }, [timeframe, visibleFlips]);
  const timelineFlips = useMemo(() => {
    const selected = timeframes.find((item) => item.id === timeframe);
    if (!selected || selected.id === "all") return visibleFlips;
    return visibleFlips.filter((flip) => {
      const flipTime = getFlipTime(flip);
      return flipTime >= timelineDomain.domainStart && flipTime <= timelineDomain.domainEnd;
    });
  }, [timeframe, timelineDomain, visibleFlips]);
  const summary = useMemo(() => {
    if (!payload) return undefined;
    const filtered = timelineFlips.filter((flip) => !flip.deleted && flip.status === "FINISHED");
    const totalProfit = filtered.reduce((sum, flip) => sum + flip.profit, 0);
    const totalGross = filtered.reduce((sum, flip) => sum + flip.spent, 0);
    const taxPaid = filtered.reduce((sum, flip) => sum + flip.taxPaid, 0);
    return {
      totalProfit,
      totalGross,
      taxPaid,
      flipsMade: filtered.length,
      activeFlips: timelineFlips.filter((flip) => !flip.deleted && flip.status !== "FINISHED").length,
      biggestWin: filtered.reduce((max, flip) => Math.max(max, flip.profit), 0),
      biggestLoss: filtered.reduce((min, flip) => Math.min(min, flip.profit), 0),
      roi: totalGross > 0 ? totalProfit / totalGross : 0,
      lastUpdated: payload?.summary.lastUpdated || new Date().toISOString()
    };
  }, [payload, timelineFlips]);

  const finishedFlips = timelineFlips.filter((flip) => !flip.deleted && flip.status === "FINISHED");
  const biggestWinFlip = finishedFlips.reduce<OsrsFlip | undefined>((best, flip) => !best || flip.profit > best.profit ? flip : best, undefined);
  const biggestLossFlip = finishedFlips.reduce<OsrsFlip | undefined>((worst, flip) => !worst || flip.profit < worst.profit ? flip : worst, undefined);
  const itemLeaders = aggregateBy(timelineFlips, (flip) => flip.itemId).slice(0, 4);
  const accounts = Object.keys(payload?.accounts || {});
  const uniqueItems = new Set(timelineFlips.filter((flip) => !flip.deleted && flip.status === "FINISHED").map((flip) => flip.itemId)).size;
  const activityFlips = timelineFlips.filter((flip) => flip.status !== "BUYING");

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 w-full flex-grow flex flex-col gap-6 relative z-10">
      <section className="bg-[#2b2d31] border border-[#1e1f22]/95 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#3f4147]/20 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackHome}
              className="w-9 h-9 rounded-xl bg-[#1e1f22] border border-[#3f4147]/40 text-stone-300 hover:text-white hover:bg-[#35373c] flex items-center justify-center cursor-pointer"
              title="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-emerald-300 uppercase font-mono font-bold tracking-widest">Old School RuneScape</span>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Flipping profits</h2>
              <p className="text-xs text-stone-400 mt-0.5">Track your Grand Exchange flips from Flipping Copilot in one place.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
              className="h-9 bg-[#1e1f22] border border-[#3f4147]/40 rounded-xl px-3 text-xs text-white font-semibold focus:outline-hidden focus:border-[#5865F2]"
            >
              <option value="all">All accounts</option>
              {accounts.map((account) => (
                <option key={account} value={account}>{account}</option>
              ))}
            </select>
            <button
              onClick={loadFlips}
              disabled={isLoading}
              className="h-9 px-3 bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            {!setupRequired && (
              <button
                onClick={handleLogout}
                className="h-9 px-3 bg-[#1e1f22] border border-[#3f4147]/40 hover:border-rose-500/30 text-stone-300 hover:text-rose-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            )}
            <a
              href="https://flippingcopilot.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 bg-[#1e1f22] border border-[#3f4147]/40 hover:border-emerald-500/30 text-stone-300 hover:text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <span>Copilot</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {(setupRequired || warning) && (
          <div className="mt-4 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex flex-col gap-3">
            <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-xs text-stone-300 leading-relaxed">
              <b className="text-amber-200 block mb-0.5">{setupRequired ? "Connect Flipping Copilot" : "Showing recent saved data"}</b>
              Sign in once to sync your tracked flips into this dashboard. Your details are only used to create a private Copilot session for this intranet. {warning}
            </div>
            </div>
            {setupRequired && (
              <form onSubmit={handleLogin} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="Flipping Copilot email"
                  autoComplete="email"
                  className="h-10 bg-[#1e1f22] border border-[#3f4147]/40 rounded-xl px-3 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  className="h-10 bg-[#1e1f22] border border-[#3f4147]/40 rounded-xl px-3 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isLoggingIn || !loginEmail.trim() || !loginPassword}
                  className="h-10 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:hover:bg-emerald-500 text-stone-950 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isLoggingIn ? "Connecting" : "Connect"}</span>
                </button>
                {loginError && (
                  <div className="md:col-span-3 text-[11px] text-rose-300 font-mono">{loginError}</div>
                )}
              </form>
            )}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          icon={<Wallet className="w-4 h-4" />}
          label="Total profit"
          value={summary ? formatGp(summary.totalProfit) : "--"}
          detail={timeframes.find((item) => item.id === timeframe)?.label || "Selected window"}
          tone={summary && summary.totalProfit < 0 ? "red" : "green"}
        />
        <MetricCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Tax paid"
          value={summary ? formatGp(summary.taxPaid) : "--"}
          detail="Grand Exchange tax"
          tone={summary && summary.taxPaid > 0 ? "red" : "neutral"}
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Total flips"
          value={summary ? wholeNumber.format(summary.flipsMade) : "--"}
          detail={`${summary?.activeFlips || 0} active flips`}
          tone="blue"
        />
        <MetricCard
          icon={<TrendingDown className="w-4 h-4" />}
          label="Unique items"
          value={wholeNumber.format(uniqueItems)}
          detail={`ROI ${summary ? (summary.roi * 100).toFixed(2) : "0.00"}%`}
          tone="neutral"
        />
      </section>

      <section className="bg-[#2b2d31] border border-[#1e1f22]/95 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-4">
          <div>
            <span className="text-[10px] text-[#5865F2] uppercase font-mono font-bold tracking-widest">Overview</span>
            <h3 className="text-lg font-black text-white tracking-tight">Cumulative profit over time</h3>
            <p className="text-xs text-stone-400 mt-1">
              Shows total accumulated profit for the selected account and time window.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex flex-wrap gap-1.5 rounded-xl bg-[#1e1f22]/70 border border-[#3f4147]/30 p-1">
              {timeframes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTimeframe(item.id)}
                  className={`h-8 px-3 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    timeframe === item.id
                      ? "bg-[#5865F2] text-white"
                      : "text-stone-400 hover:text-white hover:bg-[#35373c]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 rounded-xl bg-[#1e1f22]/70 border border-[#3f4147]/30 p-1">
              <button
                onClick={() => setGraphMode("combined")}
                className={`h-8 px-3 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  graphMode === "combined" ? "bg-emerald-500 text-stone-950" : "text-stone-400 hover:text-white hover:bg-[#35373c]"
                }`}
              >
                Combined
              </button>
              <button
                onClick={() => setGraphMode("individual")}
                className={`h-8 px-3 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  graphMode === "individual" ? "bg-emerald-500 text-stone-950" : "text-stone-400 hover:text-white hover:bg-[#35373c]"
                }`}
              >
                Individual
              </button>
            </div>
            <button
              onClick={downloadChartJpeg}
              className="h-10 px-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Screenshot</span>
            </button>
          </div>
        </div>
        <CumulativeProfitChart
          flips={timelineFlips}
          mode={graphMode}
          svgRef={chartRef}
          domainStart={timelineDomain.domainStart}
          domainEnd={timelineDomain.domainEnd}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-[#2b2d31] border border-[#1e1f22]/95 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] text-[#5865F2] uppercase font-mono font-bold tracking-widest">Performance</span>
              <h3 className="text-sm font-bold text-white">Biggest movement</h3>
            </div>
            <span className="text-[10px] text-stone-500 font-mono">
              Updated {summary ? formatTime(Math.floor(new Date(summary.lastUpdated).getTime() / 1000)) : "--"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FlipMovementCard label="Biggest win" flip={biggestWinFlip} tone="green" />
            <FlipMovementCard label="Biggest loss" flip={biggestLossFlip} tone="red" />
          </div>
        </div>

        <div className="bg-[#2b2d31] border border-[#1e1f22]/95 rounded-2xl p-4 sm:p-5">
          <span className="text-[10px] text-[#5865F2] uppercase font-mono font-bold tracking-widest">Top items</span>
          <div className="mt-3 space-y-2">
            {itemLeaders.map((item) => (
              <div key={item.key} className="bg-[#1e1f22]/55 border border-[#3f4147]/25 rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ItemIcon src={item.iconUrl} name={item.label} />
                    <span className="text-xs text-white font-bold truncate">{item.label}</span>
                  </div>
                  <span className={`text-xs font-mono font-bold shrink-0 ${profitClass(item.profit)}`}>{formatGp(item.profit)}</span>
                </div>
                <div className="mt-1 text-[10px] text-stone-500 font-mono">{item.flips} flips / qty {wholeNumber.format(item.quantity)}</div>
              </div>
            ))}
            {!itemLeaders.length && <div className="text-xs text-stone-500 font-mono py-6 text-center">No item profit yet</div>}
          </div>
        </div>
      </section>

      <section>
        <div className="bg-[#2b2d31] border border-[#1e1f22]/95 rounded-2xl p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <span className="text-[10px] text-[#5865F2] uppercase font-mono font-bold tracking-widest">Flip ledger</span>
              <h3 className="text-sm font-bold text-white">Latest activity</h3>
            </div>
            <span className="text-[10px] text-stone-500 font-mono">{activityFlips.length} rows</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-[#3f4147]/30 text-[9px] uppercase font-mono tracking-widest text-stone-500">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3 text-right">Profit</th>
                  <th className="py-2 pr-3">Closed</th>
                </tr>
              </thead>
              <tbody>
                {activityFlips.slice(0, 18).map((flip) => (
                  <tr key={flip.id || `${flip.accountId}-${flip.itemId}-${flip.updatedTime}`} className="border-b border-[#3f4147]/15 text-xs">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5 min-w-[220px]">
                        <ItemIcon src={flip.itemIconUrl} name={flip.itemName} className="w-10 h-10" />
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate max-w-[220px]">{flip.itemName}</div>
                          <div className="text-[10px] text-stone-500 font-mono">#{flip.itemId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-stone-300 font-semibold">{flip.accountName}</td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex px-2 py-1 rounded-lg border text-[9px] font-mono font-bold ${statusClass(flip.status)}`}>
                        {flip.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right text-stone-300 font-mono">{wholeNumber.format(flip.closedQuantity || flip.openedQuantity)}</td>
                    <td className={`py-3 pr-3 text-right font-mono font-bold ${profitClass(flip.profit)}`}>{formatGp(flip.profit)}</td>
                    <td className="py-3 pr-3 text-stone-400 font-mono text-[11px]">{formatTime(flip.closedTime || flip.updatedTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!activityFlips.length && (
              <div className="py-12 text-center text-xs text-stone-500 font-mono">
                {isLoading ? "Loading flips..." : "No non-buying activity found for this account"}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
