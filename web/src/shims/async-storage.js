const PREFIX = 'hbas:';

const ls = () => window.localStorage;

const AsyncStorage = {
  getItem: async (key) => ls().getItem(PREFIX + key),
  setItem: async (key, value) => ls().setItem(PREFIX + key, String(value)),
  removeItem: async (key) => ls().removeItem(PREFIX + key),
  getAllKeys: async () =>
    Object.keys(ls())
      .filter((k) => k.startsWith(PREFIX))
      .map((k) => k.slice(PREFIX.length)),
  multiGet: async (keys) => keys.map((k) => [k, ls().getItem(PREFIX + k)]),
  multiSet: async (pairs) => pairs.forEach(([k, v]) => ls().setItem(PREFIX + k, String(v))),
  multiRemove: async (keys) => keys.forEach((k) => ls().removeItem(PREFIX + k)),
  mergeItem: async (key, value) => {
    const current = ls().getItem(PREFIX + key);
    const merged = current ? {...JSON.parse(current), ...JSON.parse(value)} : JSON.parse(value);
    ls().setItem(PREFIX + key, JSON.stringify(merged));
  },
  clear: async () => {
    for (const k of Object.keys(ls())) {
      if (k.startsWith(PREFIX)) ls().removeItem(k);
    }
  },
};

export default AsyncStorage;
