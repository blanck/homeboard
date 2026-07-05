// The Pi/kiosk build has no Keychain/Keystore; secrets live in localStorage.
// The device runs on a trusted home network only, same stance as LAN sync.
const PREFIX = 'hbes:';

const ls = () => window.localStorage;

const EncryptedStorage = {
  getItem: async (key) => ls().getItem(PREFIX + key),
  setItem: async (key, value) => ls().setItem(PREFIX + key, String(value)),
  removeItem: async (key) => ls().removeItem(PREFIX + key),
  clear: async () => {
    for (const k of Object.keys(ls())) {
      if (k.startsWith(PREFIX)) ls().removeItem(k);
    }
  },
};

export default EncryptedStorage;
