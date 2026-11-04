// First-run import of the legacy root config.js into the new settings
// structure. Only runs when no settings are saved yet; after that the
// Settings UI (or LAN sync from the Android app) owns the config.

import AsyncStorage from './shims/async-storage';
import {legacyToQuickPicks} from '@homeboard/rn/utils/quickPicks';

const SETTINGS_KEY = 'homeboard_settings';

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
  const quickPicks = legacyToQuickPicks(legacy.playlist);
  if (quickPicks.length) s.quickPicks = quickPicks;
  const bg = legacy.background?.url;
  if (bg) s.background = {dayUrl: bg, eveningUrl: bg};
  return s;
};

export const importLegacyConfigIfFresh = async () => {
  try {
    if (await AsyncStorage.getItem(SETTINGS_KEY)) return false;
    const resp = await fetch('/legacy-config');
    if (!resp.ok) return false;
    const {legacy, sonosIp} = await resp.json();
    if (!legacy) return false;
    const mapped = mapLegacyConfig(legacy, sonosIp);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(mapped));
    console.warn('Homeboard: imported legacy config.js into settings');
    return true;
  } catch {
    return false;
  }
};
