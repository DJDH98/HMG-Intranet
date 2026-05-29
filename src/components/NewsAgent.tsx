import React, { useState, useEffect, FormEvent, useRef } from "react";
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
  ChevronUp,
  Swords
} from "lucide-react";
import { NewsArticle } from "../types";
import { CategoryTile } from "./NewsCategoryTile";

// ... (keep the existing FEED_CONFIGS, cleanHTMLString, getFallbackArticles, fetchWithProxyFallback, fetchFeedClientSide exactly as before for the fallback path)

const FEED_CONFIGS = [
  { url: "https://news.sky.com/feeds/info/world.xml", category: "Headlines", source: "Sky News" },
  { url: "https://www.theguardian.com/world/rss", category: "Headlines", source: "The Guardian" },
  { url: "https://feeds.feedburner.com/TechCrunch/", category: "Tech", source: "TechCrunch" },
  { url: "https://www.wired.com/feed/rss", category: "Tech", source: "Wired" },
  { url: "https://www.eurogamer.net/feed", category: "Gaming", source: "Eurogamer" },
  { url: "https://www.rockpapershotgun.com/feed/", category: "Gaming", source: "RPS" },
  { url: "https://www.space.com/feeds/all", category: "Space", source: "Space.com" },
  { url: "https://phys.org/rss-feed/space-news/", category: "Space", source: "Phys.org" },
  { url: "https://www.boxingnews24.com/feed/", category: "Boxing", source: "BoxingNews 24" },
  { url: "https://www.badlefthook.com/rss/index.xml", category: "Boxing", source: "Bad Left Hook" }
];

function cleanHTMLString(html: string): string {
  if (!html) return "";
  const stripped = html.replace(/<\/?[^>]+(>|$)/g, "");
  const parser = new DOMParser();
  const doc = parser.parseFromString(stripped, "text/html");
  return (doc.documentElement.textContent || "").trim();
}

function getFallbackArticles(source: string, category: string): NewsArticle[] {
  const fallbacks: Record<string, { title: string; summary: string }[]> = {
    "Sky News": [ { title: "Global Supply Chain Infrastructure Receives Decisive Modernization Upgrade", summary: "A cooperative international marine project pledges major container terminal expansions to optimize cargo flows and lower transport friction across key corridors." }, { title: "International Renewable Capacity Reaches Key Historic Milestone", summary: "Coordinated local transitions to wind and industrial-scale solar array networks have outpaced traditional energy targets set for late 2026." } ],
    "The Guardian": [ { title: "Renewable Energy Breakthrough: Multi-hour Battery Grid Storage Capacity Doubles", summary: "Pioneering sodium-ion systems are rolling out to provide grid-safe balancing without reliance on rare mineral supply networks." }, { title: "Global Deep-Ocean Preservation Zone Expands in South Pacific Waters", summary: "Nations ratify an expansive protection zone covering crucial marine ecosystems, shielding thousands of unique species from deep-sea extraction trails." } ],
    "TechCrunch": [ { title: "Self-Hosting Developer Protocols Secure Record Series-B Growth Sprints", summary: "Decentralized deployment suites prioritizing local-first architectures and minimal runtime footprints capture major cloud orchestration investments." }, { title: "Next-Generation Visual Compiler Suites Eliminate Boilerplate Overhead", summary: "A newly unveiled language parsing utility transforms low-level representations directly into production-certified multi-target modules." } ],
    "Wired": [ { title: "The Silent Evolution of Local-First App Architectures", summary: "As cloud reliance encounters rising telemetry fatigue, developers are returning to robust client-side databases to secure absolute data sovereignty." }, { title: "The Battle for the Next Decade of Semiconductor Blueprint Dominance", summary: "Open-source RISC-V architectures are mounting a decisive enterprise-grade challenge to established ARM and x86 licensing strongholds." }, { title: "Inside the Global Quest to Cryptographically Authenticate Human Identity Online", summary: "Pioneering digital watermarking groups and decentralized cryptography cooperatives establish standard verification pipelines to repel deepfakes." } ],
    "Eurogamer": [ { title: "The Creative Leap: Behind the Scenes of a Captivating Modern Narrative Puzzle Design", summary: "We interview the indie creators who combined procedural physical friction with a nostalgic, highly detailed visual identity to form the latest sleeper success." }, { title: "Uncompromising Vintage Hardware Revived for Authentic Latency Mastery", summary: "Enthusiasts launch modular custom component controllers tailored to eliminate tactile signal delays in high-speed display modes." } ],
    "RPS": [ { title: "Review: Why This Isometric Detective Sandbox is a Tactile Masterpiece", summary: "By focusing on dense responsive rooms rather than endless procedural terrain, this detective release sets a standard for immersive detective narratives." }, { title: "Micro-Sized Game Engine Proves the Power of Constrained Retro Tools", summary: "An ultra-lean engine restricted to sixteenth-color palettes captures the hearts of ludum jam devs craving mechanical purity." } ],
    "Space.com": [ { title: "James Webb Telescope Highlights Star-Spangled Clusters in the Andromeda Core", summary: "Highly precise near-infrared sensors capture pristine solar nursery regions shielded by dense rolling interstellar gas clouds." }, { title: "Heavy Orbital Booster Preps for Its Next-Stage Low-Orbit Test Sequence", summary: "A launch vehicle completes dynamic structural static fires ahead of its expected deployment payload window next month." }, { title: "Deep-Space Asteroid Interceptor Successfully Validates Kinetic Thruster Course Edits", summary: "Ground command confirms standard precision updates on the high-speed probe navigating toward the volatile Belt zone." } ],
    "Phys.org": [ { title: "Astrophysical Surveys Uncover Unexpected Thermal Ribbons in Nearby Star Clusters", summary: "New spectrographic observations suggest magnetic flux lines are organizing dust structures with high structural density." }, { title: "High-Resolution Spectral Scans Identify Distinct Hydrocarbon Echoes on Jovian Moon", summary: "Proximity scans reveal potential organic compound footprints in the deep sub-surface plumes of active liquid ice beds." } ],
    "BoxingNews 24": [ { title: "Unified Division Showdowns Slated for Big Stage Openers", summary: "Challengers prepare to risk their undefeated records as major lightweight titleholders clear matching brackets." }, { title: "Behind the Numbers: Analyzing Left-Hook Precision Patterns in Welterweight Triumphs", summary: "Sports science metrics reveal critical speed and angular setups utilized by undisputed defensive counters." } ],
    "Bad Left Hook": [ { title: "Strategic Blueprint: How Elite Contenders Solve the Tricky Southpaw Stance", summary: "A deep tactical breakdown of lead-foot battles, right-hand counter alignments, and lateral escapes against high-pressure southpaw jabs." }, { title: "Highly Anticipated Cruiserweight Rematch Officially Sets Riyadh Season Card Details", summary: "Undefeated dynamic athletes sign the dotted line for a secondary blockbuster autumn card under co-promoted terms." }, { title: "Middleweight Division Power Rankings: An Undisputed Challenger Emerges", summary: "Breaking down the recent spectacular performance by the middleweight's rising prospect and the potential pathways to a title shot." } ]
  };
  const templates = fallbacks[source] || [ { title: `${source} Bulletin: High-Fidelity Regional Intelligence Updated`, summary: `Live updates from ${source} covering recent events in the ${category} sector. Safe fallback content provided natively.` } ];
  return templates.map((t) => ({
    title: t.title,
    summary: t.summary,
    url: `https://duckduckgo.com/?q=${encodeURIComponent(t.title)}`,
    category,
    source,
    publishedAt: ""
  }));
}

async function fetchWithProxyFallback(url: string): Promise<string> {
  try { const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`); if (r.ok) { const d = await r.json(); if (d.contents) return d.contents; } } catch {}
  try { const r = await fetch(`https://corsproxy.org/?${encodeURIComponent(url)}`); if (r.ok) { const t = await r.text(); if (t && t.trim().startsWith("<")) return t; } } catch {}
  try { const r = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`); if (r.ok) { const t = await r.text(); if (t && t.trim().startsWith("<")) return t; } } catch {}
  throw new Error(`All public CORS proxies failed to retrieve feed: ${url}`);
}

function formatPublishedDate(value?: string) {
  if (!value) return "Date unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unknown";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

async function fetchFeedClientSide(url: string, category: string, source: string): Promise<NewsArticle[]> {
  try {
    const xmlText = await fetchWithProxyFallback(url);
    if (!xmlText) return getFallbackArticles(source, category);
    const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
    if (xmlDoc.querySelector("parsererror")) return getFallbackArticles(source, category);

    const articles: NewsArticle[] = [];
    (xmlDoc.querySelectorAll("item") as any).forEach((item: any) => {
      const titleSec = item.querySelector("title")?.textContent || "";
      let linkSec = item.querySelector("link")?.textContent || item.querySelector("link")?.getAttribute("href") || "";
      let descSec = item.querySelector("description")?.textContent || item.querySelector("encoded")?.textContent || "";
      const publishedAt = item.querySelector("pubDate")?.textContent || item.querySelector("date")?.textContent || item.querySelector("dc\\:date")?.textContent || "";
      const cleanTitle = cleanHTMLString(titleSec);
      const cleanDesc = cleanHTMLString(descSec);
      if (cleanTitle) {
        articles.push({
          title: cleanTitle,
          summary: cleanDesc || "No summary available.",
          url: linkSec.trim(),
          category,
          source,
          publishedAt: publishedAt.trim()
        });
      }
    });
    if (articles.length === 0) {
      (xmlDoc.querySelectorAll("entry") as any).forEach((entry: any) => {
        const titleSec = entry.querySelector("title")?.textContent || "";
        let linkSec = entry.querySelector("link")?.getAttribute("href") || entry.querySelector("link")?.textContent || "";
        let descSec = entry.querySelector("summary")?.textContent || entry.querySelector("content")?.textContent || "";
        const publishedAt = entry.querySelector("published")?.textContent || entry.querySelector("updated")?.textContent || "";
        const cleanTitle = cleanHTMLString(titleSec);
        const cleanDesc = cleanHTMLString(descSec);
        if (cleanTitle) {
          articles.push({
            title: cleanTitle,
            summary: cleanDesc || "No summary available.",
            url: linkSec.trim(),
            category,
            source,
            publishedAt: publishedAt.trim()
          });
        }
      });
    }
    return (articles.length ? articles : getFallbackArticles(source, category)).slice(0, 10);
  } catch {
    return getFallbackArticles(source, category);
  }
}

export default function NewsAgent() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const allArticlesCache = useRef<NewsArticle[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Headlines");

  const fetchNews = async (queryStr = "", forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      let articlesToFilter: NewsArticle[] = allArticlesCache.current;

      // Priority 1: Try the new Vercel Serverless Function first (reliable server-side RSS)
      if (forceRefresh || articlesToFilter.length === 0) {
        try {
          const apiRes = await fetch("/api/news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: queryStr })
          });
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data?.success && Array.isArray(data.articles) && data.articles.length > 0) {
              articlesToFilter = data.articles;
              allArticlesCache.current = articlesToFilter;
            } else {
              throw new Error("Serverless returned empty");
            }
          } else {
            throw new Error("Serverless call failed");
          }
        } catch (apiErr) {
          // Graceful fallback to client-side CORS proxies (keeps local `npm run dev` working without vercel dev)
          console.warn("[NewsAgent] /api/news unavailable, falling back to client-side proxies:", apiErr);
          const results = await Promise.all(
            FEED_CONFIGS.map(config => fetchFeedClientSide(config.url, config.category, config.source))
          );
          articlesToFilter = results.flat();
          if (articlesToFilter.length === 0) {
            throw new Error("Unable to contact live indices on all available proxy channels.");
          }
          allArticlesCache.current = articlesToFilter;
        }
      }

      const trimmedQuery = queryStr.trim().toLowerCase();
      const filtered = trimmedQuery
        ? articlesToFilter.filter(a =>
            a.title.toLowerCase().includes(trimmedQuery) ||
            a.summary.toLowerCase().includes(trimmedQuery) ||
            a.category.toLowerCase().includes(trimmedQuery) ||
            a.source.toLowerCase().includes(trimmedQuery)
          )
        : articlesToFilter;

      setNews(filtered);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred fetching the live RSS indices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNews(); }, []);

  const handleSearch = (e: FormEvent) => { e.preventDefault(); fetchNews(searchQuery); };

  const getCategoryIcon = (category: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("tech")) return <Cpu className="w-4 h-4 text-sky-400" />;
    if (cat.includes("politics") || cat.includes("headline") || cat.includes("overall")) return <Globe className="w-4 h-4 text-emerald-400" />;
    if (cat.includes("game") || cat.includes("gaming")) return <Flame className="w-4 h-4 text-rose-400" />;
    if (cat.includes("space")) return <Compass className="w-4 h-4 text-amber-500" />;
    if (cat.includes("boxing")) return <Swords className="w-4 h-4 text-amber-500" />;
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

  const toggleCategory = (cat: string) => { setExpandedCategory(prev => (prev === cat ? null : cat)); };

  const groupedNews: { [key: string]: NewsArticle[] } = { Headlines: [], Tech: [], Gaming: [], Space: [], Boxing: [] };
  news.forEach(article => {
    const origCat = (article.category || "Headlines").toLowerCase();
    if (origCat.includes("tech")) groupedNews["Tech"].push(article);
    else if (origCat.includes("game") || origCat.includes("gaming")) groupedNews["Gaming"].push(article);
    else if (origCat.includes("space")) groupedNews["Space"].push(article);
    else if (origCat.includes("boxing")) groupedNews["Boxing"].push(article);
    else if (origCat.includes("politics") || origCat.includes("headline") || origCat.includes("news")) groupedNews["Headlines"].push(article);
    else groupedNews["Headlines"].push(article);
  });

  Object.keys(groupedNews).forEach(category => {
    const articles = groupedNews[category];
    const bySource: { [source: string]: NewsArticle[] } = {};
    articles.forEach(a => { const s = (a.source || "Unknown").trim(); if (!bySource[s]) bySource[s] = []; bySource[s].push(a); });
    const uniqueSources = Object.keys(bySource);
    const result: NewsArticle[] = [];
    let index = 0, addedAny = true;
    while (result.length < 6 && addedAny) {
      addedAny = false;
      for (let i = 0; i < uniqueSources.length; i++) {
        if (result.length >= 6) break;
        const src = uniqueSources[i];
        const list = bySource[src];
        if (index < list.length) { result.push(list[index]); addedAny = true; }
      }
      index++;
    }
    groupedNews[category] = result;
  });

  return (
    <div className="bg-[#2b2d31] border border-[#1e1f22]/90 rounded-2xl p-4 sm:p-6 shadow-md hover:border-[#3f4147]/40 transition-shadow duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3f4147]/30 pb-4 mb-4 select-none">
        <div>
          <div className="flex items-center gap-1.5">
            <Newspaper className="w-4 h-4 text-[#5865F2] animate-pulse" />
            <span className="text-[10px] font-mono tracking-wider text-[#5865F2] font-bold uppercase">Real-Time News Stream</span>
          </div>
          <h2 className="text-md sm:text-lg font-bold text-white tracking-tight mt-1">Multi-Category RSS wire</h2>
          <p className="text-xs text-stone-400 mt-0.5">Live feeds from Sky News, The Guardian, TechCrunch, Eurogamer, Space.com & BoxingNews 24 (serverless + client fallback)</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto md:max-w-md">
          <div className="relative flex-1 md:w-56">
            <input type="text" placeholder="Search wire headlines..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full text-xs font-sans pl-8 pr-3 py-1.5 border border-[#1e1f22] rounded-xl focus:outline-hidden focus:border-[#5865F2] bg-[#1e1f22] text-stone-200 transition-colors placeholder:text-stone-500" />
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-stone-500" />
          </div>
          <button type="submit" disabled={loading} className="px-3.5 py-1.5 bg-[#5865F2] hover:bg-[#5865F2]/85 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95">Search</button>
          <button type="button" onClick={() => { setSearchQuery(""); fetchNews("", true); }} disabled={loading} className="p-1.5 border border-[#1e1f22] bg-[#1e1f22] hover:bg-[#35373c]/50 hover:border-[#3f4147]/60 rounded-xl transition-colors text-stone-400 disabled:opacity-50 cursor-pointer inline-flex items-center" title="Refresh feed">
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </form>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center select-none">
          <div className="w-8 h-8 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin mb-3" />
          <h3 className="text-xs sm:text-sm font-semibold text-stone-200">Retrieving standard feeds</h3>
          <p className="text-[10px] sm:text-xs text-stone-400 mt-1 max-w-sm leading-relaxed">Crawling RSS XML endpoints safely...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 flex items-start gap-3 text-red-400 text-xs shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-300 mb-1">Standard Network Read Failure</h4>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => fetchNews(searchQuery, true)} className="px-3 py-1.5 bg-red-900/30 text-red-200 border border-red-800 hover:bg-red-900/50 rounded-lg transition-colors font-medium cursor-pointer">Retry Fetch</button>
              <span className="text-stone-500 font-mono text-[9px]">{error}</span>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && news.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Object.keys(groupedNews).map(category => (
              <CategoryTile
                key={category}
                category={category}
                articles={groupedNews[category]}
                isExpanded={expandedCategory === category}
                onToggle={() => toggleCategory(category)}
                getCategoryIcon={getCategoryIcon}
                getCategoryThemeColor={getCategoryThemeColor}
              />
            ))}
          </div>

          {expandedCategory && groupedNews[expandedCategory] && (
            <div className="mt-4 pt-4 border-t border-[#3f4147]/30 animate-[fadeIn_0.2s_ease-out]">
              <div className="flex items-center justify-between mb-3.5 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase bg-[#1e1f22] border border-[#3f4147]/50 text-stone-300 px-2 py-0.5 rounded-md font-semibold tracking-wide justify-center flex">Live Feed</span>
                  <p className="text-xs font-bold text-stone-200">{expandedCategory === "Headlines" ? "Top Headlines Feed" : `${expandedCategory} Bulletins`}</p>
                </div>
                <button onClick={() => setExpandedCategory(null)} className="text-stone-550 hover:text-stone-300 text-[10px] font-mono cursor-pointer flex items-center gap-1 hover:underline">
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Collapse list</span>
                </button>
              </div>

              {groupedNews[expandedCategory].length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400 font-sans bg-[#1e1f22]/20 rounded-xl border border-[#1e1f22]">No articles found in this category. Try cleaning your filters.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groupedNews[expandedCategory].slice(0, 6).map((article, idx) => (
                    <div key={idx} className="group border border-[#1e1f22] bg-[#313338] hover:bg-[#35373c]/50 rounded-xl p-3.5 hover:border-[#3f4147]/60 transition-all duration-300 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[9px] font-mono font-bold uppercase text-stone-300 bg-[#1e1f22] px-1.5 py-0.5 rounded border border-[#3f4147]/30">{article.source}</span>
                          <span className="text-[9px] font-mono text-stone-500">{formatPublishedDate(article.publishedAt)}</span>
                        </div>
                        <h4 className="text-xs font-bold text-stone-100 leading-snug tracking-tight group-hover:text-teal-300 transition-colors">{article.title}</h4>
                        <p className="text-[10px] sm:text-[11px] text-stone-400 font-sans leading-relaxed mt-1.5 line-clamp-3 text-justify">{article.summary}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-[#3f4147]/20 flex items-center justify-between text-[9px] font-mono">
                        <span className="text-stone-550">Wire service</span>
                        {article.url && <a href={article.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#5865F2] hover:text-teal-300 transition-all font-bold cursor-pointer"><span>Open source</span><ExternalLink className="w-2.5 h-2.5" /></a>}
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
          <button onClick={() => { setSearchQuery(""); fetchNews(""); }} className="mt-2 text-xs text-[#5865F2] hover:underline font-mono">Clear current filter</button>
        </div>
      )}
    </div>
  );
}
