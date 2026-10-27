// Multi-provider news fetcher.
// Each provider returns the common Article shape:
//   { title, description, url, urlToImage, publishedAt, source: { name, icon } }

import AsyncStorage from '@react-native-async-storage/async-storage';
import {fetchJsonSafe, fetchTextSafe, fetchWithTimeout} from '../utils/fetchSafe';
import {DEFAULT_RSS_FEEDS} from '../config/newsFeeds';

export const CURRENTS_CATEGORIES_CACHE_KEY = 'homeboard_currents_categories';

// Extract a list of valid values from a Currents-style error like
// "Invalid category value(s): top. Allowed values: a, b, c"
const parseAllowedValues = (errorText) => {
  if (!errorText) return null;
  const m = errorText.match(/Allowed values:\s*([^"}\n]+)/);
  if (!m) return null;
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/[.\s]+$/, ''))
    .filter(Boolean);
};

const fetchSourcesDebug = async (url) => {
  let res;
  try {
    res = await fetchWithTimeout(url);
  } catch (e) {
    return {error: `Network: ${e?.message || 'unknown'}`};
  }
  let body = '';
  try {
    body = await res.text();
  } catch {}
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(body);
      const msg = j?.error?.message || j?.message || j?.error || JSON.stringify(j);
      if (msg) detail += ` — ${msg}`;
    } catch {
      if (body) detail += ` — ${body.slice(0, 200)}`;
    }
    return {error: detail};
  }
  try {
    return {data: JSON.parse(body)};
  } catch (e) {
    return {error: 'Invalid JSON response'};
  }
};

export const fetchTheNewsApiSources = async (key, language) => {
  if (!key) return null;
  const params = new URLSearchParams({api_token: key});
  if (language) params.set('language', language);
  const result = await fetchSourcesDebug(
    `https://api.thenewsapi.com/v1/news/sources?${params}`,
  );
  if (result.error) return {error: result.error};
  const data = result.data;
  if (!Array.isArray(data?.data)) {
    return {error: 'Unexpected response shape'};
  }
  return data.data
    .map((s) => ({
      id: s.domain || s.source_id,
      source_id: s.source_id,
      domain: s.domain,
      language: s.language,
      locale: s.locale,
      categories: s.categories || [],
    }))
    .filter((s) => s.id);
};

const extractDomain = (urlOrHost) => {
  if (!urlOrHost) return '';
  try {
    return new URL(urlOrHost).hostname.replace(/^www\./, '');
  } catch {
    return urlOrHost
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }
};

export const fetchNewsdataSources = async (key, language) => {
  if (!key) return null;
  const params = new URLSearchParams({apikey: key});
  if (language) params.set('language', language);
  const result = await fetchSourcesDebug(`https://newsdata.io/api/1/sources?${params}`);
  if (result.error) return {error: result.error};
  const data = result.data;
  if (data?.status !== 'success' || !Array.isArray(data.results)) {
    return {error: data?.message || 'Unexpected response shape'};
  }
  return data.results
    .map((s) => {
      const domain = extractDomain(s.url) || s.url || '';
      return {
        id: domain || s.id,
        domain,
        name: s.name,
        source_id: s.id,
      };
    })
    .filter((s) => s.id);
};

// Currents has no sources endpoint — harvest domains from a sample news call.
export const fetchCurrentsSources = async (key, language) => {
  if (!key) return null;
  const params = new URLSearchParams({apiKey: key});
  if (language) params.set('language', language);
  const result = await fetchSourcesDebug(
    `https://api.currentsapi.services/v2/latest-news?${params}`,
  );
  if (result.error) return {error: result.error};
  const data = result.data;
  if (data?.status !== 'ok' || !Array.isArray(data.news)) {
    return {error: data?.message || 'Unexpected response shape'};
  }
  const map = new Map();
  for (const item of data.news) {
    const domain = extractDomain(item.url);
    if (!domain || map.has(domain)) continue;
    map.set(domain, {
      id: domain,
      domain,
      name: item.author || item.source || domain,
    });
  }
  return [...map.values()];
};

const fetchFromNewsdata = async (config) => {
  const {keys, headlines, exclude} = config.newsapi || {};
  // Fallback to legacy `key` field for users on the old config shape
  const key = keys?.newsdata || config.newsapi?.key;
  if (!key) {
    console.warn('News: NewsData.io key not set');
    return null;
  }

  const params = new URLSearchParams({
    apikey: key,
    language: headlines?.language || 'en',
    image: '1',
    removeduplicate: '1',
    size: '10',
  });

  const categories = (headlines?.categories || []).filter(Boolean);
  if (categories.length > 0) params.set('category', categories.join(','));

  const sources = (headlines?.sources || '').trim();
  if (sources) params.set('domainurl', sources);

  const excludeList = (exclude || []).filter(Boolean);
  if (excludeList.length > 0) {
    params.set('qInTitle', `NOT (${excludeList.join(',')})`);
  }

  const url = `https://newsdata.io/api/1/latest?${params}`;
  const data = await fetchJsonSafe(url);
  if (!data) {
    console.warn('News: NewsData.io request failed (network/timeout)');
    return null;
  }
  if (data.status !== 'success') {
    console.warn('News: NewsData.io error', data.status, data.message || data.results);
    return null;
  }
  if (!Array.isArray(data.results) || data.results.length === 0) {
    console.warn('News: NewsData.io returned 0 results for', {
      categories: categories.join(','),
      sources,
      excludeCount: excludeList.length,
    });
    return [];
  }

  return data.results.map((item) => ({
    title: item.title,
    description: item.description,
    url: item.link,
    urlToImage: item.image_url,
    publishedAt: item.pubDate,
    source: {name: item.source_name, icon: item.source_icon},
  }));
};

const fetchFromTheNewsApi = async (config) => {
  const {keys, headlines} = config.newsapi || {};
  const key = keys?.thenewsapi;
  if (!key) {
    console.warn('News: TheNewsAPI key not set');
    return null;
  }

  const params = new URLSearchParams({
    api_token: key,
    language: headlines?.language || 'en',
    limit: '10',
  });

  const categories = (headlines?.categories || []).filter(Boolean);
  if (categories.length > 0) params.set('categories', categories.join(','));

  const sources = (headlines?.sources || '').trim();
  if (sources) params.set('domains', sources);

  const url = `https://api.thenewsapi.com/v1/news/all?${params}`;
  const data = await fetchJsonSafe(url);
  if (!data) {
    console.warn('News: TheNewsAPI request failed (network/timeout)');
    return null;
  }
  if (data.error || !Array.isArray(data.data)) {
    console.warn('News: TheNewsAPI error', data.error?.message || JSON.stringify(data).slice(0, 200));
    return null;
  }
  if (data.data.length === 0) {
    console.warn('News: TheNewsAPI returned 0 results for', {
      categories: categories.join(','),
      sources,
    });
    return [];
  }

  return data.data.map((item) => ({
    title: item.title,
    description: item.description || item.snippet,
    url: item.url,
    urlToImage: item.image_url,
    publishedAt: item.published_at,
    source: {name: item.source, icon: null},
  }));
};

const fetchFromCurrents = async (config) => {
  const {keys, headlines} = config.newsapi || {};
  const key = keys?.currents;
  if (!key) {
    console.warn('News: CurrentsAPI key not set');
    return null;
  }

  const language = headlines?.language || 'en';
  const categories = (headlines?.categories || []).filter(Boolean);
  const allowedDomains = (headlines?.sources || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const callApi = async (cats) => {
    const params = new URLSearchParams({apiKey: key, language});
    if (cats.length > 0) params.set('category', cats[0]);
    return fetchSourcesDebug(
      `https://api.currentsapi.services/v2/latest-news?${params}`,
    );
  };

  let dbg = await callApi(categories);

  // If Currents 400'd with an "Allowed values" list, cache the list and retry
  // with only the valid categories the user had selected.
  if (dbg.error && dbg.error.includes('Allowed values')) {
    const allowed = parseAllowedValues(dbg.error);
    if (allowed && allowed.length > 0) {
      try {
        await AsyncStorage.setItem(
          CURRENTS_CATEGORIES_CACHE_KEY,
          JSON.stringify({fetchedAt: Date.now(), items: allowed}),
        );
      } catch {}
      const validCats = categories.filter((c) => allowed.includes(c));
      const dropped = categories.filter((c) => !allowed.includes(c));
      console.warn(
        'News: CurrentsAPI dropping invalid categories',
        dropped,
        'retrying with',
        validCats,
      );
      dbg = await callApi(validCats);
    }
  }

  if (dbg.error) {
    console.warn('News: CurrentsAPI', dbg.error);
    return null;
  }
  const data = dbg.data;
  if (data?.status !== 'ok' || !Array.isArray(data.news)) {
    console.warn('News: CurrentsAPI unexpected response', JSON.stringify(data).slice(0, 300));
    return null;
  }

  const articles = data.news.map((item) => {
    const articleDomain = extractDomain(item.url);
    return {
      title: item.title,
      description: item.description,
      url: item.url,
      urlToImage: item.image && item.image !== 'None' ? item.image : null,
      publishedAt: item.published,
      source: {name: item.author || (item.source ? item.source : null), icon: null},
      _domain: articleDomain,
    };
  });

  if (allowedDomains.length > 0) {
    const filtered = articles.filter((a) => allowedDomains.includes(a._domain));
    if (filtered.length === 0) {
      console.warn(
        'News: CurrentsAPI returned',
        articles.length,
        'articles but none matched selected domains',
        allowedDomains,
      );
      return [];
    }
    return filtered.slice(0, 10).map(({_domain, ...rest}) => rest);
  }

  return articles.slice(0, 10).map(({_domain, ...rest}) => rest);
};

// newsapi.org top-headlines, matching what the legacy server.js used
const fetchFromNewsApiOrg = async (config) => {
  const {keys, headlines} = config.newsapi || {};
  const key = keys?.newsapiorg || config.newsapi?.key;
  if (!key) {
    console.warn('News: NewsAPI.org key not set');
    return null;
  }

  const params = new URLSearchParams({apiKey: key, pageSize: String(headlines?.pageSize || 30)});
  const sources = (headlines?.sources || '').trim();
  if (sources) {
    params.set('sources', sources);
  } else if (headlines?.language) {
    params.set('language', headlines.language);
  }

  const data = await fetchJsonSafe(`https://newsapi.org/v2/top-headlines?${params}`);
  if (!data || data.status !== 'ok' || !Array.isArray(data.articles)) {
    console.warn('News: NewsAPI.org error', data?.status, data?.message);
    return null;
  }
  return data.articles.map((a) => ({
    title: a.title,
    description: a.description,
    url: a.url,
    urlToImage: a.urlToImage,
    publishedAt: a.publishedAt,
    source: {name: a.source?.name || '', icon: null},
  }));
};


// --- RSS ---------------------------------------------------------------------
// Parsed with regexes because React Native has no DOMParser, same as the iCal
// reader.

const MAX_ARTICLES = 20;
// Below this many keyword hits the list is topped up with the newest other
// stories, so a quiet news day never leaves the widget empty
const MIN_KEYWORD_ARTICLES = 6;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const NEWS_CACHE_KEY = 'homeboard_news_cache';

const stripCdata = (v = '') =>
  v.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim();

const decodeEntities = (v = '') =>
  v
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

const tagValue = (xml, name) => {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decodeEntities(stripCdata(match[1])) : '';
};

const stripTags = (v = '') => decodeEntities(v.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

const hostOf = (url) => {
  const match = String(url).match(/^https?:\/\/([^/]+)/i);
  return match ? match[1].replace(/^www\./, '') : 'RSS';
};

const findImage = (block) => {
  const media = block.match(/<(?:media:content|media:thumbnail|enclosure)[^>]*url="([^"]+)"/i);
  if (media) return decodeEntities(media[1]);
  // Inline images sit in CDATA (Verge, Electrek) or entity-encoded HTML
  const inline = decodeEntities(block).match(/<img[^>]*src="(https?:[^"]+)"/i);
  return inline ? inline[1] : null;
};

const parseFeed = (xml, feedUrl) => {
  // Channel title lives before the first entry; fall back to the feed's host
  const head = xml.split(/<(?:item|entry)[\s>]/i)[0];
  const sourceName = stripTags(tagValue(head, 'title')) || hostOf(feedUrl);
  const blocks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];
  const articles = [];

  for (const block of blocks) {
    const title = stripTags(tagValue(block, 'title'));
    if (!title) continue;

    let url = tagValue(block, 'link');
    if (!url) {
      // Atom puts the target in an attribute rather than the element body
      const href = block.match(/<link[^>]*href="([^"]+)"/i);
      url = href ? decodeEntities(href[1]) : '';
    }
    // Techmeme links its own summary page; the story is the first other link
    if (/^https?:\/\/(www\.)?techmeme\.com\//i.test(url)) {
      const story = decodeEntities(block).match(/href="(https?:\/\/(?!(?:www\.)?techmeme\.com)[^"]+)"/i);
      if (story) url = story[1];
    }

    const raw =
      tagValue(block, 'pubDate') ||
      tagValue(block, 'published') ||
      tagValue(block, 'updated') ||
      tagValue(block, 'dc:date');
    const when = raw ? new Date(raw) : null;

    articles.push({
      title,
      description: stripTags(tagValue(block, 'description') || tagValue(block, 'summary')).slice(0, 400),
      url,
      urlToImage: findImage(block),
      publishedAt: when && !isNaN(when.getTime()) ? when.toISOString() : null,
      source: {name: sourceName, icon: null},
    });
  }
  return articles;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole-word-ish match so "AI" does not hit "said", while "Tesla" still
// catches "Teslas" and "Tesla's"
const wordMatcher = (words) => {
  const list = (words || []).map((w) => String(w).trim()).filter(Boolean);
  if (!list.length) return null;
  const re = new RegExp(
    `(?:^|[^a-z0-9])(?:${list.map(escapeRegex).join('|')})s?(?:$|[^a-z0-9])`,
    'i',
  );
  return (article) => re.test(`${article.title} ${article.description || ''}`);
};

const applyExclusion = (articles, exclude) => {
  const matches = wordMatcher(exclude);
  if (!matches || !articles) return articles;
  return articles.filter((a) => !matches(a));
};

const byRecency = (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);

// Keyword hits first (newest first), topped up with the newest of the rest
const rankByKeywords = (articles, keywords) => {
  const matches = wordMatcher(keywords);
  if (!matches) return articles;
  const hits = articles.filter(matches);
  if (hits.length >= MIN_KEYWORD_ARTICLES) return hits;
  return [...hits, ...articles.filter((a) => !matches(a))];
};

const dedupe = (articles) => {
  const seen = new Set();
  return articles.filter((a) => {
    const keys = [a.url, a.title.toLowerCase().replace(/[^a-z0-9]+/g, '')].filter(Boolean);
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
};

// url -> og:image ('' when the page has none), so each article is fetched once
const imageCache = new Map();

const fetchOgImage = async (url) => {
  if (imageCache.has(url)) return imageCache.get(url);
  const html = await fetchTextSafe(url, undefined, 8000);
  const match =
    html &&
    (html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i));
  const image = match ? decodeEntities(match[1]) : '';
  // A failed fetch is retried on the next poll; a page without one is not
  if (html) imageCache.set(url, image);
  if (imageCache.size > 300) imageCache.delete(imageCache.keys().next().value);
  return image;
};

const fillMissingImages = async (articles) => {
  const missing = articles.filter((a) => !a.urlToImage && a.url);
  for (let i = 0; i < missing.length; i += 4) {
    await Promise.all(
      missing.slice(i, i + 4).map(async (a) => {
        a.urlToImage = (await fetchOgImage(a.url)) || null;
      }),
    );
  }
  return articles;
};

const fetchFromRss = async (config) => {
  const feeds = (config.newsapi?.rssFeeds || DEFAULT_RSS_FEEDS)
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  const perFeed = await Promise.all(
    feeds.map(async (feed) => {
      const xml = await fetchTextSafe(feed, undefined, 12000);
      if (!xml) {
        console.warn('News: RSS feed unreachable', feed);
        return [];
      }
      try {
        return parseFeed(xml, feed);
      } catch (err) {
        console.warn('News: RSS parse failed', feed, err.message);
        return [];
      }
    }),
  );

  let all = dedupe(perFeed.flat().sort(byRecency));
  if (!all.length) return null;

  const cutoff = Date.now() - MAX_AGE_MS;
  const fresh = all.filter((a) => a.publishedAt && new Date(a.publishedAt) >= cutoff);
  if (fresh.length >= MAX_ARTICLES) all = fresh;

  all = applyExclusion(all, config.newsapi?.exclude);
  const picked = rankByKeywords(all, config.newsapi?.keywords).slice(0, MAX_ARTICLES);
  return fillMissingImages(picked);
};

const fetchFromProvider = (provider, config) => {
  switch (provider) {
    case 'rss':
      return fetchFromRss(config);
    case 'thenewsapi':
      return fetchFromTheNewsApi(config);
    case 'currents':
      return fetchFromCurrents(config);
    case 'newsapiorg':
      return fetchFromNewsApiOrg(config);
    default:
      return fetchFromNewsdata(config);
  }
};

export const loadCachedNews = async () => {
  try {
    const str = await AsyncStorage.getItem(NEWS_CACHE_KEY);
    const cached = str ? JSON.parse(str) : null;
    return Array.isArray(cached) && cached.length ? cached : null;
  } catch {
    return null;
  }
};

// Resolves to a non-empty list or null; null means "keep what is on screen"
export const fetchNews = async (config) => {
  const provider = config.newsapi?.provider || 'rss';
  let articles = applyExclusion(
    await fetchFromProvider(provider, config).catch(() => null),
    config.newsapi?.exclude,
  );
  if (provider !== 'rss' && !articles?.length) {
    // Free API tiers run out of quota or lapse; the feeds keep the widget alive
    console.warn(`News: ${provider} returned nothing, falling back to RSS`);
    articles = await fetchFromRss(config).catch(() => null);
  }
  if (!articles?.length) return null;
  AsyncStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(articles)).catch(() => {});
  return articles;
};
