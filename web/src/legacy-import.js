// First-run import of the legacy root config.js into the new settings
// structure. Only runs when no settings are saved yet; after that the
// Settings UI (or LAN sync from the Android app) owns the config.

const SETTINGS_LS_KEY = 'hbas:homeboard_settings';

// Legacy playlists used Framework7 icon names; map to Material Community.
const F7_ICON_MAP = {
  music_note_2: 'music',
  antenna_radiowaves_left_right: 'radio',
};

const mapPlaylists = (playlist = {}) => {
  const out = {};
  for (const [key, item] of Object.entries(playlist)) {
    if (!item || typeof item !== 'object') continue;
    out[key] = {...item, icon: F7_ICON_MAP[item.icon] || 'music'};
  }
  return out;
};

export const mapLegacyConfig = (legacy, sonosIp) => {
  const s = {};
  if (legacy.location?.lat) s.location = {lat: legacy.location.lat, lng: legacy.location.lng};
  if (legacy.language) s.language = legacy.language;
  if (legacy.autosleep) s.autosleep = legacy.autosleep;
  if (Array.isArray(legacy.quotes)) s.quotes = legacy.quotes;
  if (legacy.time) {
    s.time = {
      localzone: legacy.time.localzone || '',
      remotezone: legacy.time.remotezone || '',
    };
  }
  const owmKey = legacy.weather?.openweathermap?.key;
  if (owmKey) s.weather = {openweathermap: {key: owmKey}};
  if (legacy.netatmo?.forecast?.device_id) {
    s.netatmo = {forecast: {...legacy.netatmo.forecast}};
  }
  if (legacy.newsapi) {
    s.newsapi = {};
    if (legacy.newsapi.key) {
      s.newsapi.provider = 'newsapiorg';
      s.newsapi.keys = {newsapiorg: legacy.newsapi.key};
    }
    if (legacy.newsapi.headlines) s.newsapi.headlines = {...legacy.newsapi.headlines};
    if (Array.isArray(legacy.newsapi.exclude)) s.newsapi.exclude = legacy.newsapi.exclude;
  }
  if (legacy.sonos) {
    s.sonos = {
      ip: sonosIp || legacy.sonos.ip || '',
      group: legacy.sonos.group || '',
      region: legacy.sonos.region || '2311',
    };
  }
  if (legacy.calendar) s.calendar = legacy.calendar;
  if (legacy.tibber1?.apiEndpoint?.apiKey) {
    s.tibber1 = {
      active: legacy.tibber1.active !== false,
      apiEndpoint: {...legacy.tibber1.apiEndpoint},
      homeId: legacy.tibber1.homeId || '',
    };
    s.energyProvider = 'tibber';
  }
  if (legacy.playlist && Object.keys(legacy.playlist).length) {
    s.playlist = mapPlaylists(legacy.playlist);
  }
  const bg = legacy.background?.url;
  if (bg) s.background = {dayUrl: bg, eveningUrl: bg};
  return s;
};

export const importLegacyConfigIfFresh = async () => {
  try {
    if (window.localStorage.getItem(SETTINGS_LS_KEY)) return false;
    const resp = await fetch('/legacy-config');
    if (!resp.ok) return false;
    const {legacy, sonosIp} = await resp.json();
    if (!legacy) return false;
    const mapped = mapLegacyConfig(legacy, sonosIp);
    window.localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(mapped));
    console.warn('Homeboard: imported legacy config.js into settings');
    return true;
  } catch {
    return false;
  }
};
