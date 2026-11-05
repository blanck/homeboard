// Run with TZ=Europe/Stockholm; TZID events and local getters keep it passing in other zones
jest.mock('../src/utils/fetchSafe', () => ({fetchTextSafe: jest.fn()}));

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {fetchTextSafe} from '../src/utils/fetchSafe';
import {
  parseIcal,
  expandEvents,
  fetchCalendar,
  unescapeText,
} from '../src/services/calendarService';

dayjs.extend(utc);
dayjs.extend(timezone);

const ics = (...events) =>
  [
    'BEGIN:VCALENDAR',
    ...events.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']),
    'END:VCALENDAR',
  ].join('\r\n');

const sthlm = (y, mo, d, h = 0, mi = 0) =>
  dayjs
    .tz(
      new Date(Date.UTC(y, mo - 1, d, h, mi)).toISOString().slice(0, 19),
      'Europe/Stockholm',
    )
    .toDate();
const fmt = (d) => dayjs(d).tz('Europe/Stockholm').format('YYYY-MM-DD HH:mm');
const expand = (text, now, days) =>
  expandEvents(
    parseIcal(text),
    now,
    new Date(now.getTime() + days * 86400000),
  ).sort((a, b) => a.start - b.start);

test('all-day events start at local midnight and are flagged', () => {
  const [ev] = parseIcal(
    ics([
      'UID:a',
      'DTSTART;VALUE=DATE:20261105',
      'DTEND;VALUE=DATE:20261106',
      'SUMMARY:Holiday',
    ]),
  );
  expect(ev.allDay).toBe(true);
  expect([
    ev.start.getFullYear(),
    ev.start.getMonth(),
    ev.start.getDate(),
    ev.start.getHours(),
  ]).toEqual([2026, 10, 5, 0]);
  expect(ev.end.getDate()).toBe(6);
  expect(ev.end.getHours()).toBe(0);
});

test('weekly BYDAY keeps wall time across the October DST change', () => {
  const text = ics([
    'UID:w',
    'DTSTART;TZID=Europe/Stockholm:20261019T090000',
    'DTEND;TZID=Europe/Stockholm:20261019T100000',
    'RRULE:FREQ=WEEKLY;BYDAY=MO,TH',
    'SUMMARY:Gym',
  ]);
  const out = expand(text, sthlm(2026, 10, 19, 8), 21);
  expect(out.map((e) => fmt(e.start))).toEqual([
    '2026-10-19 09:00',
    '2026-10-22 09:00',
    '2026-10-26 09:00',
    '2026-10-29 09:00',
    '2026-11-02 09:00',
    '2026-11-05 09:00',
  ]);
  expect(out.every((e) => e.end - e.start === 3600000)).toBe(true);
});

test('floating weekly event keeps device wall time across DST', () => {
  const text = ics([
    'UID:f',
    'DTSTART:20261022T090000',
    'RRULE:FREQ=WEEKLY',
    'SUMMARY:Local',
  ]);
  const out = expand(text, new Date(2026, 9, 22, 8), 14);
  expect(out.map((e) => [e.start.getDate(), e.start.getHours()])).toEqual([
    [22, 9],
    [29, 9],
  ]);
});

test('monthly last Friday', () => {
  const text = ics([
    'UID:m',
    'DTSTART:20260130T170000',
    'RRULE:FREQ=MONTHLY;BYDAY=-1FR',
    'SUMMARY:Pub',
  ]);
  const out = expand(text, new Date(2026, 10, 1), 70);
  expect(
    out.map((e) => [
      e.start.getMonth() + 1,
      e.start.getDate(),
      e.start.getHours(),
    ]),
  ).toEqual([
    [11, 27, 17],
    [12, 25, 17],
  ]);
});

test('yearly with BYMONTH and an ordinal BYDAY', () => {
  const text = ics([
    'UID:y',
    'DTSTART;VALUE=DATE:20201101',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=2TU',
    'SUMMARY:Second Tuesday',
  ]);
  const out = expand(text, new Date(2026, 10, 1), 30);
  expect(out.map((e) => e.start.getDate())).toEqual([10]);
});

test('COUNT and UNTIL bound the series', () => {
  const now = sthlm(2026, 11, 4, 8);
  const base = ['DTSTART;TZID=Europe/Stockholm:20261104T100000', 'SUMMARY:x'];
  const days = (text) =>
    expand(text, now, 30).map((e) => +fmt(e.start).slice(8, 10));
  expect(days(ics(['UID:c', ...base, 'RRULE:FREQ=DAILY;COUNT=3']))).toEqual([
    4, 5, 6,
  ]);
  expect(
    days(ics(['UID:u', ...base, 'RRULE:FREQ=DAILY;UNTIL=20261106'])),
  ).toEqual([4, 5, 6]);
  expect(
    days(ics(['UID:z', ...base, 'RRULE:FREQ=DAILY;UNTIL=20261106T090000Z'])),
  ).toEqual([4, 5, 6]);
  expect(
    days(ics(['UID:i', ...base, 'RRULE:FREQ=DAILY;INTERVAL=2;COUNT=3'])),
  ).toEqual([4, 6, 8]);
});

test('COUNT counts occurrences before the window', () => {
  const text = ics([
    'UID:c',
    'DTSTART:20261101T100000',
    'RRULE:FREQ=DAILY;COUNT=5',
    'SUMMARY:x',
  ]);
  expect(
    expand(text, new Date(2026, 10, 4, 8), 30).map((e) => e.start.getDate()),
  ).toEqual([4, 5]);
});

test('EXDATE removes occurrences, across lines and comma lists', () => {
  const text = ics([
    'UID:e',
    'DTSTART;TZID=Europe/Stockholm:20261102T090000',
    'RRULE:FREQ=WEEKLY',
    'EXDATE;TZID=Europe/Stockholm:20261109T090000,20261116T090000',
    'EXDATE:20261123T080000Z',
    'SUMMARY:Weekly',
  ]);
  const out = expand(text, new Date(2026, 10, 1), 35);
  expect(out.map((e) => e.start.getDate())).toEqual([2, 30]);
});

test('EXDATE with VALUE=DATE on an all-day series', () => {
  const text = ics([
    'UID:d',
    'DTSTART;VALUE=DATE:20261102',
    'RRULE:FREQ=DAILY;COUNT=4',
    'EXDATE;VALUE=DATE:20261103',
    'SUMMARY:x',
  ]);
  expect(
    expand(text, new Date(2026, 10, 1), 30).map((e) => e.start.getDate()),
  ).toEqual([2, 4, 5]);
});

test('RECURRENCE-ID overrides replace or cancel an occurrence', () => {
  const text = ics(
    [
      'UID:r',
      'DTSTART;TZID=Europe/Stockholm:20261102T090000',
      'DTEND;TZID=Europe/Stockholm:20261102T100000',
      'RRULE:FREQ=WEEKLY;COUNT=4',
      'SUMMARY:Standup',
    ],
    [
      'UID:r',
      'RECURRENCE-ID;TZID=Europe/Stockholm:20261109T090000',
      'DTSTART;TZID=Europe/Stockholm:20261110T140000',
      'DTEND;TZID=Europe/Stockholm:20261110T150000',
      'SUMMARY:Standup moved',
    ],
    [
      'UID:r',
      'RECURRENCE-ID;TZID=Europe/Stockholm:20261116T090000',
      'DTSTART;TZID=Europe/Stockholm:20261116T090000',
      'STATUS:CANCELLED',
      'SUMMARY:Standup',
    ],
  );
  const out = expand(text, new Date(2026, 10, 1), 30);
  expect(out.map((e) => `${fmt(e.start)} ${e.summary}`)).toEqual([
    '2026-11-02 09:00 Standup',
    '2026-11-10 14:00 Standup moved',
    '2026-11-23 09:00 Standup',
  ]);
});

test('events in progress are kept, finished ones dropped', () => {
  const text = ics(
    [
      'UID:t',
      'DTSTART;VALUE=DATE:20261103',
      'DTEND;VALUE=DATE:20261107',
      'SUMMARY:Trip',
    ],
    [
      'UID:p',
      'DTSTART:20261104T080000',
      'DTEND:20261104T090000',
      'SUMMARY:Past',
    ],
    ['UID:o', 'DTSTART;VALUE=DATE:20261103', 'SUMMARY:Yesterday'],
    ['UID:l', 'DTSTART:20261201T080000', 'SUMMARY:Too late'],
  );
  const out = expand(text, new Date(2026, 10, 4, 12), 14);
  expect(out.map((e) => e.summary)).toEqual(['Trip']);
});

test('old recurring series jump ahead instead of failing', () => {
  const text = ics(
    [
      'UID:b',
      'DTSTART;VALUE=DATE:19600105',
      'RRULE:FREQ=YEARLY',
      'SUMMARY:Birthday',
    ],
    ['UID:d', 'DTSTART:20000101T070000', 'RRULE:FREQ=DAILY', 'SUMMARY:Daily'],
  );
  const out = expand(text, new Date(2027, 0, 4, 12), 3);
  expect(out.map((e) => `${e.start.getDate()} ${e.summary}`)).toEqual([
    '5 Birthday',
    '5 Daily',
    '6 Daily',
    '7 Daily',
  ]);
});

test('text unescaping and line unfolding for CRLF and LF', () => {
  expect(unescapeText('a\\, b\\; c\\nd\\Ne\\\\n')).toBe('a, b; c\nd\ne\\n');
  const lf =
    'BEGIN:VEVENT\nUID:x\nDTSTART:20261104T100000\nSUMMARY:Long\n  title\\, folded\nDESCRIPTION:one\r\n\ttwo\nEND:VEVENT\n';
  const [ev] = parseIcal(lf);
  expect(ev.summary).toBe('Long title, folded');
  expect(ev.description).toBe('onetwo');
});

test('VALARM properties do not leak into the event', () => {
  const [ev] = parseIcal(
    ics([
      'UID:v',
      'DTSTART:20261104T100000',
      'SUMMARY:Real',
      'BEGIN:VALARM',
      'DESCRIPTION:Reminder',
      'END:VALARM',
    ]),
  );
  expect(ev.summary).toBe('Real');
  expect(ev.description).toBeUndefined();
});

describe('fetchCalendar', () => {
  const config = {
    calendar: {
      shared: {url: 'https://a/cal.ics', days: 30},
      holiday: {url: 'https://b/hol.ics'},
    },
  };
  const now = new Date(2026, 10, 4, 8);
  const feed = ics(['UID:1', 'DTSTART:20261105T100000', 'SUMMARY:Thing']);

  beforeEach(() => fetchTextSafe.mockReset());

  test('returns null when every fetch fails', async () => {
    fetchTextSafe.mockResolvedValue(null);
    expect(await fetchCalendar(config, now)).toBeNull();
  });

  test('an HTML error page counts as a failure', async () => {
    fetchTextSafe.mockResolvedValue('<html>login</html>');
    expect(await fetchCalendar(config, now)).toBeNull();
  });

  test('returns events when one fetch succeeds, [] when it has none', async () => {
    fetchTextSafe.mockImplementation(async (url) =>
      url.includes('a/') ? feed : null,
    );
    expect((await fetchCalendar(config, now)).map((e) => e.summary)).toEqual([
      'Thing',
    ]);
    fetchTextSafe.mockResolvedValue(ics());
    expect(await fetchCalendar(config, now)).toEqual([]);
  });

  test('returns [] when nothing is configured', async () => {
    expect(
      await fetchCalendar({calendar: {shared: {url: ''}, holiday: {}}}, now),
    ).toEqual([]);
    expect(fetchTextSafe).not.toHaveBeenCalled();
  });
});
