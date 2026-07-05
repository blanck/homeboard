import 'react-native-get-random-values';
import EncryptedStorage from 'react-native-encrypted-storage';
import {fetchWithTimeout as fetch} from '../utils/fetchSafe';

// Lazy-loaded to avoid Metro module resolution issues at startup
let _p256 = null;
let _sha256 = null;
function getCrypto() {
  if (!_p256) {
    _p256 = require('@noble/curves/nist.js').p256;
    _sha256 = require('@noble/hashes/sha2.js').sha256;
  }
  return {p256: _p256, sha256: _sha256};
}

const BASE_URL = 'https://lion.lamarzocco.io/api/customer-app';
const INSTALL_KEY = 'lamarzocco_install_key';
const TOKEN_KEY = 'lamarzocco_tokens';

// --- Helpers ---

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function uint8ToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function leftRotate8(value, amount) {
  return ((value << amount) | (value >>> (8 - amount))) & 0xff;
}

function generateRequestProof(baseString, secret) {
  const {sha256} = getCrypto();
  const work = new Uint8Array(secret);
  const encoded = new TextEncoder().encode(baseString);

  for (const byteVal of encoded) {
    const idx = byteVal % 32;
    const shiftIdx = (idx + 1) % 32;
    const shiftAmount = work[shiftIdx] & 7;
    const xorResult = byteVal ^ work[idx];
    work[idx] = leftRotate8(xorResult, shiftAmount);
  }

  return uint8ToBase64(sha256(work));
}

// P-256 SubjectPublicKeyInfo DER prefix (26 bytes)
const P256_DER_PREFIX = new Uint8Array([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
  0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
  0x42, 0x00,
]);

function concat(...arrays) {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// --- Installation Key ---

function generateInstallKey() {
  const {p256, sha256} = getCrypto();
  const installationId = uuid().toLowerCase();
  const privateKey = p256.utils.randomSecretKey();
  const publicKey = p256.getPublicKey(privateKey, false); // uncompressed 65 bytes
  const publicKeyDer = concat(P256_DER_PREFIX, publicKey);

  const idHash = sha256(new TextEncoder().encode(installationId));
  const secretInput = `${installationId}.${uint8ToBase64(publicKeyDer)}.${uint8ToBase64(idHash)}`;
  const secret = sha256(new TextEncoder().encode(secretInput));

  return {installationId, privateKey, publicKeyDer, secret};
}

async function saveInstallKey(key) {
  await EncryptedStorage.setItem(
    INSTALL_KEY,
    JSON.stringify({
      installationId: key.installationId,
      privateKey: uint8ToBase64(key.privateKey),
      publicKeyDer: uint8ToBase64(key.publicKeyDer),
      secret: uint8ToBase64(key.secret),
    }),
  );
}

async function loadInstallKey() {
  try {
    const str = await EncryptedStorage.getItem(INSTALL_KEY);
    if (!str) return null;
    const data = JSON.parse(str);
    return {
      installationId: data.installationId,
      privateKey: base64ToUint8(data.privateKey),
      publicKeyDer: base64ToUint8(data.publicKeyDer),
      secret: base64ToUint8(data.secret),
    };
  } catch {
    return null;
  }
}

async function saveTokens(tokens) {
  await EncryptedStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

async function loadTokens() {
  try {
    const str = await EncryptedStorage.getItem(TOKEN_KEY);
    return str ? JSON.parse(str) : null;
  } catch {
    return null;
  }
}

// For LAN settings sync: move the auth (install key + tokens) between
// trusted devices so each kiosk does not need its own login.
export async function exportAuth() {
  const [installKey, tokens] = await Promise.all([
    EncryptedStorage.getItem(INSTALL_KEY),
    EncryptedStorage.getItem(TOKEN_KEY),
  ]);
  if (!installKey || !tokens) return null;
  return JSON.stringify({installKey, tokens});
}

export async function importAuth(str) {
  const parsed = JSON.parse(str);
  if (!parsed || !parsed.installKey || !parsed.tokens) {
    throw new Error('Invalid auth payload');
  }
  await EncryptedStorage.setItem(INSTALL_KEY, parsed.installKey);
  await EncryptedStorage.setItem(TOKEN_KEY, parsed.tokens);
}

// --- Request Signing ---

// Convert raw r||s (64 bytes) to DER-encoded ECDSA signature
function rawSigToDer(raw) {
  const r = raw.slice(0, 32);
  const s = raw.slice(32, 64);

  function intToDer(intBytes) {
    // Skip leading zeros but keep at least one byte
    let start = 0;
    while (start < intBytes.length - 1 && intBytes[start] === 0) start++;
    const trimmed = intBytes.slice(start);
    // Add leading zero if high bit set (to keep it positive)
    const needsPad = trimmed[0] >= 0x80;
    const len = trimmed.length + (needsPad ? 1 : 0);
    const result = new Uint8Array(2 + len);
    result[0] = 0x02; // INTEGER tag
    result[1] = len;
    if (needsPad) {
      result[2] = 0x00;
      result.set(trimmed, 3);
    } else {
      result.set(trimmed, 2);
    }
    return result;
  }

  const rDer = intToDer(r);
  const sDer = intToDer(s);
  const seqLen = rDer.length + sDer.length;
  const result = new Uint8Array(2 + seqLen);
  result[0] = 0x30; // SEQUENCE tag
  result[1] = seqLen;
  result.set(rDer, 2);
  result.set(sDer, 2 + rDer.length);
  return result;
}

function createAuthHeaders(installKey, token = null) {
  const {p256} = getCrypto();
  const nonce = uuid();
  const timestamp = String(Date.now());
  const proofInput = `${installKey.installationId}.${nonce}.${timestamp}`;
  const proof = generateRequestProof(proofInput, installKey.secret);
  const signatureData = `${proofInput}.${proof}`;

  const msgBytes = new TextEncoder().encode(signatureData);
  const rawSig = p256.sign(msgBytes, installKey.privateKey, {prehash: true});
  const derSig = rawSigToDer(rawSig);
  const signature = uint8ToBase64(derSig);

  const headers = {
    'Content-Type': 'application/json',
    'X-App-Installation-Id': installKey.installationId,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Request-Signature': signature,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

// --- API Registration ---

async function registerClient(installKey) {
  const {sha256} = getCrypto();
  const pkBase64 = uint8ToBase64(installKey.publicKeyDer);
  const pkHash = sha256(installKey.publicKeyDer);
  const baseString = `${installKey.installationId}.${uint8ToBase64(pkHash)}`;
  const proof = generateRequestProof(baseString, installKey.secret);

  const response = await fetch(`${BASE_URL}/auth/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Installation-Id': installKey.installationId,
      'X-Request-Proof': proof,
    },
    body: JSON.stringify({pk: pkBase64}),
  });

  const regBody = await response.text();
  //console.warn('LM: register status:', response.status, 'body:', regBody.slice(0, 300));
  return response.ok;
}

// --- Public API ---

export async function loginLaMarzocco(email, password) {
  // Always generate fresh key on login to ensure clean state
  await EncryptedStorage.removeItem(INSTALL_KEY);
  //console.warn('LM: generating new install key');
  let installKey = generateInstallKey();
  await saveInstallKey(installKey);
  //console.warn('LM: registering client');
  const registered = await registerClient(installKey);
  //console.warn('LM: registration result:', registered);
  if (!registered) {
    throw new Error('Failed to register with La Marzocco cloud');
  }

  // Sign in
  //console.warn('LM: signing in');
  const headers = createAuthHeaders(installKey);
  const signInRes = await fetch(`${BASE_URL}/auth/signin`, {
    method: 'POST',
    headers,
    body: JSON.stringify({username: email, password}),
  });

  //console.warn('LM: signin status:', signInRes.status);
  const signInBody = await signInRes.text();
  //console.warn('LM: signin body:', signInBody.slice(0, 500));

  if (!signInRes.ok) {
    if (signInRes.status === 401 || signInRes.status === 403 || signInRes.status === 412) {
      // Auth fails — regenerate install key, re-register, retry
      //console.warn('LM: regenerating install key for retry (status', signInRes.status, ')');
      await EncryptedStorage.removeItem(INSTALL_KEY);
      installKey = generateInstallKey();
      await saveInstallKey(installKey);
      //console.warn('LM: re-registering client');
      const registered = await registerClient(installKey);
      //console.warn('LM: re-registration result:', registered);
      if (!registered) throw new Error('Registration failed');

      const retryHeaders = createAuthHeaders(installKey);
      const retryRes = await fetch(`${BASE_URL}/auth/signin`, {
        method: 'POST',
        headers: retryHeaders,
        body: JSON.stringify({username: email, password}),
      });
      //console.warn('LM: retry status:', retryRes.status);
      if (!retryRes.ok) throw new Error('Login failed');
      const retryData = await retryRes.json();
      await saveTokens({
        accessToken: retryData.accessToken,
        refreshToken: retryData.refreshToken,
        username: email,
        savedAt: Date.now(),
      });
    } else {
      throw new Error(`Login failed (${signInRes.status})`);
    }
  } else {
    const data = JSON.parse(signInBody);
    await saveTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      username: email,
      savedAt: Date.now(),
    });
  }

  return await fetchMachines();
}

async function getValidToken() {
  const installKey = await loadInstallKey();
  const tokens = await loadTokens();
  if (!installKey || !tokens) return null;

  const age = Date.now() - (tokens.savedAt || 0);
  if (age > 50 * 60 * 1000) {
    try {
      const headers = createAuthHeaders(installKey);
      const res = await fetch(`${BASE_URL}/auth/refreshtoken`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          username: tokens.username,
          refreshToken: tokens.refreshToken,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newTokens = {
          ...tokens,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          savedAt: Date.now(),
        };
        await saveTokens(newTokens);
        return {installKey, token: newTokens.accessToken};
      }
    } catch {}
    return null;
  }

  return {installKey, token: tokens.accessToken};
}

export async function fetchMachines() {
  const auth = await getValidToken();
  if (!auth) return null;

  const headers = createAuthHeaders(auth.installKey, auth.token);
  const res = await fetch(`${BASE_URL}/things`, {headers});
  if (!res.ok) return null;

  const things = await res.json();
  return things
    .filter((t) => t.type === 'CoffeeMachine')
    .map((t) => ({
      serialNumber: t.serialNumber,
      name: t.name,
      model: t.modelName,
      connected: t.connected,
    }));
}

export async function fetchLaMarzoccoStatus(serialNumber) {
  if (!serialNumber) return null;

  const auth = await getValidToken();
  if (!auth) return null;

  const headers = createAuthHeaders(auth.installKey, auth.token);
  const res = await fetch(`${BASE_URL}/things/${serialNumber}/dashboard`, {
    headers,
  });
  if (!res.ok) return null;

  const data = await res.json();
  const widgets = data.widgets || [];

  const machineStatus = widgets.find((w) => w.code === 'CMMachineStatus');
  const coffeeBoiler = widgets.find((w) => w.code === 'CMCoffeeBoiler');
  const steamBoiler =
    widgets.find((w) => w.code === 'CMSteamBoilerTemperature') ||
    widgets.find((w) => w.code === 'CMSteamBoilerLevel');

  return {
    connected: data.connected,
    name: data.name,
    model: data.modelName,
    status: machineStatus?.output?.status || 'Off',
    mode: machineStatus?.output?.mode || null,
    coffeeBoiler: coffeeBoiler
      ? {
          status: coffeeBoiler.output.status,
          enabled: coffeeBoiler.output.enabled,
          temperature: coffeeBoiler.output.targetTemperature,
          ready: coffeeBoiler.output.status === 'Ready',
        }
      : null,
    steamBoiler: steamBoiler
      ? {
          status: steamBoiler.output.status,
          enabled: steamBoiler.output.enabled,
          level: steamBoiler.output.targetLevel || null,
          temperature: steamBoiler.output.targetTemperature || null,
        }
      : null,
  };
}

export async function toggleLaMarzoccoMode(serialNumber, mode) {
  if (!serialNumber) return false;

  const auth = await getValidToken();
  if (!auth) return false;

  const headers = createAuthHeaders(auth.installKey, auth.token);
  const res = await fetch(
    `${BASE_URL}/things/${serialNumber}/command/CoffeeMachineChangeMode`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({mode}),
    },
  );

  return res.ok;
}

export async function clearLaMarzoccoAuth() {
  try {
    await EncryptedStorage.removeItem(INSTALL_KEY);
    await EncryptedStorage.removeItem(TOKEN_KEY);
  } catch {}
}
