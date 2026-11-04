// Recipe search across sites the importer (utils/recipe.js) can read, so a
// picked result imports with ingredients and steps. Each site's own search is
// read as it ships its results; a site that changes or blocks just drops out.
import {fetchTextSafe} from './fetchSafe';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const TIMEOUT_MS = 10000;
const MAX_RESULTS = 24;

const decode = (v = '') =>
  String(v)
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

// The JSON value starting at the first { or [ after `from`, or null
export const jsonAt = (text, from) => {
  const start = text.slice(from).search(/[[{]/);
  if (from < 0 || start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = from + start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(from + start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
};

// Arla ships its result cards as entity-encoded JSON in the page
export const parseArla = (html) => {
  const text = decode(html);
  const re = /"type":"recipe","uid":"[^"]*","title":"([^"]+)","url":"(\/recept\/[^"]+)"(?:,"imageResizer":\{[^}]*\})?(?:,"picture":\{"url":"([^"]+)")?/g;
  const out = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({title: m[1], url: `https://www.arla.se${m[2]}`, image: m[3] || '', source: 'Arla'});
  }
  return out;
};

export const parseBbcGoodFood = (html) => {
  const results = jsonAt(html, html.indexOf('"searchResults":'));
  return (results?.items || [])
    .filter((it) => it.postType === 'recipe' && !it.isPremium && /\/recipes\//.test(it.url || ''))
    .map((it) => ({title: it.title, url: it.url, image: it.image?.url || '', source: 'BBC Good Food'}));
};

export const parseWordPress = (json, source) => {
  let posts;
  try {
    posts = JSON.parse(json);
  } catch {
    return [];
  }
  return (Array.isArray(posts) ? posts : []).map((p) => ({
    title: decode(p.title?.rendered || '').replace(/<[^>]*>/g, ''),
    url: p.link,
    image: p.yoast_head_json?.og_image?.[0]?.url || '',
    source,
  }));
};

const wordPress = (host, source) => ({
  source,
  lang: 'en',
  url: (q) =>
    `https://${host}/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=8&_fields=link,title,yoast_head_json.og_image`,
  parse: (text) => parseWordPress(text, source),
});

const PROVIDERS = [
  {
    source: 'Arla',
    lang: 'sv',
    url: (q) => `https://www.arla.se/recept/?search=${encodeURIComponent(q)}`,
    parse: parseArla,
  },
  {
    source: 'BBC Good Food',
    lang: 'en',
    url: (q) => `https://www.bbcgoodfood.com/search?q=${encodeURIComponent(q)}`,
    parse: parseBbcGoodFood,
  },
  wordPress('www.recipetineats.com', 'RecipeTin Eats'),
  wordPress('www.loveandlemons.com', 'Love and Lemons'),
];

// Round-robin across sites so one big site does not bury the rest; sites in
// the app language come first
export const mergeResults = (lists) => {
  const seen = new Set();
  const out = [];
  for (let i = 0; out.length < MAX_RESULTS && lists.some((l) => i < l.length); i++) {
    for (const list of lists) {
      const r = list[i];
      if (!r || !r.url || !r.title || seen.has(r.url)) continue;
      seen.add(r.url);
      out.push(r);
    }
  }
  return out.slice(0, MAX_RESULTS);
};

// Filler words match nearly every recipe on the sites' full-text search
const STOP_WORDS = new Set(
  'a an and or the with without of in on for to from style easy best recipe recipes med utan och eller i på till av från en ett recept'.split(
    ' ',
  ),
);

export const searchTerms = (query) =>
  String(query || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !STOP_WORDS.has(w));

const fold = (v) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Titles naming more of the search words go first; titles naming none are dropped
export const rankByTitle = (results, terms) => {
  if (!terms.length) return results;
  const folded = terms.map(fold);
  const ranked = results
    .map((r, i) => {
      const title = fold(r.title || '');
      return {r, i, hits: folded.filter((t) => title.includes(t)).length};
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.i - b.i)
    .map((x) => x.r);
  // A site's own match beats an empty list when no title names the words
  return ranked.length ? ranked : results;
};

export const searchRecipes = async (query, lang = 'en') => {
  const terms = searchTerms(query);
  const q = terms.join(' ');
  if (!q) return [];
  const ordered = [...PROVIDERS].sort((a, b) => (b.lang === lang) - (a.lang === lang));
  const lists = await Promise.all(
    ordered.map(async (p) => {
      const text = await fetchTextSafe(p.url(q), {headers: {'User-Agent': UA}}, TIMEOUT_MS);
      try {
        return text ? p.parse(text) : [];
      } catch {
        return [];
      }
    }),
  );
  return rankByTitle(mergeResults(lists), terms);
};
