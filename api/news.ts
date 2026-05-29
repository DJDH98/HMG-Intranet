import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory cache for news (5 minutes)
let cachedNewsData: any[] = [];
let newsCacheTimestamp = 0;
const NEWS_CACHE_DURATION = 5 * 60 * 1000;

// Helper to fetch and parse RSS/Atom feeds with strict 2.5s timeout (ported from server.ts)
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

    if (!response.ok) throw new Error(`Failed to fetch feed: ${response.status}`);

    const xml = await response.text();
    const items: any[] = [];
    const blocks = xml.split(/<(?:item|entry)[\s>]/i);

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];

      let title = "";
      const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
      }

      let link = "";
      const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      if (linkMatch) {
        link = linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
      } else {
        const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
        if (hrefMatch) link = hrefMatch[1].trim();
      }

      let summary = "";
      const descMatch = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
                        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
      if (descMatch) {
        summary = descMatch[1]
          .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
          .replace(/<[^>]*>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\s+/g, " ")
          .trim();
      }

      let publishedAt = "";
      const publishedMatch =
        block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
        block.match(/<published[^>]*>([\s\S]*?)<\/published>/i) ||
        block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) ||
        block.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
      if (publishedMatch) {
        publishedAt = cleanDateText(publishedMatch[1]);
      }

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
          category,
          publishedAt
        });
      }
      if (items.length >= 8) break;
    }
    return items;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`Error parsing feed from ${url}:`, err.message || err);
    return [];
  }
}

function cleanDateText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { query } = (req.body || {}) as { query?: string };
  const searchQuery = query ? query.trim().toLowerCase() : "";

  try {
    const now = Date.now();
    let allArticles = cachedNewsData;

    if (!cachedNewsData.length || (now - newsCacheTimestamp > NEWS_CACHE_DURATION)) {
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

      const results = await Promise.all(
        feedConfigs.map(config => fetchAndParseFeed(config.url, config.category, config.source))
      );
      allArticles = results.flat();
      cachedNewsData = allArticles;
      newsCacheTimestamp = now;
    }

    let filteredArticles = allArticles;
    if (searchQuery) {
      filteredArticles = allArticles.filter((a: any) =>
        a.title.toLowerCase().includes(searchQuery) ||
        a.summary.toLowerCase().includes(searchQuery) ||
        a.category.toLowerCase().includes(searchQuery) ||
        a.source.toLowerCase().includes(searchQuery)
      );
    }

    res.json({ success: true, articles: filteredArticles, isFallback: false });
  } catch (error: any) {
    console.error("Critical error in /api/news:", error);
    if (cachedNewsData.length) {
      let filteredArticles = cachedNewsData;
      if (searchQuery) {
        filteredArticles = cachedNewsData.filter((a: any) =>
          a.title.toLowerCase().includes(searchQuery) ||
          a.summary.toLowerCase().includes(searchQuery)
        );
      }
      return res.json({ success: true, articles: filteredArticles, isFallback: true });
    }
    res.status(500).json({ success: false, error: error.message || "News fetch failed" });
  }
}
