// Tibber Data API OAuth credentials.
//
// To use the Tibber widgets you need a registered Tibber developer app:
//   https://thewall.tibber.com  →  register a native/desktop app with
//   redirect URI: homeboard://oauth/tibber
//
// On first `npm install` this file is copied to `secrets.local.js`
// (which is gitignored). Edit the copy, not this file.
//
// CI release builds overwrite `secrets.local.js` with values from
// GitHub Secrets; the published APKs in Releases ship with the
// project owner's Tibber credentials baked in.
//
// If you contribute and don't want to register your own Tibber app,
// ask the repo admin for credentials.

export const TIBBER_CLIENT_ID = '';
export const TIBBER_CLIENT_SECRET = '';
