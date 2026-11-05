jest.mock('../src/services/tibberOAuthService', () => ({
  getValidAccessToken: jest.fn(),
  forceRefreshToken: jest.fn(),
}));
jest.mock('../src/utils/fetchSafe', () => ({
  fetchWithTimeout: jest.fn(() =>
    Promise.resolve({json: () => Promise.resolve({data: {viewer: {websocketSubscriptionUrl: 'wss://feed'}}})}),
  ),
}));
import {createTibberFeed} from '../src/services/tibberService';

class FakeSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static all = [];
  static maxLive = 0;
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeSocket.all.push(this);
    FakeSocket.maxLive = Math.max(FakeSocket.maxLive, live().length);
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = FakeSocket.CLOSED;
    // Real sockets fire onclose later, after the caller has moved on
    setTimeout(() => this.onclose?.(), 0);
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  receive(msg) {
    this.onmessage?.({data: typeof msg === 'string' ? msg : JSON.stringify(msg)});
  }
}

const live = () => FakeSocket.all.filter((s) => s.readyState !== FakeSocket.CLOSED);
const config = {tibber1: {active: true, homeId: 'h1', apiEndpoint: {apiKey: 'k', queryUrl: 'https://q'}}};
const flush = () => jest.advanceTimersByTimeAsync(0);

beforeEach(() => {
  jest.useFakeTimers();
  FakeSocket.all = [];
  FakeSocket.maxLive = 0;
  global.WebSocket = FakeSocket;
});

afterEach(() => {
  jest.useRealTimers();
});

test('reconnectNow never leaves two live sockets', async () => {
  const feed = createTibberFeed(config, jest.fn());
  await flush();
  feed.reconnectNow();
  feed.reconnectNow();
  await flush();
  expect(live()).toHaveLength(1);
  await jest.advanceTimersByTimeAsync(30 * 60 * 1000);
  expect(FakeSocket.all.length).toBeGreaterThan(2);
  expect(FakeSocket.maxLive).toBe(1);
  feed();
});

test('handshake, ping and data flow', async () => {
  const onData = jest.fn();
  const feed = createTibberFeed(config, onData);
  await flush();
  const sock = live()[0];
  sock.open();
  expect(sock.sent[0].type).toBe('connection_init');
  sock.receive({type: 'connection_ack'});
  expect(sock.sent[1].type).toBe('subscribe');
  sock.receive({type: 'ping'});
  expect(sock.sent[2]).toEqual({type: 'pong'});
  sock.receive('not json');
  sock.receive({type: 'next', id: '1', payload: {data: {liveMeasurement: {power: 5}}}});
  expect(onData).toHaveBeenCalledWith({power: 5});
  feed();
});

test('watchdog reconnects after silence', async () => {
  const feed = createTibberFeed(config, jest.fn());
  await flush();
  const first = live()[0];
  first.open();
  first.receive({type: 'connection_ack'});
  await jest.advanceTimersByTimeAsync(91 * 1000);
  expect(first.readyState).toBe(FakeSocket.CLOSED);
  await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
  expect(live()).toHaveLength(1);
  expect(live()[0]).not.toBe(first);
  feed();
});

test('error message from the server triggers a reconnect', async () => {
  const feed = createTibberFeed(config, jest.fn());
  await flush();
  const first = live()[0];
  first.open();
  first.receive({type: 'error', id: '1', payload: []});
  expect(first.readyState).toBe(FakeSocket.CLOSED);
  await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
  expect(live()).toHaveLength(1);
  feed();
});

test('cleanup closes the socket and stops reconnecting', async () => {
  const feed = createTibberFeed(config, jest.fn());
  await flush();
  feed();
  await jest.advanceTimersByTimeAsync(60 * 60 * 1000);
  expect(FakeSocket.all).toHaveLength(1);
  expect(live()).toHaveLength(0);
});

test('cleanup during the url fetch opens no socket', async () => {
  const feed = createTibberFeed(config, jest.fn());
  feed();
  await jest.advanceTimersByTimeAsync(60 * 60 * 1000);
  expect(FakeSocket.all).toHaveLength(0);
});
