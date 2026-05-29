import React, { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { NewsArticle } from "../types";

interface CategoryTileProps {
  key?: React.Key;
  category: string;
  articles: NewsArticle[];
  isExpanded: boolean;
  onToggle: () => void;
  getCategoryIcon: (cat: string) => React.ReactNode;
  getCategoryThemeColor: (cat: string) => string;
}

/**
 * CategoryTile - extracted from NewsAgent.tsx for maintainability.
 * Shows a compact rotating headline when collapsed, full list when expanded.
 */
export function CategoryTile({
  category,
  articles,
  isExpanded,
  onToggle,
  getCategoryIcon,
  getCategoryThemeColor
}: CategoryTileProps) {
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    if (isExpanded || articles.length <= 1) return;

    const interval = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % articles.length);
    }, 20000);

    return () => clearInterval(interval);
  }, [isExpanded, articles.length]);

  const activeArticle = articles[tickerIndex];

  return (
    <button
      onClick={onToggle}
      className={`relative w-full p-3 sm:p-4 border rounded-xl text-left transition-all duration-300 flex flex-col justify-between h-32 cursor-pointer select-none ${
        isExpanded
          ? "border-[#5865F2] bg-[#313338] shadow-[0_0_8px_rgba(88,101,242,0.15)]"
          : "border-[#1e1f22] bg-[#1e1f22]/40 hover:bg-[#313338]/40 hover:border-[#3f4147]/50"
      }`}
    >
      <div className="w-full">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div className={`p-1 bg-[#2b2d31] border border-[#3f4147]/40 rounded-lg shrink-0 ${getCategoryThemeColor(category)}`}>
              {getCategoryIcon(category)}
            </div>
            <span className="text-xs font-bold text-stone-200 tracking-tight">{category}</span>
          </div>
          <span className="bg-[#1e1f22] border border-[#3f4147]/30 px-1.5 py-0.5 rounded-full text-[9px] text-stone-400 font-mono">
            {articles.length}
          </span>
        </div>

        {!isExpanded ? (
          <div className="mt-2.5 overflow-hidden">
            <div className="flex items-center gap-1 font-mono text-[8px] text-[#5865F2] font-bold uppercase tracking-wider">
              <span>Auto-cycling topics</span>
              <span className="w-1 h-1 rounded-full bg-teal-400 animate-ping" />
            </div>
            <p className="text-[10px] text-stone-300 font-medium leading-tight mt-1 line-clamp-2 h-[26px] animate-[fadeIn_0.30s_ease-out]">
              {activeArticle ? activeArticle.title : "Fetching bulletins..."}
            </p>
          </div>
        ) : (
          <div className="mt-2.5">
            <div className="text-[8px] font-mono text-emerald-400 font-extrabold uppercase tracking-widest">
              List Expanded
            </div>
            <p className="text-[10px] text-stone-400 mt-1 leading-snug">
              Unfolded 6 articles below. Click to fold back.
            </p>
          </div>
        )}
      </div>

      <div className="w-full flex items-center justify-between mt-1 pt-1.5 border-t border-[#3f4147]/20 text-[8px] text-stone-500 font-mono">
        <span>{isExpanded ? "unfolded" : "click to view"}</span>
        <span className="truncate max-w-[80px]">
          {(activeArticle && activeArticle.source) || "RSS index"}
        </span>
      </div>
    </button>
  );
}
