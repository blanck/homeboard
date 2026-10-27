import React from 'react';
import './polyfills';
import './runtime';
import {AppRegistry} from 'react-native-web';
import App from '@homeboard/rn/App';
import PhoneSettings from './PhoneSettings';
import {importLegacyConfigIfFresh} from './legacy-import';
import {getRev, localWriteRev} from './shims/shared-store';
import OnScreenKeyboard from './OnScreenKeyboard';
import mciFont from 'react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf';
import miFont from 'react-native-vector-icons/Fonts/MaterialIcons.ttf';

// A phone gets the settings UI, the wall display gets the dashboard. The
// smaller viewport edge separates them (any phone is under 800 either way
// up, the 1080-tall kiosk is not); ?settings and ?dashboard force it.
const params = new URLSearchParams(window.location.search);
const settingsOnly =
  params.has('settings') ||
  (!params.has('dashboard') &&
    Math.min(window.innerWidth, window.innerHeight) < 800);

const loadFont = (family, url) => {
  const face = new FontFace(family, `url(${url})`);
  document.fonts.add(face);
  return face.load();
};

// Settings saved from a phone bump the store revision; pick them up without
// anyone having to touch the wall display.
const watchForRemoteEdits = async () => {
  let known;
  try {
    known = await getRev();
  } catch {
    return;
  }
  setInterval(async () => {
    try {
      const rev = await getRev();
      if (rev === known) return;
      // Saving settings here bumps the revision too; reloading on our own
      // write refreshed the kiosk every time its settings modal was closed
      if (rev === localWriteRev()) {
        known = rev;
        return;
      }
      window.location.reload();
    } catch {
      // server briefly unreachable; keep the current config on screen
    }
  }, 15000);
};

Promise.allSettled([
  loadFont('MaterialCommunityIcons', mciFont),
  loadFont('MaterialIcons', miFont),
  settingsOnly ? Promise.resolve() : importLegacyConfigIfFresh(),
]).then(() => {
  // The kiosk has no soft keyboard of its own; a phone already does
  const Root = settingsOnly
    ? PhoneSettings
    : () => (
        <>
          <App />
          <OnScreenKeyboard />
        </>
      );
  AppRegistry.registerComponent('Homeboard', () => Root);
  AppRegistry.runApplication('Homeboard', {
    rootTag: document.getElementById('root'),
  });
  if (!settingsOnly) watchForRemoteEdits();
});
