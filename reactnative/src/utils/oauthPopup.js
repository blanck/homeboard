// On web the OAuth flow opens in a popup owned by the dashboard: the kiosk
// browser has no tab/window UI, so navigating away (or a provider button like
// "Continue with Apple" spawning an unclosable window) strands the screen.
// The Firebase forwarder pages postMessage the callback query back to this
// opener and close themselves; a timeout closes abandoned logins so the
// dashboard always comes back.
import {Platform, Linking} from 'react-native';

const POPUP_TIMEOUT_MS = 5 * 60 * 1000;

export const openOAuthUrl = async (url) => {
  if (Platform.OS !== 'web') {
    await Linking.openURL(url);
    return;
  }
  const popup = window.open(url, 'homeboard-oauth');
  if (!popup) {
    // Popup blocked: same-tab navigation, the forwarder redirects back here
    window.location.assign(url);
    return;
  }
  const timer = setTimeout(() => {
    try {
      if (!popup.closed) popup.close();
    } catch {}
  }, POPUP_TIMEOUT_MS);
  const poll = setInterval(() => {
    if (popup.closed) {
      clearTimeout(timer);
      clearInterval(poll);
    }
  }, 1000);
};
