# Homeboard

Personal home dashboard for a wall-mounted tablet. **Public GitHub repo** — assume anything committed is world-readable.

## Three codebases in this repo

- **`reactnative/`**: active React Native rewrite (RN 0.84, React 19, Zustand). Currently tested on a large Android tablet. This is where new work goes.
- **`web/`**: Pi/kiosk build that renders `reactnative/src` in a browser via react-native-web (Vite). No app code of its own, only native-module shims (`web/src/shims/`) and `server.mjs` (static hosting + CORS proxy + UDP-WebSocket bridge for SSDP/LAN sync). Feature changes belong in `reactnative/src`; touch `web/` only when a new native module needs a shim. Keep `reactnative/src` free of `require()` calls except the noble ones mapped in `web/src/runtime.js`.
- **Root (`src/`, `server.js`, `build/`, `www/`)**: legacy Framework7 + Vue 2 web app with a Node/Express + socket.io backend. Deprecated, superseded by `web/`; avoid changes unless asked.

## Secrets handling

- **Never commit API keys or credentials.** This repo is public.
- Personal config lives in `config.js` (root) — gitignored. `config.sample.js` is the placeholder template; keep it stripped of real keys.
- React Native: user-supplied secrets (API keys, OAuth tokens, passwords) go in `EncryptedStorage` (Keychain/Keystore). Non-secret preferences go in `AsyncStorage`. See `src/components/SettingsModal.js` for the split.
- Tibber OAuth `CLIENT_ID` / `CLIENT_SECRET` are read from `reactnative/src/secrets.local.js` (gitignored). `secrets.local.example.js` is the committed template. `npm install` runs a postinstall that copies the example to the real file if missing. The release workflow (`.github/workflows/release.yml`) overwrites that file from GitHub Secrets before building, so APKs in Releases ship with creds baked in but the source repo stays clean. Tibber OAuth clients (redirect URIs, new apps) are managed at <https://data-api.tibber.com/clients/manage>; `thewall.tibber.com` is only the sign-in/token endpoint and has no UI.
- Don't print secrets to logs. Existing `console.warn` calls in `lamarzoccoService.js` that dumped tokens are commented out — keep them that way.

## React Native architecture (`reactnative/src/`)

- `App.js` / `Dashboard.js` — entry + main layout
- `components/` — UI, including `SettingsModal.js` (tabbed settings) and `settings/*Tab.js`
- `services/` — external API clients (tibber, sonos, lamarzocco, weather, news, calendar, stock)
- `widgets/` — dashboard tiles
- `store/` — Zustand store
- `config/defaults.js` — default config shape; users override via Settings UI
- `utils/translations.js` — en/sv strings; `utils/qrSections.js` — settings sync codec

Settings sync: UDP on `239.255.255.251:41234` (multicast announce, unicast send). Section payloads are sent in plaintext — encryption was attempted but couldn't be made reliable, so the LAN-sync feature accepts the risk and is intended for trusted home networks only. See `utils/lanSync.js` and `utils/qrSections.js`.

Tibber Data API uses OAuth + PKCE (`services/tibberOAuthService.js`). The classic `tibber-api` GraphQL token is user-supplied per-account.

## Build / run

Root (legacy): `npm run dev` (webpack), `npm run server` (express+socket on `config.web.socket`).
React Native: `cd reactnative && npm start` (Metro), `npm run android` / `npm run ios`.

## Conventions

- Prettier config: single quotes, no semicolons (root) / semicolons (reactnative — separate `.prettierrc.js`).
- Don't add comments unless the *why* is non-obvious.
- Languages supported: `en`, `sv`. New user-facing strings need both.
