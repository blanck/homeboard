// Web runtime patches, loaded before the app.
import * as nobleNist from '@noble/curves/nist.js';
import * as nobleSha2 from '@noble/hashes/sha2.js';

// Some services lazy-require noble libs (a Metro workaround). Map those ids here.
const requireMap = {
  '@noble/curves/nist.js': nobleNist,
  '@noble/hashes/sha2.js': nobleSha2,
};

globalThis.require = (id) => {
  if (requireMap[id]) return requireMap[id];
  throw new Error(`No web require shim for module: ${id}`);
};

// Browsers enforce CORS; the native app does not. Route every cross-origin
// request through the local server's /proxy endpoint so all services
// (Sonos SOAP, Tibber, RSS feeds, ...) work identically to Android.
const origFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  try {
    const url = typeof input === 'string' ? input : input && input.url;
    if (url && /^https?:\/\//i.test(url) && !url.startsWith(window.location.origin)) {
      const proxied = '/proxy?url=' + encodeURIComponent(url);
      if (typeof input === 'string') {
        return origFetch(proxied, init);
      }
      return origFetch(new Request(proxied, input), init);
    }
  } catch (e) {}
  return origFetch(input, init);
};
