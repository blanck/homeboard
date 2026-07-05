import {Platform} from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import 'react-native-get-random-values';
import {fetchWithTimeout} from '../utils/fetchSafe';
import {TIBBER_CLIENT_ID, TIBBER_CLIENT_SECRET} from '../secrets.local';

const CLIENT_ID = TIBBER_CLIENT_ID;
const CLIENT_SECRET = TIBBER_CLIENT_SECRET;
// On web, a static forwarder page on Firebase Hosting
// (www/oauth/tibber/index.html) bounces the callback with its query back to
// http://127.0.0.1:8080. Register this exact URI in the Tibber developer
// console (thewall.tibber.com).
const REDIRECT_URI =
  Platform.OS === 'web'
    ? 'https://homeboard-1.web.app/oauth/tibber'
    : 'homeboard://oauth/tibber';
const SCOPES = 'openid profile email offline_access data-api-user-read data-api-homes-read data-api-vehicles-read data-api-chargers-read data-api-thermostats-read data-api-energy-systems-read data-api-inverters-read';
const AUTHORIZE_URL = 'https://thewall.tibber.com/connect/authorize';
const TOKEN_URL = 'https://thewall.tibber.com/connect/token';
const TOKENS_KEY = 'tibber_data_api_tokens';
const PKCE_KEY = 'tibber_pkce_pending';

// Base64url encode
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

// SHA-256 hash
const sha256 = (plain) => {
  const {sha256: hash} = require('@noble/hashes/sha2.js');
  // Encode string to UTF-8 bytes without TextEncoder (not available in RN)
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

// Generate PKCE code_verifier and code_challenge
export const generatePKCE = async () => {
  const randomBytes = new Uint8Array(64);
  crypto.getRandomValues(randomBytes);
  const codeVerifier = base64url(randomBytes);
  const challengeHash = await sha256(codeVerifier);
  const codeChallenge = base64url(challengeHash);
  return {codeVerifier, codeChallenge};
};

export const isOAuthConfigured = () => Boolean(CLIENT_ID && CLIENT_SECRET);

// Build authorization URL and store PKCE state
export const startOAuthFlow = async () => {
  if (!isOAuthConfigured()) {
    throw new Error(
      'Tibber OAuth not configured. Edit reactnative/src/secrets.local.js or use a release APK.',
    );
  }
  const {codeVerifier, codeChallenge} = await generatePKCE();
  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = base64url(stateBytes);

  // Store PKCE verifier + state for the callback
  await EncryptedStorage.setItem(PKCE_KEY, JSON.stringify({codeVerifier, state}));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
};

// Exchange authorization code for tokens
export const exchangeCodeForTokens = async (code, receivedState) => {
  const pkceStr = await EncryptedStorage.getItem(PKCE_KEY);
  if (!pkceStr) throw new Error('No pending PKCE state');

  const {codeVerifier, state} = JSON.parse(pkceStr);
  if (state !== receivedState) throw new Error('State mismatch');

  // Clean up PKCE state
  await EncryptedStorage.removeItem(PKCE_KEY);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: codeVerifier,
  });

  let res;
  try {
    res = await fetchWithTimeout(TOKEN_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: body.toString(),
    });
  } catch (e) {
    throw new Error('Token exchange network error');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
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

// Refresh access token
export const refreshAccessToken = async (refreshToken) => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
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

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  const tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  await storeTokens(tokens);
  return tokens;
};

// Token storage
export const storeTokens = async (tokens) => {
  await EncryptedStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
};

export const loadTokens = async () => {
  try {
    const str = await EncryptedStorage.getItem(TOKENS_KEY);
    return str ? JSON.parse(str) : null;
  } catch {
    return null;
  }
};

export const clearTokens = async () => {
  await EncryptedStorage.removeItem(TOKENS_KEY);
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

// Refresh mutex to prevent concurrent refreshes
let refreshPromise = null;

// Get a valid access token, refreshing if needed
export const getValidAccessToken = async () => {
  const tokens = await loadTokens();
  if (!tokens) return null;

  // If token still valid (with 60s margin), return it
  if (tokens.expiresAt > Date.now() + 60000) {
    return tokens.accessToken;
  }

  // Token expired, refresh
  return forceRefreshToken();
};

// Force a token refresh (used on expiry or 401 retry)
export const forceRefreshToken = async () => {
  const tokens = await loadTokens();
  if (!tokens?.refreshToken) return null;

  // Mutex: if already refreshing, wait for that promise
  if (refreshPromise) {
    const result = await refreshPromise;
    return result?.accessToken || null;
  }

  refreshPromise = refreshAccessToken(tokens.refreshToken);
  try {
    const newTokens = await refreshPromise;
    return newTokens?.accessToken || null;
  } finally {
    refreshPromise = null;
  }
};

// Check if connected (has tokens)
export const isDataApiConnected = async () => {
  const tokens = await loadTokens();
  return !!tokens;
};
