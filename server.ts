import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

// Server-side in-memory cache to guarantee instant reloads and prevent duplicate outgoing connections
let cachedNewsData: any[] = [];
let newsCacheTimestamp = 0;
const NEWS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

let cachedWeatherData: any = null;
let weatherCacheTimestamp = 0;
const WEATHER_CACHE_DURATION = 3 * 60 * 1000; // 3 minutes cache

// Helper to fetch and parse RSS/Atom feeds natively with regex with a strict 2.5s timeout
async function fetchAndParseFeed(url: string, category: string, fallbackSource: string): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "application/xml, text/xml, */*"
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status}`);
    }
    const xml = await response.text();
    
    const items: any[] = [];
    // Split on either <item> (RSS) or <entry> (Atom) which may have attributes
    const blocks = xml.split(/<(?:item|entry)[\s>]/i);
    
    // Skip the first block as it's the header RSS/Channel node
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      
      // Title
      let title = "";
      const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
         title = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
      }
      
      // Link
      let link = "";
      const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      if (linkMatch) {
         link = linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
      } else {
         const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
         if (hrefMatch) {
           link = hrefMatch[1].trim();
         }
      }
      
      // Description / Summary
      let summary = "";
      const descMatch = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
                        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
      if (descMatch) {
         summary = descMatch[1]
           .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
           .replace(/<[^>]*>/g, "") // strip html tags
           .replace(/&amp;/g, "&")
           .replace(/&lt;/g, "<")
           .replace(/&gt;/g, ">")
           .replace(/&quot;/g, '"')
           .replace(/&apos;/g, "'")
           .replace(/\s+/g, " ")
           .trim();
      }
      
      // Decode HTML entities in title too
      title = title
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();
        
      if (title && link) {
        items.push({
          title,
          summary: summary || "Read direct coverage at the publisher's primary source.",
          source: fallbackSource,
          url: link,
          category
        });
      }
      
      // Limit to 8 items per category to keep payload balanced
      if (items.length >= 8) {
         break;
      }
    }
    return items;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`Error parsing feed from ${url}:`, err.message || err);
    return [];
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON payloads
  app.use(express.json());

  // API router health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Fetch Cornwall current weather
  app.get("/api/weather", async (req, res) => {
    try {
      const now = Date.now();
      if (cachedWeatherData && (now - weatherCacheTimestamp < WEATHER_CACHE_DURATION)) {
        return res.json({ success: true, data: cachedWeatherData });
      }

      // Coordinates for Redruth, Cornwall
      const latitude = 50.2333;
      const longitude = -5.2333;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=Europe/London&wind_speed_unit=mph`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo responded with status: ${response.status}`);
      }
      const data = await response.json();
      
      cachedWeatherData = data;
      weatherCacheTimestamp = now;

      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Error fetching weather:", error);
      if (cachedWeatherData) {
        console.log("Serving stale cached weather after open-meteo error");
        return res.json({ success: true, data: cachedWeatherData });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Token-free Real-time Scraped News Endpoint
  app.post("/api/news", async (req, res) => {
    const { query } = req.body;
    const searchQuery = query ? query.trim().toLowerCase() : "";
    
    try {
      const now = Date.now();
      let allArticles = cachedNewsData;

      if (!cachedNewsData.length || (now - newsCacheTimestamp > NEWS_CACHE_DURATION)) {
        // Direct, token-free, public RSS XML news sources covering:
        // Headlines, Tech, Gaming, Space, Boxing.
        // We prioritize bulletproof HTTPS endpoints like The Guardian, NYT, and Yahoo News
        // to guarantee perfect uptime and bypass strict cloud data-center IP blocking.
        const feedConfigs = [
          // Headlines
          { url: "https://www.theguardian.com/world/rss", category: "Headlines", source: "The Guardian" },
          { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", category: "Headlines", source: "NY Times" },
          { url: "https://news.yahoo.com/rss/world", category: "Headlines", source: "Yahoo World" },
          { url: "https://www.independent.co.uk/news/world/rss", category: "Headlines", source: "Independent" },
          { url: "https://news.sky.com/feeds/info/world.xml", category: "Headlines", source: "Sky News" },
          { url: "https://search.cnbc.com/rs/search/view.xml?partnerId=2000&keywords=world+news", category: "Headlines", source: "CNBC Feed" },
          { url: "https://www.aljazeera.com/xml/rss/all.xml", category: "Headlines", source: "Al Jazeera" },
          
          // Tech
          { url: "https://feeds.feedburner.com/TechCrunch/", category: "Tech", source: "TechCrunch" },
          { url: "https://www.wired.com/feed/rss", category: "Tech", source: "Wired" },
          { url: "https://venturebeat.com/feed/", category: "Tech", source: "VentureBeat" },
          { url: "https://slashdot.org/slashdot.rss", category: "Tech", source: "Slashdot" },
          { url: "https://www.theverge.com/rss/index.xml", category: "Tech", source: "The Verge" },
          { url: "https://engadget.com/rss.xml", category: "Tech", source: "Engadget" },
          { url: "https://gizmodo.com/rss", category: "Tech", source: "Gizmodo" },
          
          // Gaming
          { url: "https://www.eurogamer.net/feed", category: "Gaming", source: "Eurogamer" },
          { url: "https://www.pcgamer.com/rss/", category: "Gaming", source: "PC Gamer" },
          { url: "https://www.rockpapershotgun.com/feed/", category: "Gaming", source: "RPS" },
          { url: "https://www.destructoid.com/feed/", category: "Gaming", source: "Destructoid" },
          { url: "https://www.gamespot.com/feeds/news/", category: "Gaming", source: "GameSpot" },
          { url: "https://www.polygon.com/rss/index.xml", category: "Gaming", source: "Polygon" },
          { url: "https://feeds.feedburner.com/ign/news", category: "Gaming", source: "IGN" },
          
          // Space
          { url: "https://www.space.com/feeds/all", category: "Space", source: "Space.com" },
          { url: "https://www.nasa.gov/news-release/feed/", category: "Space", source: "NASA" },
          { url: "https://phys.org/rss-feed/space-news/", category: "Space", source: "Phys.org" },
          { url: "https://www.esa.int/rssfeed/Our_Activities/Space_Science", category: "Space", source: "ESA" },
          { url: "https://www.universetoday.com/feed/", category: "Space", source: "Universe Today" },
          { url: "https://skyandtelescope.org/feed/", category: "Space", source: "Sky & Telescope" },
          
          // Boxing
          { url: "https://www.boxingnews24.com/feed/", category: "Boxing", source: "BoxingNews 24" },
          { url: "https://www.badlefthook.com/rss/index.xml", category: "Boxing", source: "Bad Left Hook" },
          { url: "https://www.boxinginsider.com/feed/", category: "Boxing", source: "Boxing Insider" },
          { url: "https://boxing-social.com/feed/", category: "Boxing", source: "Boxing Social" },
          { url: "https://www.worldboxingnews.net/feed/", category: "Boxing", source: "World Boxing News" },
          { url: "https://fightnews.com/feed", category: "Boxing", source: "Fightnews" }
        ];

        // Fetch all feeds in parallel with individual safe try/catch handling inside fetchAndParseFeed
        const results = await Promise.all(
          feedConfigs.map(config => fetchAndParseFeed(config.url, config.category, config.source))
        );

        // Merge and flatten articles
        allArticles = results.flat();
        cachedNewsData = allArticles;
        newsCacheTimestamp = now;
      }

      // If search query is provided, filter articles case-insensitively
      let filteredArticles = allArticles;
      if (searchQuery) {
        filteredArticles = allArticles.filter(article => 
          article.title.toLowerCase().includes(searchQuery) || 
          article.summary.toLowerCase().includes(searchQuery) ||
          article.category.toLowerCase().includes(searchQuery) ||
          article.source.toLowerCase().includes(searchQuery)
        );
      }

      res.json({
        success: true,
        articles: filteredArticles,
        isFallback: false
      });

    } catch (error: any) {
      console.error("Critical error in scraped news feed endpoint:", error);
      if (cachedNewsData.length) {
        let filteredArticles = cachedNewsData;
        if (searchQuery) {
          filteredArticles = cachedNewsData.filter(article => 
            article.title.toLowerCase().includes(searchQuery) || 
            article.summary.toLowerCase().includes(searchQuery) ||
            article.category.toLowerCase().includes(searchQuery) ||
            article.source.toLowerCase().includes(searchQuery)
          );
        }
        return res.json({ success: true, articles: filteredArticles, isFallback: true });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    // Automatically redirect root / requests to the Vite base path/subdirectory in development to prevent 404s
    app.get("/", (req, res) => {
      const query = req.url.split('?')[1];
      res.redirect(`/HMG-Intranet/${query ? '?' + query : ''}`);
    });

    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Dalen's Portal Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
