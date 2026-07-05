// 'react-native' resolves here on web: react-native-web plus the few
// modules it does not implement. Explicit exports below shadow the
// same-named star re-exports.
import * as RNW from 'react-native-web';

export * from 'react-native-web';
export default RNW;

export const DevSettings = {
  reload: () => window.location.reload(),
  addMenuItem: () => {},
};

// RNW's Alert is a no-op stub; use a real dialog.
export const Alert = {
  alert: (title, message) => {
    window.alert(message ? `${title}\n\n${message}` : String(title));
  },
};

const GRANTED = 'granted';
export const PermissionsAndroid = {
  PERMISSIONS: new Proxy({}, {get: (_t, name) => `web.permission.${String(name)}`}),
  RESULTS: {GRANTED, DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again'},
  request: async () => GRANTED,
  requestMultiple: async () => ({}),
  check: async () => true,
};
