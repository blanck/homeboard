import 'react-native-get-random-values';
import {p256} from '@noble/curves/nist.js';
import {sha256} from '@noble/hashes/sha2.js';
import {gcm} from '@noble/ciphers/aes.js';

export const SYNC_PORT = 41234;
export const MULTICAST_ADDR = '239.255.255.251';

export const generateKeypair = () => {
  const priv = p256.utils.randomSecretKey();
  const pub = p256.getPublicKey(priv);
  return {priv, pub};
};

const u8ToB64 = (b) => {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
};

const b64ToU8 = (s64) => {
  const s = atob(s64);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
};

export const encodeBytes = u8ToB64;
export const decodeBytes = b64ToU8;

export const deriveSharedKey = (myPriv, theirPubBytes) => {
  const shared = p256.getSharedSecret(myPriv, theirPubBytes);
  return sha256(shared.slice(1));
};

export const encrypt = (key, plaintext) => {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = gcm(key, iv).encrypt(new TextEncoder().encode(plaintext));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return u8ToB64(out);
};

export const decrypt = (key, b64) => {
  try {
    const buf = b64ToU8(b64);
    if (buf.length < 12 + 16) return null;
    const iv = buf.slice(0, 12);
    const ct = buf.slice(12);
    const pt = gcm(key, iv).decrypt(ct);
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
};

export const newRequestId = () => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const escapeField = (s) => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
const unescapeField = (s) => s.replace(/\\\|/g, '|').replace(/\\\\/g, '\\');

const splitFields = (s) => {
  const out = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      cur += s[i] + s[i + 1];
      i++;
    } else if (s[i] === '|') {
      out.push(unescapeField(cur));
      cur = '';
    } else {
      cur += s[i];
    }
  }
  out.push(unescapeField(cur));
  return out;
};

export const buildAnnounce = (id, name) => `HBANN|${escapeField(id)}|${escapeField(name)}`;
export const buildRequest = (reqId, senderId, senderName, section, senderPub) =>
  `HBREQ|${reqId}|${escapeField(senderId)}|${escapeField(senderName)}|${section}|${encodeBytes(senderPub)}`;
export const buildAccept = (reqId, receiverPub) => `HBOK|${reqId}|${encodeBytes(receiverPub)}`;
export const buildDecline = (reqId) => `HBNO|${reqId}`;
export const buildData = (reqId, ciphertextB64) => `HBDATA|${reqId}|${ciphertextB64}`;
export const buildChunk = (reqId, idx, total, chunk) => `HBCHUNK|${reqId}|${idx}|${total}|${chunk}`;

export const parseMessage = (str) => {
  if (!str) return null;
  const parts = splitFields(str);
  const type = parts[0];
  switch (type) {
    case 'HBANN':
      return parts.length >= 3 ? {type, id: parts[1], name: parts[2]} : null;
    case 'HBREQ':
      return parts.length >= 6
        ? {
            type,
            reqId: parts[1],
            senderId: parts[2],
            senderName: parts[3],
            section: parts[4],
            senderPub: decodeBytes(parts[5]),
          }
        : null;
    case 'HBOK':
      return parts.length >= 3
        ? {type, reqId: parts[1], receiverPub: decodeBytes(parts[2])}
        : null;
    case 'HBNO':
      return parts.length >= 2 ? {type, reqId: parts[1]} : null;
    case 'HBDATA':
      return parts.length >= 3 ? {type, reqId: parts[1], ciphertext: parts[2]} : null;
    case 'HBCHUNK':
      return parts.length >= 5
        ? {
            type,
            reqId: parts[1],
            idx: parseInt(parts[2], 10),
            total: parseInt(parts[3], 10),
            chunk: parts[4],
          }
        : null;
    default:
      return null;
  }
};
