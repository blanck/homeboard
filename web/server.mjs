// Homeboard web server for the Pi/kiosk deployment.
// - Serves the built dashboard from dist/
// - /proxy?url=... forwards requests so the browser escapes CORS
//   (Sonos SOAP, Tibber, RSS feeds, La Marzocco, ...)
// - /udp-bridge WebSocket relays UDP for SSDP discovery and LAN settings sync
//
// Only clients on private (LAN/loopback) addresses may use the proxy and
// bridge. Do not port-forward this server to the internet.
//
// Uses node:http/https instead of fetch so it runs on Node 16 (the newest
// that works on Raspbian Buster's libstdc++).

import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {exec} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {WebSocketServer} from 'ws';

const cjsRequire = createRequire(import.meta.url);

const PORT = Number(process.env.PORT || 8080);
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PROXY_TIMEOUT_MS = 30000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

const isPrivateAddress = (addr = '') => {
  const ip = addr.replace(/^::ffff:/, '');
  if (ip === '::1' || ip === 'localhost') return true;
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^fe80:/i.test(ip) || /^f[cd]/i.test(ip)) return true;
  return false;
};

// DNS rebinding points a public name at this server, so only LAN-style names
// and private IPs may reach the API. Extra names: HOMEBOARD_ALLOWED_HOSTS=a,b
const EXTRA_HOSTS = new Set(
  (process.env.HOMEBOARD_ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);
const isAllowedHost = (hostHeader) => {
  if (!hostHeader) return true;
  const h = String(hostHeader).toLowerCase();
  const name = h.startsWith('[') ? h.slice(1, h.indexOf(']')) : h.replace(/:\d+$/, '');
  if (EXTRA_HOSTS.has(name)) return true;
  if (/^[\d.]+$/.test(name) || name.includes(':')) return isPrivateAddress(name);
  if (!/^[a-z0-9.-]+$/.test(name)) return false;
  if (!name.includes('.')) return true;
  return /\.(local|lan|home|internal|localhost|home\.arpa)$/.test(name);
};

// The IP check alone lets any page the kiosk or phone renders post here, since
// those requests come from a LAN address too
const crossSiteReason = (req) => {
  if (req.headers['sec-fetch-site'] === 'cross-site') return 'cross-site request';
  const {origin} = req.headers;
  if (origin === undefined) return null;
  try {
    if (new URL(origin).host === String(req.headers.host || '').toLowerCase()) return null;
  } catch {}
  return 'cross-origin request';
};

const apiDenied = (req) => {
  if (!isPrivateAddress(req.socket.remoteAddress)) return 'LAN only';
  if (!isAllowedHost(req.headers.host)) return 'unknown host';
  return crossSiteReason(req);
};

const fail = (res, status, message = '') => {
  if (res.writableEnded) return;
  if (!res.headersSent) res.writeHead(status);
  res.end(message);
};

const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'origin',
  'referer',
  'connection',
  'upgrade',
  'content-length',
  'cookie',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
]);

// Bodies are piped through raw (no decompression), so content-encoding and
// content-length pass straight to the browser.
const STRIP_RESPONSE_HEADERS = new Set([
  'transfer-encoding',
  'connection',
  'keep-alive',
  'set-cookie',
  'content-security-policy',
  'strict-transport-security',
]);

const forwardRequest = (target, method, headers, body, res, redirectsLeft) => {
  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    res.writeHead(400);
    res.end('Bad proxy url');
    return;
  }
  const mod = targetUrl.protocol === 'https:' ? https : http;

  const outHeaders = {...headers};
  if (body) outHeaders['content-length'] = Buffer.byteLength(body);

  const upstream = mod.request(
    targetUrl,
    {method, headers: outHeaders, timeout: PROXY_TIMEOUT_MS},
    (up) => {
      const status = up.statusCode || 502;
      const location = up.headers.location;
      if (
        location &&
        [301, 302, 303, 307, 308].includes(status) &&
        redirectsLeft > 0 &&
        (method === 'GET' || method === 'HEAD')
      ) {
        up.resume();
        const next = new URL(location, targetUrl).toString();
        forwardRequest(next, method, headers, body, res, redirectsLeft - 1);
        return;
      }
      const respHeaders = {};
      for (const [name, value] of Object.entries(up.headers)) {
        if (!STRIP_RESPONSE_HEADERS.has(name.toLowerCase())) respHeaders[name] = value;
      }
      // Redirects are followed here, so the page only learns the final URL from this
      respHeaders['x-proxy-final-url'] = targetUrl.toString();
      respHeaders['access-control-expose-headers'] = 'x-proxy-final-url';
      res.writeHead(status, respHeaders);
      up.pipe(res);
    },
  );

  upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
  upstream.on('error', (err) => fail(res, 502, `Proxy error: ${err.message}`));
  // The page went away mid-response: stop pulling the upstream body
  res.once('close', () => {
    if (!res.writableEnded) upstream.destroy();
  });

  if (body) {
    upstream.end(body);
  } else {
    upstream.end();
  }
};

const handleProxy = async (req, res, requestUrl) => {
  const target = requestUrl.searchParams.get('url');
  if (!target || !/^https?:\/\//i.test(target)) {
    res.writeHead(400);
    res.end('Bad proxy url');
    return;
  }

  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (!STRIP_REQUEST_HEADERS.has(name.toLowerCase())) headers[name] = value;
  }

  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // Buffer instead of streaming: a streamed body goes out chunked, and
    // embedded HTTP servers (Sonos UPnP) stall on chunked requests.
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  forwardRequest(target, req.method, headers, body, res, 5);
};

// --- Tuya (DELTACO smart home) ------------------------------------------------
// Tuya devices announce themselves on UDP 6666/6667. The broadcast is encrypted
// with a key shipped in every Tuya app, so discovery needs no credentials and
// yields the device id, ip and protocol version. Controlling a device needs its
// per-device local key, which only the Tuya account can hand out.
// Kept in server.mjs rather than its own module because deploy-to-pi.sh only
// rsyncs this file and start-kiosk.sh.

const TUYA_UDP_PORTS = [6666, 6667];
const TUYA_BROADCAST_KEY = crypto.createHash('md5').update('yGAdlopoPVldABfn').digest();
const TUYA_SCAN_MS = 12000;

const tuyaDecryptBroadcast = (buf) => {
  // 20-byte header, payload, 4-byte crc + 4-byte suffix
  const payload = buf.subarray(20, buf.length - 8);
  try {
    return JSON.parse(payload.toString('utf8'));
  } catch {}
  try {
    const decipher = crypto.createDecipheriv('aes-128-ecb', TUYA_BROADCAST_KEY, null);
    decipher.setAutoPadding(true);
    return JSON.parse(Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
};

const tuyaScan = () =>
  new Promise((resolve) => {
    const found = new Map();
    const sockets = TUYA_UDP_PORTS.map((port) => {
      const sock = dgram.createSocket({type: 'udp4', reuseAddr: true});
      sock.on('message', (msg) => {
        const info = tuyaDecryptBroadcast(msg);
        if (!info || !info.gwId) return;
        found.set(info.gwId, {
          id: info.gwId,
          ip: info.ip || '',
          version: info.version || '',
          productKey: info.productKey || '',
          encrypted: info.encrypt !== false,
        });
      });
      sock.on('error', () => {});
      try {
        sock.bind(port);
      } catch {}
      return sock;
    });
    setTimeout(() => {
      for (const sock of sockets) {
        try {
          sock.close();
        } catch {}
      }
      resolve([...found.values()]);
    }, TUYA_SCAN_MS);
  });

const handleTuyaScan = async (res) => {
  const devices = await tuyaScan();
  console.log(new Date().toISOString(), 'tuya scan found', devices.length, 'device(s)');
  res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify({devices}));
};

// --- Background image uploads ------------------------------------------------
// Phones pick a photo instead of hunting for a URL. The image is downscaled in
// the browser before it gets here, so this only needs to accept a small JPEG,
// write it under uploads/ and hand back a same-origin path for the settings.

const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'uploads');
const UPLOAD_SLOTS = new Set(['day', 'evening', 'countdown']);
const UPLOAD_MAX_BYTES = 12 * 1024 * 1024;
const UPLOAD_TYPES = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'};

const handleUpload = (req, res, requestUrl) => {
  const slot = requestUrl.searchParams.get('slot') || '';
  const ext = UPLOAD_TYPES[(req.headers['content-type'] || '').split(';')[0].trim()];
  if (!UPLOAD_SLOTS.has(slot) || !ext) {
    res.writeHead(400);
    res.end('bad slot or content-type');
    return;
  }
  const chunks = [];
  let size = 0;
  let aborted = false;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > UPLOAD_MAX_BYTES) {
      aborted = true;
      res.writeHead(413);
      res.end('too large');
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (aborted) return;
    try {
      fs.mkdirSync(UPLOAD_DIR, {recursive: true});
      // Same name per slot, cache-busted by the query the client stores
      for (const stale of fs.readdirSync(UPLOAD_DIR)) {
        if (stale.startsWith(`${slot}.`)) fs.unlinkSync(path.join(UPLOAD_DIR, stale));
      }
      fs.writeFileSync(path.join(UPLOAD_DIR, slot + ext), Buffer.concat(chunks));
    } catch (err) {
      console.warn('background upload failed:', err.message);
      res.writeHead(500);
      res.end();
      return;
    }
    console.log(new Date().toISOString(), 'background upload', slot, size, 'bytes');
    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
    res.end(JSON.stringify({url: `/uploads/${slot}${ext}?v=${Date.now()}`}));
  });
};

// dist/ only changes on deploy, so each file is compressed once and kept in memory
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.ttf', '.map']);
const gzipCache = new Map();
const gzipped = (file, stat, cb) => {
  const hit = gzipCache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
    cb(null, hit.gz);
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      cb(err);
      return;
    }
    zlib.gzip(data, (zErr, gz) => {
      if (zErr) {
        cb(zErr);
        return;
      }
      gzipCache.set(file, {mtimeMs: stat.mtimeMs, size: stat.size, gz});
      cb(null, gz);
    });
  });
};

const serveStatic = (req, res, requestUrl) => {
  let filePath;
  try {
    filePath = decodeURIComponent(requestUrl.pathname);
  } catch {
    fail(res, 400, 'Bad path');
    return;
  }
  // OAuth redirects land on /oauth/*; serve the app and let it handle the code
  if (filePath === '/' || filePath.startsWith('/oauth/')) filePath = '/index.html';
  // Root uploads at UPLOAD_DIR itself, not its parent, or /uploads/../ would
  // reach settings-store.json
  const isUpload = filePath.startsWith('/uploads/');
  const root = isUpload ? UPLOAD_DIR : DIST;
  const resolved = path.join(root, isUpload ? filePath.slice('/uploads'.length) : filePath);
  if (!resolved.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.stat(resolved, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      fail(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // Vite content-hashes everything under /assets/, so it never changes in place
      'Cache-Control':
        ext === '.html'
          ? 'no-cache'
          : !isUpload && filePath.startsWith('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=86400',
      Vary: 'Accept-Encoding',
    };
    const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (wantsGzip && COMPRESSIBLE.has(ext)) {
      gzipped(resolved, stat, (err, gz) => {
        if (err) {
          fail(res, 500);
          return;
        }
        res.writeHead(200, {...headers, 'Content-Encoding': 'gzip', 'Content-Length': gz.length});
        res.end(req.method === 'HEAD' ? undefined : gz);
      });
      return;
    }
    fs.readFile(resolved, (err, data) => {
      if (err) {
        fail(res, 404, 'Not found');
        return;
      }
      res.writeHead(200, {...headers, 'Content-Length': data.length});
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
};

// --- Legacy config import ----------------------------------------------------
// Lets a fresh web install pick up the old root config.js automatically.

const loadLegacyConfig = () => {
  const candidates = [
    path.resolve(DIST, '..', '..', 'config.js'),
    path.join(os.homedir(), 'homeboard', 'config.js'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      return cjsRequire(p);
    } catch (err) {
      console.warn(`Could not parse legacy config at ${p}: ${err.message}`);
    }
  }
  return null;
};

const discoverSonosIps = (timeoutMs = 2500) =>
  new Promise((resolve) => {
    const sock = dgram.createSocket('udp4');
    const found = new Set();
    const finish = () => {
      try {
        sock.close();
      } catch {}
      resolve([...found]);
    };
    const timer = setTimeout(finish, timeoutMs);
    sock.on('message', (msg) => {
      const text = msg.toString();
      if (!text.includes('ZonePlayer')) return;
      const m = text.match(/LOCATION:\s*http:\/\/([^:/]+):/i);
      if (m) found.add(m[1]);
    });
    sock.on('error', () => {
      clearTimeout(timer);
      finish();
    });
    sock.bind(0, () => {
      const q =
        'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\n' +
        'MX: 1\r\nST: urn:schemas-upnp-org:device:ZonePlayer:1\r\n\r\n';
      sock.send(q, 1900, '239.255.255.250');
    });
  });

const httpGetText = (url, timeoutMs = 3000) =>
  new Promise((resolve, reject) => {
    const request = http.get(url, {timeout: timeoutMs}, (up) => {
      let text = '';
      up.setEncoding('utf8');
      up.on('data', (chunk) => (text += chunk));
      up.on('end', () => resolve(text));
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', reject);
  });

const resolveSonosIp = async (group) => {
  if (!group) return null;
  const ips = await discoverSonosIps();
  for (const ip of ips) {
    try {
      const text = await httpGetText(`http://${ip}:1400/xml/device_description.xml`);
      const room = text.match(/<roomName>([^<]*)/)?.[1];
      if (room && room.toLowerCase() === String(group).toLowerCase()) return ip;
    } catch {}
  }
  return ips[0] || null;
};

const handleLegacyConfig = async (res) => {
  const legacy = loadLegacyConfig();
  if (!legacy) {
    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end('{"error":"no legacy config.js found"}');
    return;
  }
  const sonosIp = await resolveSonosIp(legacy.sonos?.group).catch(() => null);
  res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify({legacy, sonosIp}));
};

// The address a phone on the same Wi-Fi reaches this Pi at, for the setup QR code.
// VPN interfaces (ZeroTier zt* or feth* on macOS, tun, docker) use private ranges too but are not the LAN
const lanAddresses = () =>
  Object.entries(os.networkInterfaces())
    .filter(([name]) => !/^(zt|feth|utun|tun|tap|docker|br-|veth)/.test(name))
    .flatMap(([name, addrs]) =>
      (addrs || [])
        .filter((a) => (a.family === 'IPv4' || a.family === 4) && !a.internal)
        .filter((a) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address))
        .map((a) => ({ip: a.address, iface: name})),
    );

// --- Kiosk system controls ---------------------------------------------------
// Ported from the legacy server.js socket handlers (sleep/reboot/restart).

const SYSTEM_COMMANDS = {
  // Verbatim legacy server.js commands. Blank via the X screensaver, NOT
  // DPMS off: when this monitor powers down it stops delivering touch
  // events, so a DPMS-slept panel can never be woken by touch. Screensaver
  // blanking keeps the monitor awake showing black (tvservice -p keeps HDMI
  // powered), and X natively unblanks on any input.
  // Blank via the X screensaver, NOT DPMS off: when this monitor powers down it
  // stops delivering touch events, so a DPMS-slept panel can never be woken by
  // touch. DPMS is disabled outright, so HDMI stays powered and `tvservice -p`
  // is unnecessary here; running it after `s activate` re-syncs HDMI and
  // instantly un-blanks, which showed up as a black flash every minute.
  sleep: 'export DISPLAY=:0; xset -display :0.0 s activate',
  // `s reset` is what actually un-blanks a screensaver-blanked screen. No
  // tvservice here either: re-syncing HDMI blanks the panel for about a second,
  // which showed up as a flash on every touch (wake fires on any touch).
  wake: 'export DISPLAY=:0; xset -display :0.0 s reset; xset -display :0.0 s off; xset -display :0.0 -dpms',
  // Raspberry Pi OS default user has passwordless sudo
  reboot: 'sudo reboot',
};

// Per-Pi override, kept out of deploys: some panels only blank with the legacy
// `s activate; tvservice -p`, e.g. {"sleep": "...", "wake": "..."}
const KIOSK_LOCAL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'kiosk.local.json');
try {
  const local = JSON.parse(fs.readFileSync(KIOSK_LOCAL, 'utf8'));
  for (const k of ['sleep', 'wake']) {
    if (typeof local[k] === 'string') SYSTEM_COMMANDS[k] = local[k];
  }
  console.log('kiosk.local.json: overriding', Object.keys(local).join(', '));
} catch (e) {
  if (e.code !== 'ENOENT') console.warn('kiosk.local.json ignored:', e.message);
}

// A sleep tick that lands right after a touch-triggered wake would re-blank
// the panel the user just woke; wakes win for a grace period
const WAKE_GRACE_MS = 20 * 1000;
// Matches the page's 30 s idle check, for touches the page never saw
const TOUCH_IDLE_MS = 30 * 1000;
let lastWakeAt = 0;
let lastTouchAt = 0;
let asleep = false;

const log = (...args) => console.log(new Date().toISOString(), ...args);

const wakeScreen = (reason) => {
  lastWakeAt = Date.now();
  asleep = false;
  log('wake via', reason);
  exec(SYSTEM_COMMANDS.wake, (err) => {
    if (err) console.warn(`system wake failed: ${err.message}`);
  });
};

// Reads the touchscreen straight from evdev, so a touch wakes the panel even
// when X or Chromium stop delivering it (a blanked panel once stayed dead all night)
const TOUCH_RETRY_MS = 10 * 1000;
const TOUCH_LOG_GAP_MS = 5 * 60 * 1000;
const findTouchDevice = () => {
  if (process.env.HOMEBOARD_TOUCH_DEVICE) return process.env.HOMEBOARD_TOUCH_DEVICE;
  try {
    const dir = '/dev/input/by-id';
    const name = fs.readdirSync(dir).find((f) => /touch/i.test(f) && /-event-/.test(f));
    return name ? path.join(dir, name) : null;
  } catch {
    return null;
  }
};
let touchMissingLogged = false;
const watchTouch = () => {
  const device = findTouchDevice();
  if (!device) {
    if (!touchMissingLogged) log('touch: no touchscreen device found, retrying');
    touchMissingLogged = true;
    setTimeout(watchTouch, TOUCH_RETRY_MS);
    return;
  }
  touchMissingLogged = false;
  log('touch: watching', device);
  const stream = fs.createReadStream(device, {highWaterMark: 1024});
  stream.on('data', () => {
    const now = Date.now();
    if (now - lastTouchAt > TOUCH_LOG_GAP_MS) log('touch: input seen');
    lastTouchAt = now;
    if (asleep) wakeScreen('touch (evdev)');
  });
  const retry = (why) => {
    log('touch: device lost:', why);
    stream.destroy();
    setTimeout(watchTouch, TOUCH_RETRY_MS);
  };
  stream.once('error', (e) => retry(e.message));
  stream.once('end', () => retry('closed'));
};
if (process.platform === 'linux') watchTouch();

const handleSystem = (req, res, action) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }
  if (action === 'wake') {
    wakeScreen(`page (${req.socket.remoteAddress})`);
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{"ok":true}');
    return;
  }
  if (action === 'sleep' && Date.now() - lastTouchAt < TOUCH_IDLE_MS) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{"ok":true,"skipped":"recent-touch"}');
    return;
  }
  if (action === 'sleep' && Date.now() - lastWakeAt < WAKE_GRACE_MS) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{"ok":true,"skipped":"wake-grace"}');
    return;
  }
  // Only log transitions; the page sends a sleep tick every minute all night
  if (action !== 'sleep' || !asleep) {
    log('system', action, 'from', req.socket.remoteAddress);
  }
  if (action === 'sleep') asleep = true;
  if (action === 'restart') {
    // pm2 restarts the process after a clean exit
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{"ok":true}');
    setTimeout(() => process.exit(0), 300);
    return;
  }
  const cmd = SYSTEM_COMMANDS[action];
  if (!cmd) {
    res.writeHead(404);
    res.end();
    return;
  }
  exec(cmd, (err) => {
    if (err) console.warn(`system ${action} failed: ${err.message}`);
  });
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end('{"ok":true}');
};

// --- Shared settings store --------------------------------------------------
// Settings normally live in each browser's localStorage, which would mean a
// phone configuring itself instead of the wall display. These keys are kept
// server-side so every browser on the LAN edits one config. Device-scoped
// keys (device id/name, Sonos uuid) deliberately stay per-browser.
// Secrets land in this file in plaintext: same trust stance as LAN sync,
// LAN-only and never port-forwarded.

const STORE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'settings-store.json');
const STORE_KEYS = new Set([
  'homeboard_settings',
  'homeboard_secrets',
  'spotify_tokens',
  'tibber_data_api_tokens',
  'lamarzocco_tokens',
  'lamarzocco_install_key',
  'lamarzocco_credentials',
]);

// `deleted` marks keys removed on purpose, so a browser holding an old
// localStorage copy does not push them back (see readShared in the shims)
const readStore = () => {
  let text;
  try {
    text = fs.readFileSync(STORE_FILE, 'utf8');
  } catch {
    return {rev: 0, values: {}, deleted: {}};
  }
  try {
    const store = JSON.parse(text);
    return {rev: store.rev || 0, values: store.values || {}, deleted: store.deleted || {}};
  } catch (err) {
    // Keep the damaged file for inspection; browsers re-adopt their local
    // copies into the fresh store. A new rev makes every kiosk reload.
    const aside = `${STORE_FILE}.corrupt-${Date.now()}`;
    log('settings store unreadable, moved to', aside, err.message);
    try {
      fs.renameSync(STORE_FILE, aside);
    } catch {}
    return {rev: Date.now(), values: {}, deleted: {}};
  }
};

const writeStore = (store) => {
  // Write, fsync, then rename so a yanked power cord cannot leave a half-written file
  const tmp = STORE_FILE + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(store));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, STORE_FILE);
};

const STORE_MAX_BYTES = 2 * 1024 * 1024;

const handleStore = (req, res, requestUrl) => {
  const key = requestUrl.searchParams.get('key') || '';

  if (requestUrl.pathname === '/store-rev') {
    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
    res.end(JSON.stringify({rev: readStore().rev || 0}));
    return;
  }
  if (!STORE_KEYS.has(key)) {
    res.writeHead(400);
    res.end('unknown key');
    return;
  }
  if (req.method === 'GET') {
    const store = readStore();
    const value = store.values[key];
    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
    res.end(JSON.stringify({value: value === undefined ? null : value, deleted: !!store.deleted[key]}));
    return;
  }
  if (req.method === 'POST' || req.method === 'DELETE') {
    // Buffers, not strings: a multi-byte character split across two chunks
    // would otherwise decode as U+FFFD
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > STORE_MAX_BYTES) {
        tooBig = true;
        fail(res, 413, 'too large');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) return;
      const store = readStore();
      if (req.method === 'DELETE') {
        delete store.values[key];
        store.deleted[key] = true;
      } else {
        store.values[key] = Buffer.concat(chunks).toString('utf8');
        delete store.deleted[key];
      }
      store.rev = (store.rev || 0) + 1;
      try {
        writeStore(store);
      } catch (err) {
        console.warn('settings store write failed:', err.message);
        res.writeHead(500);
        res.end();
        return;
      }
      console.log(new Date().toISOString(), 'store', req.method, key, 'rev', store.rev);
      res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(JSON.stringify({rev: store.rev}));
    });
    return;
  }
  res.writeHead(405);
  res.end();
};

const API_PATHS = new Set([
  '/lan-address',
  '/tuya/scan',
  '/background',
  '/store',
  '/store-rev',
  '/proxy',
  '/legacy-config',
]);

const handleRequest = (req, res) => {
  // An aborted upload emits 'error' on the request; without a listener that kills the process
  req.on('error', () => {});
  let requestUrl;
  try {
    // Fixed base: the Host header is client input and may not parse
    requestUrl = new URL(req.url, 'http://localhost');
  } catch {
    fail(res, 400, 'Bad request');
    return;
  }
  const {pathname} = requestUrl;
  const isSystem = pathname.startsWith('/system/');

  if (isSystem || API_PATHS.has(pathname)) {
    const denied = apiDenied(req);
    if (denied) {
      log('denied', req.method, pathname, denied, 'from', req.socket.remoteAddress, 'host', req.headers.host, 'origin', req.headers.origin);
      fail(res, 403, denied);
      return;
    }
  }

  if (isSystem) {
    handleSystem(req, res, pathname.slice('/system/'.length));
    return;
  }
  if (pathname === '/lan-address') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({addresses: lanAddresses(), port: PORT}));
    return;
  }
  if (pathname === '/tuya/scan') {
    handleTuyaScan(res).catch((err) => fail(res, 500, err.message));
    return;
  }
  if (pathname === '/background') {
    if (req.method !== 'POST') {
      fail(res, 405);
      return;
    }
    handleUpload(req, res, requestUrl);
    return;
  }
  if (pathname === '/store' || pathname === '/store-rev') {
    handleStore(req, res, requestUrl);
    return;
  }
  if (pathname === '/legacy-config') {
    handleLegacyConfig(res).catch((err) => fail(res, 500, err.message));
    return;
  }
  if (pathname === '/proxy') {
    // Rejects when the page aborts while its POST body is still arriving
    handleProxy(req, res, requestUrl).catch((err) => fail(res, 502, `Proxy error: ${err.message}`));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fail(res, 405);
    return;
  }
  serveStatic(req, res, requestUrl);
};

const server = http.createServer((req, res) => {
  try {
    handleRequest(req, res);
  } catch (err) {
    log('request failed:', req.method, req.url, err.stack || err.message);
    fail(res, 500);
  }
});

// --- UDP bridge -------------------------------------------------------------

const wss = new WebSocketServer({noServer: true});
wss.on('error', (err) => log('udp bridge server error:', err.message));

server.on('upgrade', (req, socket, head) => {
  socket.on('error', () => {});
  let pathname;
  try {
    ({pathname} = new URL(req.url, 'http://localhost'));
  } catch {
    socket.destroy();
    return;
  }
  // Browsers let any site open a WebSocket here; the bridge relays LAN sync payloads
  if (pathname !== '/udp-bridge' || apiDenied(req)) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  let udp = null;

  const reply = (obj) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };

  ws.on('error', () => {});

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    try {
      switch (msg.op) {
        case 'bind': {
          if (udp) break;
          udp = dgram.createSocket({type: 'udp4', reuseAddr: true});
          udp.on('message', (data, rinfo) => {
            reply({
              op: 'message',
              data: data.toString('utf8'),
              rinfo: {address: rinfo.address, port: rinfo.port},
            });
          });
          udp.on('error', (err) => reply({op: 'error', message: err.message}));
          udp.bind(msg.port || 0, () => reply({op: 'bound'}));
          break;
        }
        case 'addMembership':
          udp?.addMembership(msg.addr);
          break;
        case 'setBroadcast':
          udp?.setBroadcast(!!msg.flag);
          break;
        case 'send':
          udp?.send(Buffer.from(String(msg.data), 'utf8'), msg.port, msg.addr, (err) =>
            reply({op: 'sent', seq: msg.seq, error: err ? err.message : null}),
          );
          break;
        case 'close':
          udp?.close();
          udp = null;
          break;
        default:
          break;
      }
    } catch (err) {
      reply({op: 'error', message: err.message});
    }
  });

  ws.on('close', () => {
    try {
      udp?.close();
    } catch {}
    udp = null;
  });
});

// Log and keep serving: a crash drops every bridge socket and the sleep state
process.on('uncaughtException', (err) => log('uncaught exception:', err?.stack || err));
process.on('unhandledRejection', (err) => log('unhandled rejection:', err?.stack || err));

// Startup errors (port in use) must still exit so pm2 retries
server.on('error', (err) => {
  log('server error:', err.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Homeboard web listening on http://0.0.0.0:${PORT}`);
});
