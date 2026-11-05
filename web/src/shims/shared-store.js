// Settings and secrets live on the Pi so a phone on the LAN edits the same
// config the wall display renders. Everything else (device id/name, Sonos
// uuid) stays per-browser, because those identify the device itself.
// If the server is unreachable, fall back to localStorage so the app still
// runs (vite dev without server.mjs, or the server briefly down).

const SHARED_KEYS = new Set([
  'homeboard_settings',
  'homeboard_secrets',
  // Provider tokens: connecting an account on a phone has to log in the Pi,
  // not the phone. The matching *_pkce_pending keys stay local on purpose,
  // since that handshake belongs to the browser running the flow.
  'spotify_tokens',
  'tibber_data_api_tokens',
  'lamarzocco_tokens',
  'lamarzocco_install_key',
  // Lets the Pi sign in again when the refresh token lapses
  'lamarzocco_credentials',
]);

export const isShared = (key) => SHARED_KEYS.has(key);

export const remoteGet = async (key) => {
  const resp = await fetch(`/store?key=${encodeURIComponent(key)}`);
  if (!resp.ok) throw new Error(`store get ${resp.status}`);
  const {value, deleted} = await resp.json();
  return {value, deleted: !!deleted};
};

// Revision produced by this client's own writes, so the reload watcher can
// tell "someone else edited settings" from "I just saved them myself"
let lastLocalRev = 0;

export const localWriteRev = () => lastLocalRev;

const rememberRev = async (resp) => {
  try {
    const {rev} = await resp.json();
    if (typeof rev === 'number') lastLocalRev = rev;
  } catch {
    // rev is advisory; a missing one only costs a redundant reload
  }
};

export const remoteSet = async (key, value) => {
  const resp = await fetch(`/store?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
    body: String(value),
  });
  if (!resp.ok) throw new Error(`store set ${resp.status}`);
  await rememberRev(resp);
};

// Reads a shared key, keeping localStorage as the offline copy
export const readShared = async (key, localKey) => {
  const ls = window.localStorage;
  try {
    const {value, deleted} = await remoteGet(key);
    if (value !== null) {
      ls.setItem(localKey, value);
      return value;
    }
    // Removed on another device: drop our copy instead of pushing it back
    if (deleted) {
      ls.removeItem(localKey);
      return null;
    }
    // Never stored yet: adopt this browser's copy rather than wiping a configured device
    const local = ls.getItem(localKey);
    if (local) await remoteSet(key, local).catch(() => {});
    return local;
  } catch {
    return ls.getItem(localKey);
  }
};

export const remoteRemove = async (key) => {
  const resp = await fetch(`/store?key=${encodeURIComponent(key)}`, {method: 'DELETE'});
  if (!resp.ok) throw new Error(`store remove ${resp.status}`);
  await rememberRev(resp);
};

export const getRev = async () => {
  const resp = await fetch('/store-rev');
  if (!resp.ok) throw new Error(`store-rev ${resp.status}`);
  const {rev} = await resp.json();
  return rev;
};
