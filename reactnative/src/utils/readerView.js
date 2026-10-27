// Reader view for news articles. Only the page's HTML is fetched, then parsed
// inert in a hidden WebView (EXTRACT_PAGE), so no page scripts, ads or images
// load; the live page took long enough on the tablet's wifi to time out. When
// that fails (bot walls refuse plain requests, or the text needs JavaScript)
// the original page opens and LIVE_EXTRACT_SCRIPT tries again inside it. The
// main article comes back as HTML and is shown in a WebView with JavaScript off.

// Paragraph-parent scoring (the Arc90/Readability idea): the element holding
// the most comma-rich prose, discounted by how much of it is link text.
// Returns {html, byline}, or null when nothing article-sized was found.
const EXTRACT_FN = `function (doc, pageUrl) {
  var clean = function (t) { return (t || '').replace(/\\s+/g, ' ').trim(); };

  var NOT_ARTICLE = 'dialog,[role="dialog"],[id*="consent"],[class*="consent"],[id*="cookie"],[class*="cookie"],footer,aside,nav';
  // Header, h1 and byline repeat what the reader view prints itself
  var JUNK = 'script,style,noscript,iframe,form,button,input,select,nav,aside,footer,header,h1,svg,video,audio,object,embed,source,' +
    '[aria-hidden="true"],[role="complementary"],[class*="share"],[class*="social"],[class*="related"],' +
    '[class*="newsletter"],[class*="promo"],[class*="advert"],[class~="ad"],[class~="ads"],[class^="ad-"],' +
    '[id^="ad-"],[class*="ad-slot"],[class*="ad-unit"],[class*="subscribe"],[class*="comment"],' +
    '[class*="author"],[class*="byline"],[class*="sidebar"],[class*="dropdown"],[class*="outbrain"],[class*="taboola"]';
  var KEEP_ATTRS = {href: 1, src: 1, alt: 1};

  var linkDensity = function (el) {
    var total = clean(el.textContent).length || 1;
    var linked = 0;
    el.querySelectorAll('a').forEach(function (a) { linked += clean(a.textContent).length; });
    return linked / total;
  };

  var pickBest = function () {
    var scores = new Map();
    var paragraphs = [];
    doc.querySelectorAll('p').forEach(function (p) {
      var len = clean(p.textContent).length;
      if (len < 40 || p.closest(NOT_ARTICLE)) return;
      var score = 1 + (p.textContent.match(/,/g) || []).length + Math.min(len / 100, 3);
      paragraphs.push([p, score]);
      // Ancestors share the score with falling weight, so sites that wrap
      // every paragraph in its own div (The Verge) still add up somewhere
      var el = p.parentElement;
      for (var level = 0; el && level < 4; level++, el = el.parentElement) {
        var divider = level === 0 ? 1 : level === 1 ? 2 : level * 3;
        scores.set(el, (scores.get(el) || 0) + score / divider);
      }
    });
    var best = null;
    var bestScore = 0;
    scores.forEach(function (score, el) {
      var adjusted = score * (1 - linkDensity(el));
      if (adjusted > bestScore) { bestScore = adjusted; best = el; }
    });
    if (!best) return null;
    // Bodies split into sibling blocks (Wired, Ars Technica, MIT Technology
    // Review) leave the winner holding one chunk; climb while an ancestor
    // brings in clearly more prose. Junk inside the ancestor does not count,
    // the same rule tidy() applies, so newsletter boxes and bios cannot pull
    // the selection up
    var prose = function (el) {
      var sum = 0;
      paragraphs.forEach(function (entry) {
        var junk = entry[0].closest(JUNK);
        if (el.contains(entry[0]) && !(junk && junk !== el && el.contains(junk))) sum += entry[1];
      });
      return sum * (1 - linkDensity(el));
    };
    var current = prose(best);
    var el = best.parentElement;
    for (var level = 0; el && el !== doc.body && level < 4; level++, el = el.parentElement) {
      var gained = prose(el);
      if (gained > current * 1.15) { best = el; current = gained; }
    }
    return best;
  };

  var absolute = function (url) {
    try { return new URL(url, pageUrl).href; } catch (e) { return ''; }
  };

  var tidy = function (root) {
    root.querySelectorAll(JUNK).forEach(function (el) { el.remove(); });
    root.querySelectorAll('img').forEach(function (img) {
      var src = img.currentSrc || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('src');
      if (!src && img.getAttribute('srcset')) src = img.getAttribute('srcset').split(' ')[0];
      // Tracking pixels and spacers; an inert page has no natural size yet
      var width = img.naturalWidth || parseInt(img.getAttribute('width'), 10);
      if (!src || src.indexOf('data:') === 0 || (width && width < 60)) { img.remove(); return; }
      img.setAttribute('src', absolute(src));
    });
    root.querySelectorAll('a').forEach(function (a) {
      if (a.getAttribute('href')) a.setAttribute('href', absolute(a.getAttribute('href')));
    });
    root.querySelectorAll('*').forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        if (!KEEP_ATTRS[attr.name]) el.removeAttribute(attr.name);
      });
    });
    return root;
  };

  var best = pickBest();
  var node = best ? tidy(best.cloneNode(true)) : null;
  var length = node ? clean(node.textContent).length : 0;
  if (length < 500) return null;
  // Metered sites (Tom's Hardware) ship the body aria-hidden until their
  // paywall script clears the reader; that call belongs to the original page
  var gated = 0;
  best.querySelectorAll('p[aria-hidden="true"]').forEach(function (p) { gated += clean(p.textContent).length; });
  if (gated > length) return null;
  var author = doc.querySelector('meta[name="author"]');
  return {html: node.innerHTML, byline: author ? author.content : ''};
}`;

const POST_FN = `function (result) {
  window.ReactNativeWebView.postMessage(JSON.stringify(result
    ? {type: 'article', html: result.html, byline: result.byline}
    : {type: 'noArticle'}));
}`;

// Static page that takes fetched HTML via window.hbExtract(html, url).
// DOMParser documents never run scripts or fetch images.
export const EXTRACT_PAGE = `<!doctype html><html><head><meta charset="utf-8"><script>
  var extract = ${EXTRACT_FN};
  var post = ${POST_FN};
  window.hbExtract = function (html, url) {
    var result = null;
    try { result = extract(new DOMParser().parseFromString(html, 'text/html'), url); } catch (e) {}
    post(result);
  };
</script></head><body></body></html>`;

// Runs inside the original page. Injected repeatedly (Android runs
// injectedJavaScript only after the full load), so the first run in each
// page sets up and the rest bail out.
export const LIVE_EXTRACT_SCRIPT = `(function () {
  if (window.__hbReader || !/^https?:/.test(location.href)) return;
  window.__hbReader = true;
  var extract = ${EXTRACT_FN};
  var post = ${POST_FN};
  // Start on parsed HTML, then keep retrying for text that renders late
  var tries = 0;
  var tick = function () {
    tries++;
    var result = null;
    try { result = extract(document, location.href); } catch (e) {}
    if (result || tries >= 8 || (document.readyState === 'complete' && tries >= 3)) post(result);
    else setTimeout(tick, 1000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
  else tick();
})(); true;`;

// Script tags make up most of a modern page and are dead weight to the parser
export const stripScripts = (html) =>
  String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');

export const extractCall = (html, url) => `window.hbExtract(${JSON.stringify(html)}, ${JSON.stringify(url)}); true;`;

// Tidies the original page. Ad and tracker requests are refused natively
// (the react-native-webview patch and assets/blocked-hosts.txt); this hides
// the empty slots they leave and the bars docked over the text. Paywall and
// sign-in dialogs are left alone.
export const HIDE_ADS_SCRIPT = `(function () {
  if (window.__hbTidy) return;
  window.__hbTidy = true;
  // Matched at the start of a class name or after - _ or a space, so
  // "ad-container" does not catch "head-container"
  var tokens = ['ad-slot', 'adslot', 'ad-container', 'ad-wrapper', 'ad-unit', 'adunit', 'ad-banner', 'ad-placeholder',
    'adsbygoogle', 'advert', 'taboola', 'outbrain', 'AdSlot', 'AdUnit', 'AdContainer'];
  var selectors = [];
  tokens.forEach(function (t) {
    ['^="' + t, '*=" ' + t, '*="-' + t, '*="_' + t].forEach(function (m) { selectors.push('[class' + m + '"]'); });
  });
  selectors.push('[id^="google_ads"]', '[id*="div-gpt-ad"]', 'ins.adsbygoogle', 'iframe[id^="google_ads_iframe"]',
    'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]', 'iframe[src*="amazon-adsystem"]',
    '[id*="taboola"]', '[id*="outbrain"]', '[data-ad]', '[data-ad-slot]', '[data-ad-unit]', '[aria-label="Advertisement"]',
    '[id*="onetrust"]', '[id^="sp_message_container"]', '[class*="cookie-banner"]', '[class*="consent-banner"]');
  var style = document.createElement('style');
  // Undo scroll locks; body stays visible or sticky headers stop sticking
  style.textContent = selectors.join(',') + '{display:none !important}' +
    'html{overflow-y:auto !important}body{overflow:visible !important}';
  (document.head || document.documentElement).appendChild(style);

  // Fixed bars in the lower half: sticky ads, floating video, app banners
  var undock = function () {
    if (!document.body) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (var el = walker.nextNode(); el; el = walker.nextNode()) {
      if (getComputedStyle(el).position !== 'fixed') continue;
      var box = el.getBoundingClientRect();
      if (box.height && box.top > innerHeight * 0.5 && box.height < innerHeight * 0.4) {
        el.style.setProperty('display', 'none', 'important');
      }
    }
  };
  [1500, 5000, 12000].forEach(function (ms) { setTimeout(undock, ms); });
})(); true;`;

const escapeHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

const fileName = (url) => String(url || '').split('?')[0].split('/').pop();

export const buildReaderHtml = ({article, html, byline, meta}) => {
  const image = article.urlToImage;
  // Most articles already open with the same picture the feed listed
  const hero = image && !html.includes(fileName(image)) ? `<img src="${escapeHtml(image)}" alt="">` : '';
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; background: #16162a; color: #e6e6ee; font: 22px/1.65 Georgia, 'Times New Roman', serif; }
  main { max-width: 820px; margin: 0 auto; padding: 28px 36px 96px; }
  .meta { font: 600 15px/1.4 Roboto, sans-serif; color: #8f8fb0; text-transform: uppercase; letter-spacing: .04em; }
  h1 { font: 700 36px/1.2 Roboto, sans-serif; color: #fff; margin: 10px 0 20px; }
  h2, h3, h4 { font-family: Roboto, sans-serif; color: #fff; line-height: 1.3; }
  img { display: block; max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; }
  figure { margin: 0; }
  figcaption { font: 15px/1.4 Roboto, sans-serif; color: #8f8fb0; }
  a { color: #7eb8e6; text-decoration: none; }
  blockquote { border-left: 4px solid #3a3a5a; margin: 0; padding-left: 18px; color: #c8c8d8; }
  pre { white-space: pre-wrap; font-size: 16px; }
</style>
</head><body><main>
  <div class="meta">${escapeHtml(meta)}</div>
  <h1>${escapeHtml(article.title)}</h1>
  ${byline ? `<div class="meta">${escapeHtml(byline)}</div>` : ''}
  ${hero}
  ${html}
</main></body></html>`;
};
