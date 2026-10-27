import {fetchTextSafe} from '../utils/fetchSafe';

// The controller has no JSON endpoint, only an HTML page that auto-refreshes:
// <tr><td>Temperature</td><td>50.0 &#176;C</td></tr>. Sensors that are not
// wired up report "not available", which parses to null.
const ROW = /<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]*)<\/td>\s*<\/tr>/g;

const num = (raw) => {
  if (!raw) return null;
  const match = raw.replace(/&[^;]+;/g, ' ').match(/-?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
};

export const fetchPoolStatus = async (host) => {
  if (!host) return null;
  const base = /^https?:\/\//i.test(host) ? host : `http://${host}`;
  const html = await fetchTextSafe(base, undefined, 8000);
  if (!html) return null;

  const rows = {};
  let match;
  ROW.lastIndex = 0;
  while ((match = ROW.exec(html))) {
    rows[match[1].trim().toLowerCase()] = match[2].trim();
  }

  const temperature = num(rows.temperature);
  const ph = num(rows.ph);
  // A page that parsed but carries neither reading is not a pool controller
  if (temperature === null && ph === null) return null;

  return {
    temperature,
    ph,
    orp: num(rows.orp),
    chlorine: num(rows['chlorine concentration']),
    conductivity: num(rows.conductivity),
    updatedAt: Date.now(),
  };
};
