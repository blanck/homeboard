// Browser stand-in for react-native-udp: relays datagram operations over a
// WebSocket to server.mjs, which owns real UDP sockets. Covers the API
// surface used by sonosService (SSDP discovery) and ShareTab (LAN sync).

class MsgData {
  constructor(str) {
    this._str = str;
  }
  toString() {
    return this._str;
  }
}

class BridgedSocket {
  constructor(opts) {
    this._reuse = !!(opts && (opts.reusePort || opts.reuseAddr));
    this._listeners = {};
    this._queue = [];
    this._sendCbs = {};
    this._seq = 0;
    this._closed = false;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this._ws = new WebSocket(`${proto}://${window.location.host}/udp-bridge`);
    this._ws.onopen = () => {
      this._queue.forEach((raw) => this._ws.send(raw));
      this._queue = [];
    };
    this._ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.op === 'message') {
        this._emit('message', new MsgData(msg.data), msg.rinfo);
      } else if (msg.op === 'bound') {
        if (this._bindCb) this._bindCb();
      } else if (msg.op === 'sent') {
        const cb = this._sendCbs[msg.seq];
        if (cb) {
          delete this._sendCbs[msg.seq];
          cb(msg.error ? new Error(msg.error) : null);
        }
      } else if (msg.op === 'error') {
        this._emit('error', new Error(msg.message || 'udp bridge error'));
      }
    };
    this._ws.onerror = () => {
      if (!this._closed) this._emit('error', new Error('udp bridge unavailable'));
    };
  }

  _post(obj) {
    const raw = JSON.stringify(obj);
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(raw);
    } else if (this._ws.readyState === WebSocket.CONNECTING) {
      this._queue.push(raw);
    }
  }

  on(event, fn) {
    (this._listeners[event] = this._listeners[event] || []).push(fn);
  }

  _emit(event, ...args) {
    (this._listeners[event] || []).forEach((fn) => {
      try {
        fn(...args);
      } catch {}
    });
  }

  bind(port, cb) {
    this._bindCb = cb;
    this._post({op: 'bind', port: port || 0, reuse: this._reuse});
  }

  addMembership(addr) {
    this._post({op: 'addMembership', addr});
  }

  setBroadcast(flag) {
    this._post({op: 'setBroadcast', flag: !!flag});
  }

  send(data, _offset, _length, port, addr, cb) {
    const seq = ++this._seq;
    if (cb) this._sendCbs[seq] = cb;
    this._post({op: 'send', seq, data: String(data), port, addr});
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    try {
      this._ws.close();
    } catch {}
  }
}

export default {
  createSocket: (opts) => new BridgedSocket(opts),
};
