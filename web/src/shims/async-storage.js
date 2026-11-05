import {isShared, readShared, remoteSet, remoteRemove} from './shared-store';

const PREFIX = 'hbas:';

const ls = () => window.localStorage;

const writeShared = async (key, value) => {
  ls().setItem(PREFIX + key, String(value));
  try {
    await remoteSet(key, String(value));
  } catch (err) {
    console.warn(`Homeboard: could not save ${key} to the shared store:`, err.message);
  }
};

const AsyncStorage = {
  getItem: async (key) =>
    isShared(key) ? readShared(key, PREFIX + key) : ls().getItem(PREFIX + key),
  setItem: async (key, value) => {
    if (isShared(key)) return writeShared(key, value);
    ls().setItem(PREFIX + key, String(value));
  },
  removeItem: async (key) => {
    ls().removeItem(PREFIX + key);
    if (isShared(key)) {
      try {
        await remoteRemove(key);
      } catch (err) {
        console.warn(`Homeboard: could not remove ${key} from the shared store:`, err.message);
      }
    }
  },
  getAllKeys: async () =>
    Object.keys(ls())
      .filter((k) => k.startsWith(PREFIX))
      .map((k) => k.slice(PREFIX.length)),
  multiGet: async (keys) =>
    Promise.all(keys.map(async (k) => [k, await AsyncStorage.getItem(k)])),
  multiSet: async (pairs) => {
    for (const [k, v] of pairs) await AsyncStorage.setItem(k, v);
  },
  multiRemove: async (keys) => {
    for (const k of keys) await AsyncStorage.removeItem(k);
  },
  mergeItem: async (key, value) => {
    const current = await AsyncStorage.getItem(key);
    const merged = current ? {...JSON.parse(current), ...JSON.parse(value)} : JSON.parse(value);
    await AsyncStorage.setItem(key, JSON.stringify(merged));
  },
  clear: async () => {
    for (const k of Object.keys(ls())) {
      if (k.startsWith(PREFIX)) ls().removeItem(k);
    }
  },
};

export default AsyncStorage;
