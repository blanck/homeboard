# Homeboard Web (Raspberry Pi / kiosk)

The dashboard for the Raspberry Pi + touchscreen setup. This is **the same app as the Android version**: it renders the React Native code in `../reactnative/src` in a browser via [react-native-web], so every widget, setting, and design detail matches the tablet app. There is no separate feature port to maintain.

## How it works

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│ Chromium (kiosk, fullscreen)│        │ server.mjs (Node)            │
│  dist/ bundle               │───────▶│  · serves dist/              │
│  reactnative/src via        │ /proxy │  · CORS proxy for all APIs   │
│  react-native-web + shims   │◀──────▶│  · UDP bridge (WebSocket)    │
└─────────────────────────────┘  /udp- │    SSDP + LAN settings sync  │
                                 bridge└──────────────────────────────┘
```

- **`vite.config.mjs`** aliases `react-native` to `react-native-web` and swaps native-only modules (`src/shims/`): storage goes to `localStorage`, UDP goes through the WebSocket bridge, Lottie renders with `lottie-web`, vector icons render from the icon ttf.
- **`server.mjs`** has no dependencies beyond `ws`. `/proxy?url=...` forwards requests so the browser escapes CORS (Sonos SOAP on the LAN, Tibber, RSS feeds, La Marzocco, ...). The `/udp-bridge` WebSocket relays real UDP sockets, so Sonos SSDP discovery and LAN settings sync work exactly like on Android. Proxy and bridge only answer clients on private (LAN) addresses.

## Configuration

Configure everything in the Settings UI (cog in the top-right corner), same as on Android, or push settings from the tablet: open **Settings → Sync** on both devices and send sections (keys included) from the tablet to the Pi.

**Legacy config import**: on first run (no saved settings yet), the app asks the server for the old root `config.js` (looked up next to the repo and at `~/homeboard/config.js`) and imports it into the new settings structure: location, timezones, weather key, Netatmo forecast, Sonos (the group name is resolved to a speaker IP via live SSDP discovery), calendars, Tibber, playlists (icons remapped), news headline prefs, and background image. The old newsapi.org keys have no equivalent in the new multi-provider news setup; add a NewsData.io / TheNewsAPI / Currents key in Settings → News, or sync the News section from the tablet.

Secrets note: the browser has no Keychain, so API keys are kept in Chromium's `localStorage` on the device. Treat the Pi as a trusted device on a trusted network, and do not port-forward port 8080 to the internet.

**OAuth on web (Spotify / Tibber Data API)**: providers require https redirect URIs, so static forwarder pages on Firebase Hosting (`www/oauth/spotify/` and `www/oauth/tibber/`, deployed to `homeboard-1.web.app`) receive the callback and bounce it, query intact, to `http://localhost:8080/oauth/...` where the app completes the PKCE exchange. Browse the kiosk at `http://localhost:8080`: tokens and settings are stored per-origin, and the forwarder returns there. Register once:

- Spotify app dashboard (<https://developer.spotify.com/dashboard>): `https://homeboard-1.web.app/oauth/spotify`
- Tibber OAuth client console (<https://data-api.tibber.com/clients/manage>): `https://homeboard-1.web.app/oauth/tibber`

Note: Tibber clients are managed at `data-api.tibber.com/clients/manage`, NOT at `thewall.tibber.com`. The wall is only the sign-in/token endpoint and shows a blank page if you visit it directly.

Forks: deploy your own forwarder pages (`firebase deploy --only hosting`) and change the two `REDIRECT_URI` constants in `reactnative/src/services/*OAuthService.js`.

## Install on a Raspberry Pi

Assumes the base system setup from the root readme (Chromium, X11, nvm, pm2).

**Chromium requirement (important)**: the kiosk browser must be **Chromium 84 or newer**. Older Buster installs shipped Chromium 78, which renders the dashboard with all flexbox gaps collapsed (the bundle's JS itself is built to parse on 78, but `gap` support arrived in 84). Buster's own archive has 92, so this is one command:

```sh
sudo apt-get update && sudo apt-get install -y chromium-browser   # 78 -> 92 on Buster
```

**Node requirements**: the server (`server.mjs`) runs on Node 16+, deliberately, because Raspbian Buster's libstdc++ cannot run Node 18+. Building the bundle (Vite) needs Node 18+, so on a Buster Pi you build on your dev machine and push with `web/deploy-to-pi.sh` (rsyncs `dist/` + `server.mjs`, installs `ws`, swaps the pm2 process, refreshes the kiosk browser). On a Pi with a newer OS you can build on-device instead:

```sh
git clone https://github.com/blanck/homeboard.git ~/homeboard
cd ~/homeboard/web
npm install
npm run build
pm2 start server.mjs --name homeboard-web
pm2 save
```

Autostart the kiosk on boot (replaces the legacy `start.sh` line):

```sh
echo "@sh /home/pi/homeboard-web/start-kiosk.sh &" | sudo tee -a /etc/xdg/lxsession/LXDE-pi/autostart
```

`start-kiosk.sh` only preps the display and launches Chromium at `http://localhost:8080`; pm2's systemd unit resurrects the server. (`start.sh` is the variant for Pis that can build on-device: it also pulls master and rebuilds on every boot.)

### Migrating from the legacy web app

```sh
pm2 delete server        # stop the old socket.io backend
cd ~/homeboard && git pull
cd web && npm install && npm run build
pm2 start server.mjs --name homeboard-web
pm2 save
```

Then update the autostart entry as above. The old `config.js` is not read; re-enter settings in the UI or sync them from the Android app.

### Any other Linux box (e.g. a Dell PC)

Nothing is Pi-specific: install Node 20+ and Chromium, then follow the same steps. `PORT=8080` can be overridden via environment.

## Local development

```sh
cd web
npm install
node server.mjs           # terminal 1: proxy + UDP bridge on :8080
npm run dev               # terminal 2: Vite dev server with HMR on :5173
```

The Vite dev server proxies `/proxy` and `/udp-bridge` to `localhost:8080`. For production testing: `npm run build && node server.mjs` and open `http://localhost:8080`.

## Fonts

Icons ship with the bundle (Material Community Icons ttf). Text uses Roboto when available; on the Pi run `sudo apt install fonts-roboto` for a pixel-perfect match with Android.

[react-native-web]: https://necolas.github.io/react-native-web/
