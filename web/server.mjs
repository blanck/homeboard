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
      res.writeHead(status, respHeaders);
      up.pipe(res);
    },
  );

  upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
  upstream.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502);
    res.end(`Proxy error: ${err.message}`);
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

const serveStatic = (req, res, requestUrl) => {
  let filePath = decodeURIComponent(requestUrl.pathname);
  // OAuth redirects land on /oauth/*; serve the app and let it handle the code
  if (filePath === '/' || filePath.startsWith('/oauth/')) filePath = '/index.html';
  const resolved = path.join(DIST, filePath);
  if (!resolved.startsWith(DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    });
    res.end(data);
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

// --- Kiosk system controls ---------------------------------------------------
// Ported from the legacy server.js socket handlers (sleep/reboot/restart).

const SYSTEM_COMMANDS = {
  // Blank the display; a touch wakes it again via DPMS
  sleep: 'export DISPLAY=:0; xset -display :0.0 s activate; xset -display :0.0 dpms force off',
  // Raspberry Pi OS default user has passwordless sudo
  reboot: 'sudo reboot',
};

const handleSystem = (req, res, action) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }
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

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (requestUrl.pathname.startsWith('/system/')) {
    if (!isPrivateAddress(req.socket.remoteAddress)) {
      res.writeHead(403);
      res.end('LAN only');
      return;
    }
    handleSystem(req, res, requestUrl.pathname.slice('/system/'.length));
    return;
  }
  if (requestUrl.pathname === '/proxy' || requestUrl.pathname === '/legacy-config') {
    if (!isPrivateAddress(req.socket.remoteAddress)) {
      res.writeHead(403);
      res.end('LAN only');
      return;
    }
    if (requestUrl.pathname === '/legacy-config') {
      handleLegacyConfig(res);
      return;
    }
    handleProxy(req, res, requestUrl);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }
  serveStatic(req, res, requestUrl);
});

// --- UDP bridge -------------------------------------------------------------

const wss = new WebSocketServer({noServer: true});

server.on('upgrade', (req, socket, head) => {
  const {pathname} = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (pathname !== '/udp-bridge' || !isPrivateAddress(req.socket.remoteAddress)) {
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

server.listen(PORT, () => {
  console.log(`Homeboard web listening on http://0.0.0.0:${PORT}`);
});
