// iCal parsing — port of server.js:369-436
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {fetchTextSafe} from '../utils/fetchSafe';

dayjs.extend(utc);
dayjs.extend(timezone);

// Simple VCALENDAR/VEVENT parser (no external dependency)
const parseIcal = (text) => {
  const events = [];
  const lines = text.replace(/\r\n /g, '').replace(/\r/g, '').split('\n');
  let currentEvent = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT') {
      if (currentEvent) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > -1) {
        const key = line.substring(0, colonIdx);
        const value = line.substring(colonIdx + 1);
        const params = key.split(';');
        const baseKey = params[0];
        const tzid = params.find((p) => p.startsWith('TZID='))?.substring(5) || null;

        if (baseKey === 'DTSTART') {
          currentEvent.start = parseIcalDate(value, tzid);
          currentEvent.type = 'VEVENT';
        } else if (baseKey === 'DTEND') {
          currentEvent.end = parseIcalDate(value, tzid);
        } else if (baseKey === 'SUMMARY') {
          currentEvent.summary = value;
        } else if (baseKey === 'DESCRIPTION') {
          currentEvent.description = value;
        }
      }
    }
  }

  return events;
};

const parseIcalDate = (dateStr, tzid) => {
  // Handle YYYYMMDD format (all-day events)
  if (dateStr.length === 8) {
    return new Date(
      dateStr.substring(0, 4) + '-' +
      dateStr.substring(4, 6) + '-' +
      dateStr.substring(6, 8),
    );
  }
  // Handle YYYYMMDDTHHMMSSZ format
  if (dateStr.includes('T')) {
    const clean = dateStr.replace(/[^0-9TZ]/g, '');
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    const hour = clean.substring(9, 11) || '00';
    const min = clean.substring(11, 13) || '00';
    const sec = clean.substring(13, 15) || '00';
    const isUTC = dateStr.endsWith('Z');

    if (!isUTC && tzid) {
      try {
        const wall = `${year}-${month}-${day}T${hour}:${min}:${sec}`;
        return dayjs.tz(wall, tzid).toDate();
      } catch {
        // Unknown TZID — fall through to naive parse
      }
    }

    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}${isUTC ? 'Z' : ''}`);
  }
  return new Date(dateStr);
};

export const fetchCalendar = async (config) => {
  let allEvents = [];

  // Fetch shared calendar
  if (config.calendar.shared && config.calendar.shared.url) {
    const text = await fetchTextSafe(config.calendar.shared.url, undefined, 12000);
    if (text) {
      const events = parseIcal(text);
      const maxDays = config.calendar.shared.days || 30;
      for (const event of events) {
        if (event.start) {
          const diff = dayjs(event.start).startOf('day').diff(dayjs().startOf('day'), 'day');
          if (diff >= 0 && diff < maxDays) {
            allEvents.push(event);
          }
        }
      }
    }
  }

  // Fetch holiday calendar
  if (config.calendar.holiday && config.calendar.holiday.url) {
    const text = await fetchTextSafe(config.calendar.holiday.url, undefined, 12000);
    if (text) {
      const events = parseIcal(text);
      const maxDays = config.calendar.holiday.days || 90;
      for (const event of events) {
        if (event.start) {
          const diff = dayjs(event.start).startOf('day').diff(dayjs().startOf('day'), 'day');
          if (diff >= 0 && diff < maxDays) {
            allEvents.push(event);
          }
        }
      }
    }
  }

  // Sort and limit to 7
  allEvents.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
  allEvents = allEvents.slice(0, 7);

  return allEvents;
};
