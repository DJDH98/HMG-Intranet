import React, { useState, useEffect, FormEvent } from "react";
import { 
  Search, 
  RotateCw, 
  Newspaper, 
  Cpu, 
  Globe, 
  Flame, 
  Compass, 
  Sparkles,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { NewsArticle } from "../types";

export default function NewsAgent() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Track which category is expanded. Default to null (collapsed) as requested.
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const fetchNews = async (queryStr = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryStr }),
      });
      const result = await res.json();
      if (result.success && result.articles) {
        setNews(result.articles);
      } else {
        throw new Error(result.error || "Failed to parse homelab news feeds.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred fetching the live RSS indices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    fetchNews(searchQuery);
  };

  const getCategoryIcon = (category: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("tech")) return <Cpu className="w-4 h-4 text-sky-400" />;
    if (cat.includes("politics") || cat.includes("headline") || cat.includes("overall")) {
      return <Globe className="w-4 h-4 text-emerald-400" />;
    }
    if (cat.includes("game") || cat.includes("gaming")) return <Flame className="w-4 h-4 text-rose-400" />;
    if (cat.includes("space")) return <Compass className="w-4 h-4 text-amber-405" />;
    if (cat.includes("boxing")) return <Sparkles className="w-4 h-4 text-amber-500" />;
    return <Newspaper className="w-4 h-4 text-stone-400" />;
  };

  const getCategoryThemeColor = (category: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("tech")) return "text-sky-400 border-sky-500/20";
    if (cat.includes("politics") || cat.includes("headline") || cat.includes("overall")) return "text-emerald-400 border-emerald-500/20";
    if (cat.includes("game") || cat.includes("gaming")) return "text-rose-400 border-rose-500/20";
    if (cat.includes("space")) return "text-amber-400 border-amber-500/20";
    if (cat.includes("boxing")) return "text-amber-500 border-amber-500/25";
    return "text-[#5865F2] border-[#5865F2]/20";
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategory(prev => (prev === cat ? null : cat));
  };

  // Group fetched news into their specific targets: Headlines, Tech, Gaming, Space, Boxing
  const groupedNews: { [key: string]: NewsArticle[] } = {
    "Headlines": [],
    "Tech": [],
    "Gaming": [],
    "Space": [],
    "Boxing": []
  };

  news.forEach(article => {
    const origCat = (article.category || "Headlines").toLowerCase();
    if (origCat.includes("tech")) {
      groupedNews["Tech"].push(article);
    } else if (origCat.includes("game") || origCat.includes("gaming")) {
      groupedNews["Gaming"].push(article);
    } else if (origCat.includes("space")) {
      groupedNews["Space"].push(article);
    } else if (origCat.includes("boxing")) {
      groupedNews["Boxing"].push(article);
    } else if (origCat.includes("politics") || origCat.includes("headline") || origCat.includes("news")) {
      groupedNews["Headlines"].push(article);
    } else {
      groupedNews["Headlines"].push(article);
    }
  });

  // Select exactly 6 diverse articles per category using a round-robin algorithm
  Object.keys(groupedNews).forEach(category => {
    const articles = groupedNews[category];
    
    // Group active articles by their publisher source
    const bySource: { [source: string]: NewsArticle[] } = {};
    articles.forEach(article => {
      const src = (article.source || "Unknown").trim();
      if (!bySource[src]) {
        bySource[src] = [];
      }
      bySource[src].push(article);
    });

    const uniqueSources = Object.keys(bySource);
    const result: NewsArticle[] = [];
    
    let index = 0;
    let addedAny = true;
    
    // Distribute articles round-robin from each source to achieve perfect dispersion
    while (result.length < 6 && addedAny) {
      addedAny = false;
      for (let i = 0; i < uniqueSources.length; i++) {
        if (result.length >= 6) break;
        const src = uniqueSources[i];
        const articlesList = bySource[src];
        if (index < articlesList.length) {
          result.push(articlesList[index]);
          addedAny = true;
        }
      }
      index++;
    }
    
    groupedNews[category] = result;
  });

  return (
    <div className="bg-[#2b2d31] border border-[#1e1f22]/90 rounded-2xl p-4 sm:p-6 shadow-md hover:border-[#3f4147]/40 transition-shadow duration-300">
      
      {/* Search and Headers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3f4147]/30 pb-4 mb-4 select-none">
        <div>
          <div className="flex items-center gap-1.5">
            <Newspaper className="w-4 h-4 text-[#5865F2] animate-pulse" />
            <span className="text-[10px] font-mono tracking-wider text-[#5865F2] font-bold uppercase">Real-Time News Stream</span>
          </div>
          <h2 className="text-md sm:text-lg font-bold text-white tracking-tight mt-1">Multi-Category RSS wire</h2>
          <p className="text-xs text-stone-400 mt-0.5">Live feeds from Sky News, GB News, TechCrunch, Eurogamer, Space.com & BoxingNews 24</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto md:max-w-md">
          <div className="relative flex-1 md:w-56">
            <input
              type="text"
              placeholder="Search wire headlines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-sans pl-8 pr-3 py-1.5 border border-[#1e1f22] rounded-xl focus:outline-hidden focus:border-[#5865F2] bg-[#1e1f22] text-stone-200 transition-colors placeholder:text-stone-500"
            />
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-stone-500" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-3.5 py-1.5 bg-[#5865F2] hover:bg-[#5865F2]/85 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              fetchNews("");
            }}
            disabled={loading}
            className="p-1.5 border border-[#1e1f22] bg-[#1e1f22] hover:bg-[#35373c]/50 hover:border-[#3f4147]/60 rounded-xl transition-colors text-stone-400 disabled:opacity-50 cursor-pointer inline-flex items-center"
            title="Refresh feed"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </form>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center select-none">
          <div className="w-8 h-8 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin mb-3" />
          <h3 className="text-xs sm:text-sm font-semibold text-stone-200">Retrieving standard feeds</h3>
          <p className="text-[10px] sm:text-xs text-stone-400 mt-1 max-w-sm leading-relaxed">
            Crawling RSS XML endpoints safely...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 flex items-start gap-3 text-red-400 text-xs shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-300 mb-1">Standard Network Read Failure</h4>
            <div className="flex items-center gap-2 mt-2">
              <button 
                onClick={() => fetchNews(searchQuery)}
                className="px-3 py-1.5 bg-red-900/30 text-red-200 border border-red-800 hover:bg-red-900/50 rounded-lg transition-colors font-medium cursor-pointer"
              >
                Retry Fetch
              </button>
              <span className="text-stone-500 font-mono text-[9px]">{error}</span>
            </div>
          </div>
        </div>
      )}

      {/* Grid of 5 categories - compact space saving tiles */}
      {!loading && !error && news.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Object.keys(groupedNews).map(category => {
              const list = groupedNews[category];
              const isCompExpanded = expandedCategory === category;
              
              return (
                <CategoryTile 
                  key={category}
                  category={category}
                  articles={list}
                  isExpanded={isCompExpanded}
                  onToggle={() => toggleCategory(category)}
                  getCategoryIcon={getCategoryIcon}
                  getCategoryThemeColor={getCategoryThemeColor}
                />
              );
            })}
          </div>

          {/* Active expanded category list of articles rendered full width underneath */}
          {expandedCategory && groupedNews[expandedCategory] && (
            <div className="mt-4 pt-4 border-t border-[#3f4147]/30 animate-[fadeIn_0.2s_ease-out]">
              <div className="flex items-center justify-between mb-3.5 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase bg-[#1e1f22] border border-[#3f4147]/50 text-stone-300 px-2 py-0.5 rounded-md font-semibold tracking-wide justify-center flex">
                    Live Feed
                  </span>
                  <p className="text-xs font-bold text-stone-200">
                    {expandedCategory === "Headlines" ? "Top Headlines Feed" : `${expandedCategory} Bulletins`}
                  </p>
                </div>
                <button 
                  onClick={() => setExpandedCategory(null)}
                  className="text-stone-550 hover:text-stone-300 text-[10px] font-mono cursor-pointer flex items-center gap-1 hover:underline"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Collapse list</span>
                </button>
              </div>

              {groupedNews[expandedCategory].length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400 font-sans bg-[#1e1f22]/20 rounded-xl border border-[#1e1f22]">
                  No articles found in this category. Try cleaning your filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groupedNews[expandedCategory].slice(0, 6).map((article, idx) => (
                    <div 
                      key={idx} 
                      className="group border border-[#1e1f22] bg-[#313338] hover:bg-[#35373c]/50 rounded-xl p-3.5 hover:border-[#3f4147]/60 transition-all duration-300 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[9px] font-mono font-bold uppercase text-stone-300 bg-[#1e1f22] px-1.5 py-0.5 rounded border border-[#3f4147]/30">
                            {article.source}
                          </span>
                        </div>
                        
                        <h4 className="text-xs font-bold text-stone-100 leading-snug tracking-tight group-hover:text-teal-300 transition-colors">
                          {article.title}
                        </h4>
                        
                        <p className="text-[10px] sm:text-[11px] text-stone-400 font-sans leading-relaxed mt-1.5 line-clamp-3 text-justify">
                          {article.summary}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#3f4147]/20 flex items-center justify-between text-[9px] font-mono">
                        <span className="text-stone-550">Wire service</span>
                        
                        {article.url && (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[#5865F2] hover:text-teal-300 transition-all font-bold cursor-pointer"
                          >
                            <span>Open source</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && !error && news.length === 0 && (
        <div className="text-center py-10 text-stone-500 select-none">
          <Newspaper className="w-8 h-8 text-stone-700 mx-auto mb-2" />
          <p className="text-xs">No active articles match your query.</p>
          <button
            onClick={() => {
              setSearchQuery("");
              fetchNews("");
            }}
            className="mt-2 text-xs text-[#5865F2] hover:underline font-mono"
          >
            Clear current filter
          </button>
        </div>
      )}

    </div>
  );
}

// Subcomponent to handle the rotating headline ticker for each category when collapsed
interface CategoryTileProps {
  key?: string;
  category: string;
  articles: NewsArticle[];
  isExpanded: boolean;
  onToggle: () => void;
  getCategoryIcon: (cat: string) => any;
  getCategoryThemeColor: (cat: string) => string;
}

function CategoryTile({ 
  category, 
  articles, 
  isExpanded, 
  onToggle, 
  getCategoryIcon,
  getCategoryThemeColor
}: CategoryTileProps) {
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    // Only cycle headlines when card of category is collapsed
    if (isExpanded || articles.length <= 1) return;
    
    const interval = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % articles.length);
    }, 20000); // cycle every 20 seconds
    
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
        {/* Top Header Row within Tile */}
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

        {/* Dynamic cycling news ticker inside collapsed state */}
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

      {/* Footer descriptor within Tile */}
      <div className="w-full flex items-center justify-between mt-1 pt-1.5 border-t border-[#3f4147]/20 text-[8px] text-stone-500 font-mono">
        <span>{isExpanded ? "unfolded" : "click to view"}</span>
        <span className="truncate max-w-[80px]">
          {(activeArticle && activeArticle.source) || "RSS index"}
        </span>
      </div>
    </button>
  );
}
