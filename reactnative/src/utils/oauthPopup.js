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

// Mobile browsers only allow window.open inside the tap that triggered it.
// Building the authorize URL needs crypto.subtle, whose await breaks that
// chain, so open the window first and point it at the URL once it is ready.
// Without this the popup is blocked, the forwarder finds no opener, and a
// phone gets sent to localhost:8080 (itself) instead of back to the app.
export const openOAuthWindow = () => {
  if (Platform.OS !== 'web') {
    return {
      navigate: (url) => Linking.openURL(url),
      close: () => {},
    };
  }
  const popup = window.open('', 'homeboard-oauth');
  if (popup) {
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
  }
  return {
    navigate: (url) => {
      if (popup && !popup.closed) popup.location.replace(url);
      // Popup blocked anyway: same-tab navigation still completes the flow
      else window.location.assign(url);
    },
    close: () => {
      try {
        if (popup && !popup.closed) popup.close();
      } catch {}
    },
  };
};
