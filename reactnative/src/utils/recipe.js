// Recipe import from a link. Recipe sites worldwide embed schema.org Recipe
// JSON-LD for search engines, which gives clean ingredients and steps without
// scraping the page layout.
import {fetchTextSafe} from './fetchSafe';

const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

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

const clean = (v) =>
  decodeEntities(decodeEntities(String(v ?? '')).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// Arla writes the type as `type` as well as `@type`
const isRecipe = (node) =>
  node &&
  typeof node === 'object' &&
  asArray(node['@type'] || node.type).some((t) => /recipe$/i.test(t));

const findRecipe = (node, depth = 0) => {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (isRecipe(node)) return node;
  for (const child of Array.isArray(node) ? node : [node['@graph'], node.mainEntity, node.mainEntityOfPage]) {
    const hit = findRecipe(child, depth + 1);
    if (hit) return hit;
  }
  return null;
};

const imageOf = (v) => {
  const first = asArray(v)[0];
  if (!first) return '';
  return typeof first === 'string' ? first : first.url || first.contentUrl || '';
};

// Steps come as a string, strings, HowToStep objects or HowToSections of steps
const stepsOf = (v) =>
  asArray(v).flatMap((s) => {
    if (typeof s === 'string') return s.split(/\s*\n+\s*|(?<=\.)\s+(?=\d+\.\s)/);
    if (s?.itemListElement) return stepsOf(s.itemListElement);
    return [s?.text || s?.name || ''];
  })
    .map(clean)
    .filter(Boolean);

// ISO 8601 duration (PT1H30M) to minutes
const minutesOf = (v) => {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(v || ''));
  if (!m) return 0;
  return (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
};

const servingsOf = (v) => {
  const s = asArray(v).map(clean).find(Boolean) || '';
  return /^\d+$/.test(s) ? s : s.replace(/\b(servings?|portioner|portion|port|personer|pers)\b\.?/i, '').trim() || s;
};

const metaContent = (html, name) => {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`,
    'i',
  );
  const m = html.match(re);
  return m ? clean(m[1] || m[2]) : '';
};

// Older sites such as Smitten Kitchen have microdata and no JSON-LD
const microdataIngredients = (html) =>
  [...html.matchAll(/itemprop=["']recipeIngredient["'][^>]*>([\s\S]*?)<\//gi)]
    .map((m) => clean(m[1]))
    .filter(Boolean);

const jetpackSteps = (html) =>
  (/jetpack-recipe-directions[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] || '')
    .split(/<\/p>|<br\s*\/?>/i)
    .map(clean)
    .filter(Boolean);

export const parseRecipe = (html, url) => {
  // Arla entity-encodes the plus: application/ld&#x2B;json
  const blocks =
    html.match(/<script[^>]*application\/ld(?:\+|&#x2B;|&#43;)json[^>]*>[\s\S]*?<\/script>/gi) || [];
  let recipe = null;
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      recipe = findRecipe(JSON.parse(json));
    } catch {}
    if (recipe) break;
  }

  const host = (/^https?:\/\/(?:www\.)?([^/]+)/i.exec(url) || [])[1] || '';
  const total = minutesOf(recipe?.totalTime) || minutesOf(recipe?.cookTime) + minutesOf(recipe?.prepTime);
  const ingredients = asArray(recipe?.recipeIngredient || recipe?.ingredients).map(clean).filter(Boolean);
  const steps = stepsOf(recipe?.recipeInstructions);
  return {
    name: clean(recipe?.name) || metaContent(html, 'og:title'),
    url,
    source: host,
    image: imageOf(recipe?.image) || metaContent(html, 'og:image'),
    ingredients: ingredients.length ? ingredients : microdataIngredients(html),
    steps: steps.length ? steps : jetpackSteps(html),
    servings: servingsOf(recipe?.recipeYield),
    minutes: total || 0,
  };
};

// null when the page could not be fetched; a result with no ingredients means
// the site has no recipe data and only the title and photo were found
export const fetchRecipe = async (url) => {
  const headers = {Accept: 'text/html'};
  // Sites disagree on which client they block, so try as both
  const html =
    (await fetchTextSafe(url, {headers: {...headers, 'User-Agent': BROWSER_UA}}, 15000)) ||
    (await fetchTextSafe(url, {headers}, 15000));
  return html ? parseRecipe(html, url) : null;
};

const shortTitle = (s) => s[0] !== s[0].toLowerCase() && s.split(/\s+/).length <= 4;

// Köket mixes bare headings ("Servering") into its ingredients. Elsewhere that
// shape is a real ingredient ("Salz und Pfeffer"), so only a colon counts there
const BARE_HEADING_SITES = /(^|\.)koket\.se$/;
export const isIngredientHeading = (s, source = '') =>
  s.endsWith(':') || (BARE_HEADING_SITES.test(source) && shortTitle(s) && !/\d/.test(s));

export const isStepHeading = (s) => shortTitle(s) && !/[.!?)]$/.test(s);

export const formatMinutes = (minutes) => {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
};
