// Spotify OAuth — Authorization Code with PKCE (no client secret).
// Each user logs in once to their own Spotify account; tokens are stored in EncryptedStorage
// and refreshed on demand. The dev/owner registers ONE Spotify app (one-time).

import {Platform} from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import 'react-native-get-random-values';
import {fetchWithTimeout} from '../utils/fetchSafe';

// Public Client ID — from developer.spotify.com.
// PKCE flow does not need a Client Secret, so this is safe to commit.
export const CLIENT_ID = '173224127e484c0f955e01857f83ed12';

// On web, Spotify only accepts https redirect URIs. A static forwarder page
// on Firebase Hosting (www/oauth/spotify/index.html) bounces the callback
// with its query back to http://127.0.0.1:8080. Register this exact URI in
// the Spotify app dashboard.
const REDIRECT_URI =
  Platform.OS === 'web'
    ? 'https://homeboard-1.web.app/oauth/spotify'
    : 'homeboard://oauth/spotify';
// No scopes are required for catalog search. Add any extra scopes here later if needed.
const SCOPES = '';
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SEARCH_URL = 'https://api.spotify.com/v1/search';
const TOKENS_KEY = 'spotify_tokens';
const PKCE_KEY = 'spotify_pkce_pending';

// Base64url encode (no padding)
const base64url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) result += chars[((b & 15) << 2) | (c >> 6)];
    if (i + 2 < bytes.length) result += chars[c & 63];
  }
  return result;
};

const sha256 = (plain) => {
  const {sha256: hash} = require('@noble/hashes/sha2.js');
  const bytes = [];
  for (let i = 0; i < plain.length; i++) {
    const code = plain.charCodeAt(i);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6));
      bytes.push(0x80 | (code & 0x3f));
    }
  }
  return hash(new Uint8Array(bytes));
};

const generatePKCE = async () => {
  const randomBytes = new Uint8Array(64);
  crypto.getRandomValues(randomBytes);
  const codeVerifier = base64url(randomBytes);
  const challengeHash = await sha256(codeVerifier);
  const codeChallenge = base64url(challengeHash);
  return {codeVerifier, codeChallenge};
};

export const startOAuthFlow = async () => {
  if (!CLIENT_ID) throw new Error('Spotify CLIENT_ID not configured');
  const {codeVerifier, codeChallenge} = await generatePKCE();
  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = base64url(stateBytes);

  await EncryptedStorage.setItem(PKCE_KEY, JSON.stringify({codeVerifier, state}));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  if (SCOPES) params.set('scope', SCOPES);

  return `${AUTHORIZE_URL}?${params.toString()}`;
};

export const exchangeCodeForTokens = async (code, receivedState) => {
  const pkceStr = await EncryptedStorage.getItem(PKCE_KEY);
  if (!pkceStr) throw new Error('No pending PKCE state');

  const {codeVerifier, state} = JSON.parse(pkceStr);
  if (state !== receivedState) throw new Error('State mismatch');
  await EncryptedStorage.removeItem(PKCE_KEY);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const res = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Spotify token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  await storeTokens(tokens);
  return tokens;
};

const refreshAccessToken = async (refreshToken) => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  let res;
  try {
    res = await fetchWithTimeout(TOKEN_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: body.toString(),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json();
  const tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  await storeTokens(tokens);
  return tokens;
};

const storeTokens = async (tokens) => {
  await EncryptedStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
};

const loadTokens = async () => {
  try {
    const str = await EncryptedStorage.getItem(TOKENS_KEY);
    return str ? JSON.parse(str) : null;
  } catch {
    return null;
  }
};

// For LAN settings sync: move the token store between trusted devices so
// each kiosk does not need its own interactive login.
export const exportTokens = async () => {
  return await EncryptedStorage.getItem(TOKENS_KEY);
};

export const importTokens = async (str) => {
  const parsed = JSON.parse(str);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid token payload');
  await EncryptedStorage.setItem(TOKENS_KEY, str);
};

export const clearTokens = async () => {
  await EncryptedStorage.removeItem(TOKENS_KEY);
};

let refreshPromise = null;

const getValidAccessToken = async () => {
  const tokens = await loadTokens();
  if (!tokens) return null;
  if (tokens.expiresAt > Date.now() + 60000) return tokens.accessToken;
  if (!tokens.refreshToken) return null;
  if (refreshPromise) {
    const t = await refreshPromise;
    return t?.accessToken || null;
  }
  refreshPromise = refreshAccessToken(tokens.refreshToken);
  try {
    const t = await refreshPromise;
    return t?.accessToken || null;
  } finally {
    refreshPromise = null;
  }
};

export const isSpotifyConnected = async () => !!(await loadTokens());

const oneSearch = async (token, query, type, market, limit) => {
  const params = new URLSearchParams({q: query, type, limit: String(limit)});
  if (market) params.set('market', market);
  return fetchWithTimeout(
    `${SEARCH_URL}?${params.toString()}`,
    {headers: {Authorization: `Bearer ${token}`}},
    8000,
  );
};

// Search Spotify catalog. Returns mixed array of playlists, albums, tracks.
export const searchSpotify = async (query, {types = ['playlist', 'album', 'track'], market, limit = 8} = {}) => {
  if (!query || !query.trim()) return [];
  let token = await getValidAccessToken();
  if (!token) throw new Error('Spotify not connected');

  const runForType = async (type) => {
    let res = await oneSearch(token, query, type, market, limit);
    if (res.status === 401) {
      refreshPromise = null;
      token = await getValidAccessToken();
      if (!token) throw new Error('Spotify auth expired');
      res = await oneSearch(token, query, type, market, limit);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Spotify ${type} search failed: ${res.status} ${text}`);
    }
    return res.json();
  };

  const results = await Promise.all(
    types.map((t) => runForType(t).catch((err) => {
      console.warn(`[spotify ${t}]`, err?.message || String(err));
      return null;
    })),
  );

  const out = [];
  for (const data of results) {
    if (!data) continue;
    if (data.playlists?.items) {
      for (const p of data.playlists.items) {
        if (!p?.uri || !p?.name) continue;
        out.push({
          uri: p.uri,
          title: p.name,
          creator: p.owner?.display_name || '',
          albumArtURI: p.images?.[p.images.length - 1]?.url || '',
          source: 'spotify-playlist',
          meta: {tracks: p.tracks?.total || 0},
        });
      }
    }
    if (data.albums?.items) {
      for (const a of data.albums.items) {
        if (!a?.uri || !a?.name) continue;
        out.push({
          uri: a.uri,
          title: a.name,
          creator: (a.artists || []).map((x) => x.name).join(', '),
          albumArtURI: a.images?.[a.images.length - 1]?.url || '',
          source: 'spotify-album',
        });
      }
    }
    if (data.tracks?.items) {
      for (const t of data.tracks.items) {
        if (!t?.uri || !t?.name) continue;
        out.push({
          uri: t.uri,
          title: t.name,
          creator: (t.artists || []).map((x) => x.name).join(', '),
          albumArtURI: t.album?.images?.[t.album.images.length - 1]?.url || '',
          source: 'spotify-track',
        });
      }
    }
  }
  return out;
};
