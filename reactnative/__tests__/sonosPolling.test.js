jest.mock('react-native-udp', () => ({createSocket: jest.fn()}));
import {
  nextPollDelay,
  shouldRediscover,
  escapeXml,
  playRadio,
  getGroupMemberIps,
  getCoordinatorIp,
  getTransportState,
  invalidateGroupCache,
  POLL_ACTIVE_MS,
  POLL_IDLE_MS,
  POLL_BACKOFF_MAX_MS,
  REDISCOVER_MIN_GAP_MS,
} from '../src/services/sonosService';

const reply = (text, status = 200) => ({ok: status < 300, status, text: async () => text});

const topologyReply = () => {
  const state =
    '<ZoneGroups><ZoneGroup Coordinator="RINCON_B" ID="g1">' +
    '<ZoneGroupMember UUID="RINCON_A" Location="http://10.0.0.2:1400/xml/device_description.xml" ZoneName="Kitchen"/>' +
    '<ZoneGroupMember UUID="RINCON_B" Location="http://10.0.0.3:1400/xml/device_description.xml" ZoneName="Living"/>' +
    '</ZoneGroup></ZoneGroups>';
  return reply(`<s:Envelope><s:Body><ZoneGroupState>${escapeXml(state)}</ZoneGroupState></s:Body></s:Envelope>`);
};

afterEach(() => {
  delete global.fetch;
  invalidateGroupCache();
});

describe('poll cadence', () => {
  test('fast while playing, slow when paused, stopped or unknown', () => {
    expect(nextPollDelay('playing')).toBe(POLL_ACTIVE_MS);
    expect(nextPollDelay('transitioning')).toBe(POLL_ACTIVE_MS);
    expect(nextPollDelay('paused')).toBe(POLL_IDLE_MS);
    expect(nextPollDelay('stopped')).toBe(POLL_IDLE_MS);
    expect(nextPollDelay(null)).toBe(POLL_IDLE_MS);
  });

  test('doubles per failure and caps at two minutes', () => {
    expect(nextPollDelay('playing', 1)).toBe(10000);
    expect(nextPollDelay('playing', 3)).toBe(40000);
    expect(nextPollDelay('paused', 1)).toBe(60000);
    expect(nextPollDelay('playing', 10)).toBe(POLL_BACKOFF_MAX_MS);
    expect(nextPollDelay('paused', 50)).toBe(POLL_BACKOFF_MAX_MS);
  });

  test('rediscovers after three failures, then at most once per gap', () => {
    const now = 10 * REDISCOVER_MIN_GAP_MS;
    expect(shouldRediscover(2, 0, now)).toBe(false);
    expect(shouldRediscover(3, 0, now)).toBe(true);
    expect(shouldRediscover(9, now - 1000, now)).toBe(false);
    expect(shouldRediscover(9, now - REDISCOVER_MIN_GAP_MS, now)).toBe(true);
  });
});

test('escapeXml escapes markup and ampersands', () => {
  expect(escapeXml('R&B <Hits> "x" \'y\'')).toBe('R&amp;B &lt;Hits&gt; &quot;x&quot; &apos;y&apos;');
});

test('radio station names are escaped inside the DIDL', async () => {
  const bodies = [];
  global.fetch = jest.fn(async (url, opts) => {
    bodies.push(opts.body);
    return reply('<s:Envelope></s:Envelope>');
  });
  await playRadio('10.0.0.2', 's1234', 'R&B <Hits>');
  const set = bodies[0];
  // Double-encoded: once for the DIDL, once for embedding it in the SOAP body
  expect(set).toContain('&lt;dc:title&gt;R&amp;amp;B &amp;lt;Hits&amp;gt;&lt;/dc:title&gt;');
  expect(set).toContain('<CurrentURI>x-sonosapi-stream:s1234?sid=254&amp;flags=8224&amp;sn=0</CurrentURI>');
  expect(set).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
});

test('coordinator lookup reuses the topology fetched for group members', async () => {
  global.fetch = jest.fn(async () => topologyReply());
  expect(await getGroupMemberIps('10.0.0.2')).toEqual(['10.0.0.2', '10.0.0.3']);
  expect(await getCoordinatorIp('10.0.0.2')).toBe('10.0.0.3');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('concurrent topology lookups share one request', async () => {
  global.fetch = jest.fn(async () => topologyReply());
  await Promise.all([getGroupMemberIps('10.0.0.2'), getCoordinatorIp('10.0.0.2')]);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('a failed topology fetch is not cached', async () => {
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  });
  expect(await getCoordinatorIp('10.0.0.2')).toBe('10.0.0.2');
  global.fetch = jest.fn(async () => topologyReply());
  expect(await getCoordinatorIp('10.0.0.2')).toBe('10.0.0.3');
});

test('a proxy error page counts as a failed call, not a stopped speaker', async () => {
  global.fetch = jest.fn(async () => reply('Proxy error: connect EHOSTUNREACH', 502));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(await getTransportState('10.0.0.2')).toBeNull();
  warn.mockRestore();
});
