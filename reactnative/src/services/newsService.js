// Multi-provider news fetcher.
// Each provider returns the common Article shape:
//   { title, description, url, urlToImage, publishedAt, source: { name, icon } }

import AsyncStorage from '@react-native-async-storage/async-storage';
import {fetchJsonSafe, fetchWithTimeout} from '../utils/fetchSafe';

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

// Apply client-side title-based exclusion uniformly (some providers don't support it natively)
const applyExclusion = (articles, exclude) => {
  const list = (exclude || []).map((s) => s.toLowerCase()).filter(Boolean);
  if (list.length === 0 || !articles) return articles;
  return articles.filter((a) => {
    const title = (a.title || '').toLowerCase();
    return !list.some((w) => title.includes(w));
  });
};

export const fetchNews = async (config) => {
  const provider = config.newsapi?.provider || 'newsdata';
  console.warn('News: fetching from', provider);
  let articles = null;
  if (provider === 'thenewsapi') {
    articles = await fetchFromTheNewsApi(config);
  } else if (provider === 'currents') {
    articles = await fetchFromCurrents(config);
  } else {
    articles = await fetchFromNewsdata(config);
  }
  const final = applyExclusion(articles, config.newsapi?.exclude);
  console.warn('News:', provider, 'returned', final?.length ?? 'null', 'articles');
  return final;
};
