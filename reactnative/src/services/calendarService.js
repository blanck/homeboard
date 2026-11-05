// iCal parsing and recurrence expansion (no external dependency)
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {fetchTextSafe} from '../utils/fetchSafe';

dayjs.extend(utc);
dayjs.extend(timezone);

const DAY_MS = 86400000;
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MAX_PERIODS = 5000;
const UTC_ZONE = 'Z';

export const unescapeText = (value) =>
  value.replace(/\\([\\;,nN])/g, (m, c) => (c === 'n' || c === 'N' ? '\n' : c));

const parseLine = (line) => {
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuote = !inQuote;
    } else if (line[i] === ':' && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 0) {
    return null;
  }
  const [name, ...rawParams] = line.substring(0, colon).split(';');
  const params = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) {
      params[p.substring(0, eq).toUpperCase()] = p
        .substring(eq + 1)
        .replace(/^"|"$/g, '');
    }
  }
  return {name: name.toUpperCase(), params, value: line.substring(colon + 1)};
};

// Wall-clock fields are kept as a UTC timestamp ("naive") so date math never sees DST.
// zone: null = device local, 'Z' = UTC, otherwise an IANA TZID.
export const parseDateValue = (value, params = {}) => {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(
    value.trim(),
  );
  if (!m) {
    return null;
  }
  const naive = Date.UTC(
    +m[1],
    +m[2] - 1,
    +m[3],
    +(m[4] || 0),
    +(m[5] || 0),
    +(m[6] || 0),
  );
  if (!m[4] || params.VALUE === 'DATE') {
    return {naive, zone: null, dateOnly: true};
  }
  if (m[7]) {
    return {naive, zone: UTC_ZONE, dateOnly: false};
  }
  const tz = params.TZID || null;
  return {naive, zone: tz === 'UTC' ? UTC_ZONE : tz, dateOnly: false};
};

export const toDate = (naive, zone) => {
  const d = new Date(naive);
  if (zone === UTC_ZONE) {
    return d;
  }
  if (zone) {
    try {
      const res = dayjs.tz(d.toISOString().substring(0, 19), zone).toDate();
      if (!isNaN(res.getTime())) {
        return res;
      }
    } catch {
      // Unknown TZID (e.g. Windows names), fall back to device time
    }
  }
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  );
};

const parseDuration = (value) => {
  const m =
    /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
      value.trim(),
    );
  if (!m) {
    return null;
  }
  const ms =
    ((+(m[2] || 0) * 7 + +(m[3] || 0)) * 24 * 3600 +
      +(m[4] || 0) * 3600 +
      +(m[5] || 0) * 60 +
      +(m[6] || 0)) *
    1000;
  return m[1] === '-' ? -ms : ms;
};

const parseList = (value, fn) =>
  value
    .split(',')
    .map((v) => fn(v.trim()))
    .filter((v) => v !== null && !isNaN(v));

export const parseRrule = (value) => {
  const rule = {interval: 1, wkst: 1};
  for (const part of value.split(';')) {
    const [k, v] = part.split('=');
    if (!v) {
      continue;
    }
    const key = k.toUpperCase();
    if (key === 'FREQ') {
      rule.freq = v.toUpperCase();
    } else if (key === 'INTERVAL') {
      rule.interval = Math.max(1, parseInt(v, 10) || 1);
    } else if (key === 'COUNT') {
      rule.count = parseInt(v, 10) || undefined;
    } else if (key === 'UNTIL') {
      rule.until = parseDateValue(v) || undefined;
    } else if (key === 'WKST') {
      const wd = WEEKDAYS.indexOf(v.toUpperCase());
      rule.wkst = wd < 0 ? 1 : wd;
    } else if (key === 'BYDAY') {
      rule.byday = v
        .toUpperCase()
        .split(',')
        .map((d) => /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(d.trim()))
        .filter(Boolean)
        .map((d) => ({
          n: d[1] ? parseInt(d[1], 10) : 0,
          wd: WEEKDAYS.indexOf(d[2]),
        }));
    } else if (key === 'BYMONTHDAY') {
      rule.bymonthday = parseList(v, (x) => parseInt(x, 10));
    } else if (key === 'BYMONTH') {
      rule.bymonth = parseList(v, (x) => parseInt(x, 10) - 1);
    } else if (key === 'BYSETPOS') {
      rule.bysetpos = parseList(v, (x) => parseInt(x, 10));
    }
  }
  return rule;
};

export const parseIcal = (text) => {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let ev = null;
  let depth = 0;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === 'BEGIN:VEVENT') {
      ev = {type: 'VEVENT', exdates: []};
      depth = 0;
      continue;
    }
    if (!ev) {
      continue;
    }
    if (line === 'END:VEVENT') {
      if (ev.dtstart) {
        events.push(finishEvent(ev));
      }
      ev = null;
      continue;
    }
    // Skip properties of nested components such as VALARM
    if (line.startsWith('BEGIN:')) {
      depth++;
      continue;
    }
    if (line.startsWith('END:')) {
      depth--;
      continue;
    }
    if (depth > 0) {
      continue;
    }
    const prop = parseLine(line);
    if (!prop) {
      continue;
    }
    const {name, params, value} = prop;
    if (name === 'UID') {
      ev.uid = value;
    } else if (name === 'DTSTART') {
      ev.dtstart = parseDateValue(value, params);
    } else if (name === 'DTEND') {
      ev.dtend = parseDateValue(value, params);
    } else if (name === 'DURATION') {
      ev.duration = parseDuration(value);
    } else if (name === 'SUMMARY') {
      ev.summary = unescapeText(value);
    } else if (name === 'DESCRIPTION') {
      ev.description = unescapeText(value);
    } else if (name === 'LOCATION') {
      ev.location = unescapeText(value);
    } else if (name === 'STATUS') {
      ev.status = value.trim().toUpperCase();
    } else if (name === 'RRULE') {
      ev.rrule = parseRrule(value);
    } else if (name === 'EXDATE') {
      for (const v of value.split(',')) {
        const d = parseDateValue(v, params);
        if (d) {
          ev.exdates.push(d);
        }
      }
    } else if (name === 'RECURRENCE-ID') {
      ev.recurrenceId = parseDateValue(value, params);
    }
  }
  return events;
};

const finishEvent = (ev) => {
  const {dtstart, dtend} = ev;
  ev.allDay = dtstart.dateOnly;
  ev.start = toDate(dtstart.naive, dtstart.zone);
  if (dtend) {
    ev.end = toDate(dtend.naive, dtend.zone);
    // Wall-clock span keeps all-day ends on midnight across DST
    if (dtend.zone === dtstart.zone) {
      ev.spanNaive = dtend.naive - dtstart.naive;
    } else {
      ev.spanMs = ev.end.getTime() - ev.start.getTime();
    }
  } else if (ev.duration != null) {
    ev.spanNaive = ev.duration;
    ev.end = toDate(dtstart.naive + ev.duration, dtstart.zone);
  } else if (ev.allDay) {
    ev.spanNaive = DAY_MS;
    ev.end = toDate(dtstart.naive + DAY_MS, dtstart.zone);
  }
  return ev;
};

const dayOf = (naive) => Math.floor(naive / DAY_MS);
const weekdayOf = (day) => (((day + 4) % 7) + 7) % 7;
const dayFromYmd = (y, m, d) => dayOf(Date.UTC(y, m, d));
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// Days in [first, first + length) matching BYDAY, honouring ordinals like 2TU or -1FR
const byDayInRange = (byday, first, length) => {
  const out = [];
  for (const {n, wd} of byday) {
    const matches = [];
    for (
      let d = first + ((wd - weekdayOf(first) + 7) % 7);
      d < first + length;
      d += 7
    ) {
      matches.push(d);
    }
    if (!n) {
      out.push(...matches);
    } else {
      const pick = n > 0 ? matches[n - 1] : matches[matches.length + n];
      if (pick !== undefined) {
        out.push(pick);
      }
    }
  }
  return out;
};

const monthCandidates = (rule, y, m, startDate) => {
  const first = dayFromYmd(y, m, 1);
  const dim = daysInMonth(y, m);
  let days = null;
  if (rule.bymonthday) {
    days = rule.bymonthday
      .map((d) => (d > 0 ? d : dim + d + 1))
      .filter((d) => d >= 1 && d <= dim)
      .map((d) => first + d - 1);
  }
  if (rule.byday) {
    const bd = byDayInRange(rule.byday, first, dim);
    days = days ? days.filter((d) => bd.includes(d)) : bd;
  }
  if (!days) {
    days = startDate <= dim ? [first + startDate - 1] : [];
  }
  return days;
};

const periodCandidates = (rule, k, start) => {
  const startDay = dayOf(start);
  const s = new Date(start);
  const Y = s.getUTCFullYear();
  const M = s.getUTCMonth();
  const D = s.getUTCDate();
  const step = k * rule.interval;
  let anchor;
  let days;

  if (rule.freq === 'DAILY') {
    anchor = startDay + step;
    days = [anchor];
    const date = new Date(anchor * DAY_MS);
    if (rule.bymonth && !rule.bymonth.includes(date.getUTCMonth())) {
      days = [];
    }
    if (rule.bymonthday) {
      const dim = daysInMonth(date.getUTCFullYear(), date.getUTCMonth());
      const md = date.getUTCDate();
      if (!rule.bymonthday.some((d) => (d > 0 ? d : dim + d + 1) === md)) {
        days = [];
      }
    }
    if (rule.byday && !rule.byday.some((b) => b.wd === weekdayOf(anchor))) {
      days = [];
    }
  } else if (rule.freq === 'WEEKLY') {
    anchor = startDay - ((weekdayOf(startDay) - rule.wkst + 7) % 7) + step * 7;
    const wds = rule.byday
      ? rule.byday.map((b) => b.wd)
      : [weekdayOf(startDay)];
    days = [];
    for (let d = anchor; d < anchor + 7; d++) {
      if (wds.includes(weekdayOf(d))) {
        days.push(d);
      }
    }
    if (rule.bymonth) {
      days = days.filter((d) =>
        rule.bymonth.includes(new Date(d * DAY_MS).getUTCMonth()),
      );
    }
  } else if (rule.freq === 'MONTHLY') {
    const total = Y * 12 + M + step;
    const y = Math.floor(total / 12);
    const m = total - y * 12;
    anchor = dayFromYmd(y, m, 1);
    days =
      rule.bymonth && !rule.bymonth.includes(m)
        ? []
        : monthCandidates(rule, y, m, D);
  } else if (rule.freq === 'YEARLY') {
    const y = Y + step;
    anchor = dayFromYmd(y, 0, 1);
    if (rule.byday && !rule.bymonth && !rule.bymonthday) {
      days = byDayInRange(rule.byday, anchor, dayFromYmd(y + 1, 0, 1) - anchor);
    } else {
      const months =
        rule.bymonth || (rule.bymonthday ? [...Array(12).keys()] : [M]);
      days = [];
      for (const m of months) {
        days.push(...monthCandidates(rule, y, m, D));
      }
    }
  } else {
    return null;
  }

  days = [...new Set(days)].sort((a, b) => a - b);
  if (rule.bysetpos && rule.freq !== 'DAILY') {
    const picked = rule.bysetpos
      .map((p) => (p > 0 ? days[p - 1] : days[days.length + p]))
      .filter((d) => d !== undefined);
    days = [...new Set(picked)].sort((a, b) => a - b);
  }
  return {anchor, days};
};

// Approximate period count before `fromDay`, kept low so no occurrence is skipped
const skipPeriods = (rule, gapDays) => {
  const perPeriod = {DAILY: 1, WEEKLY: 7, MONTHLY: 31, YEARLY: 366}[rule.freq];
  return Math.max(0, Math.floor(gapDays / perPeriod / rule.interval) - 1);
};

// Naive starts of a rule inside [from, to] (naive ms), DTSTART included as the first one
export const expandRule = (rule, start, zone, from, to) => {
  const out = [];
  if (start >= from && start <= to) {
    out.push(start);
  }
  if (!rule.freq || rule.count === 1) {
    return out;
  }
  const timeOfDay = start - dayOf(start) * DAY_MS;
  let untilNaive = null;
  let untilTime = null;
  if (rule.until) {
    if (rule.until.dateOnly) {
      untilNaive = rule.until.naive + DAY_MS - 1;
    } else {
      untilTime = toDate(rule.until.naive, rule.until.zone || zone).getTime();
    }
  }
  let k = rule.count ? 0 : skipPeriods(rule, dayOf(from) - dayOf(start));
  let count = 1;
  for (let i = 0; i < MAX_PERIODS; i++, k++) {
    const period = periodCandidates(rule, k, start);
    if (!period || period.anchor * DAY_MS > to) {
      return out;
    }
    for (const day of period.days) {
      const n = day * DAY_MS + timeOfDay;
      if (n <= start) {
        continue;
      }
      if (untilNaive !== null && n > untilNaive) {
        return out;
      }
      if (untilTime !== null && toDate(n, zone).getTime() > untilTime) {
        return out;
      }
      if (n > to) {
        return out;
      }
      if (n >= from) {
        out.push(n);
      }
      count++;
      if (rule.count && count >= rule.count) {
        return out;
      }
    }
  }
  return out;
};

const refMatches = (refs, naive, time) =>
  refs.some((r) =>
    r.dateOnly ? dayOf(r.naive) === dayOf(naive) : r.time === time,
  );

const withTime = (ref, fallbackZone) => ({
  ...ref,
  time: toDate(
    ref.naive,
    ref.zone === null && !ref.dateOnly ? fallbackZone : ref.zone,
  ).getTime(),
});

const instance = (ev, naive) => {
  const start = toDate(naive, ev.dtstart.zone);
  let end;
  if (ev.spanNaive != null) {
    end = toDate(naive + ev.spanNaive, ev.dtstart.zone);
  } else if (ev.spanMs != null) {
    end = new Date(start.getTime() + ev.spanMs);
  }
  return {
    type: 'VEVENT',
    uid: ev.uid,
    summary: ev.summary,
    description: ev.description,
    location: ev.location,
    start,
    end,
    allDay: ev.allDay,
  };
};

// Occurrences that are not over at `now` and start before `windowEnd`
export const expandEvents = (parsed, now, windowEnd) => {
  const nowMs = now.getTime();
  const endMs = windowEnd.getTime();
  const visible = (e) =>
    (e.end || e.start).getTime() > nowMs && e.start.getTime() < endMs;

  const overrides = new Map();
  for (const ev of parsed) {
    if (ev.recurrenceId && ev.uid) {
      if (!overrides.has(ev.uid)) {
        overrides.set(ev.uid, []);
      }
      overrides.get(ev.uid).push(withTime(ev.recurrenceId, ev.dtstart.zone));
    }
  }

  const out = [];
  for (const ev of parsed) {
    if (ev.status === 'CANCELLED') {
      continue;
    }
    if (ev.recurrenceId || !ev.rrule) {
      const e = instance(ev, ev.dtstart.naive);
      if (visible(e)) {
        out.push(e);
      }
      continue;
    }
    const zone = ev.dtstart.zone;
    const span = Math.max(ev.spanNaive ?? ev.spanMs ?? 0, 0);
    // Naive and real time differ by at most 14 h, so pad by two days
    const from = nowMs - span - 2 * DAY_MS;
    const to = endMs + 2 * DAY_MS;
    const exdates = ev.exdates.map((x) => withTime(x, zone));
    const replaced = overrides.get(ev.uid) || [];
    for (const naive of expandRule(
      ev.rrule,
      ev.dtstart.naive,
      zone,
      from,
      to,
    )) {
      const time = toDate(naive, zone).getTime();
      if (
        refMatches(exdates, naive, time) ||
        refMatches(replaced, naive, time)
      ) {
        continue;
      }
      const e = instance(ev, naive);
      if (visible(e)) {
        out.push(e);
      }
    }
  }
  return out;
};

const addDays = (date, n) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

export const fetchCalendar = async (config, now = new Date()) => {
  const cal = config.calendar || {};
  const sources = [
    {...cal.shared, fallbackDays: 30},
    {...cal.holiday, fallbackDays: 90},
  ].filter((s) => s.url);
  if (!sources.length) {
    return [];
  }

  const texts = await Promise.all(
    sources.map((s) => fetchTextSafe(s.url, undefined, 12000)),
  );
  let anyOk = false;
  let allEvents = [];
  sources.forEach((src, i) => {
    const text = texts[i];
    // A 200 with an HTML error or captive portal page is a failure too
    if (!text || !text.includes('BEGIN:VCALENDAR')) {
      return;
    }
    anyOk = true;
    const windowEnd = addDays(now, src.days || src.fallbackDays);
    allEvents.push(...expandEvents(parseIcal(text), now, windowEnd));
  });
  // null tells Dashboard to keep the previous events
  if (!anyOk) {
    return null;
  }

  allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
  return allEvents.slice(0, 7);
};
