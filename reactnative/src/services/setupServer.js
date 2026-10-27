// Minimal HTTP/1.1 server on the LAN for the phone setup page. One request
// per connection, bodies capped small: it only serves one page and a few forms.
import TcpSocket from 'react-native-tcp-socket';

export const SETUP_PORT = 8642;
const MAX_REQUEST = 64 * 1024;

const STATUS_TEXT = {200: 'OK', 302: 'Found', 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 500: 'Error'};

const respond = (socket, {status = 200, type = 'text/html; charset=utf-8', body = '', location}) => {
  const head = [
    `HTTP/1.1 ${status} ${STATUS_TEXT[status] || 'OK'}`,
    `Content-Type: ${type}`,
    `Content-Length: ${new TextEncoder().encode(body).length}`,
    'Cache-Control: no-store',
    'Connection: close',
  ];
  if (location) head.push(`Location: ${location}`);
  try {
    socket.end(`${head.join('\r\n')}\r\n\r\n${body}`, 'utf8');
  } catch {}
};

const parseQuery = (qs) => {
  const out = {};
  for (const part of (qs || '').split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {}
  }
  return out;
};

// handler({method, path, query, body}) resolves to {status, type, body, location}
export const startSetupServer = (handler) =>
  new Promise((resolve, reject) => {
    const server = TcpSocket.createServer((socket) => {
      // The page sends ASCII-only bodies, so string length equals Content-Length
      socket.setEncoding('utf8');
      let buf = '';
      let handled = false;
      socket.on('error', () => {});
      socket.on('data', async (chunk) => {
        if (handled) return;
        buf += chunk;
        if (buf.length > MAX_REQUEST) {
          handled = true;
          socket.destroy();
          return;
        }
        const headerEnd = buf.indexOf('\r\n\r\n');
        if (headerEnd < 0) return;
        const head = buf.slice(0, headerEnd);
        const length = parseInt((head.match(/\r\ncontent-length:\s*(\d+)/i) || [])[1] || '0', 10);
        if (buf.length < headerEnd + 4 + length) return;
        handled = true;

        const [method, target = '/'] = head.split('\r\n')[0].split(' ');
        const [path, qs] = target.split('?');
        let res;
        try {
          res = await handler({
            method,
            path,
            query: parseQuery(qs),
            body: buf.slice(headerEnd + 4, headerEnd + 4 + length),
          });
        } catch (err) {
          console.warn('Setup server error:', err?.message);
          res = {status: 500, type: 'text/plain', body: 'Something went wrong'};
        }
        respond(socket, res || {status: 404, type: 'text/plain', body: 'Not found'});
      });
    });
    server.on('error', reject);
    server.listen({port: SETUP_PORT, host: '0.0.0.0', reuseAddress: true}, () =>
      resolve({
        stop: () => {
          try {
            server.close();
          } catch {}
        },
      }),
    );
  });
