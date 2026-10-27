// The Pi/kiosk build has no Keychain/Keystore. Secrets are kept in the shared
// server store so a phone on the LAN configures the same device the wall
// display renders, with a localStorage copy as an offline fallback.
// The device runs on a trusted home network only, same stance as LAN sync.
import {isShared, remoteGet, remoteSet, remoteRemove} from './shared-store';

const PREFIX = 'hbes:';

const ls = () => window.localStorage;

const EncryptedStorage = {
  getItem: async (key) => {
    if (!isShared(key)) return ls().getItem(PREFIX + key);
    try {
      const value = await remoteGet(key);
      // Empty store on first run: adopt this browser's secrets rather than
      // handing back null and wiping keys the device already had.
      if (value === null) {
        const local = ls().getItem(PREFIX + key);
        if (local) await remoteSet(key, local).catch(() => {});
        return local;
      }
      ls().setItem(PREFIX + key, value);
      return value;
    } catch {
      return ls().getItem(PREFIX + key);
    }
  },
  setItem: async (key, value) => {
    ls().setItem(PREFIX + key, String(value));
    if (!isShared(key)) return;
    try {
      await remoteSet(key, String(value));
    } catch (err) {
      console.warn(`Homeboard: could not save ${key} to the shared store:`, err.message);
    }
  },
  removeItem: async (key) => {
    ls().removeItem(PREFIX + key);
    if (!isShared(key)) return;
    try {
      await remoteRemove(key);
    } catch (err) {
      console.warn(`Homeboard: could not remove ${key} from the shared store:`, err.message);
    }
  },
  clear: async () => {
    for (const k of Object.keys(ls())) {
      if (k.startsWith(PREFIX)) ls().removeItem(k);
    }
  },
};

export default EncryptedStorage;
