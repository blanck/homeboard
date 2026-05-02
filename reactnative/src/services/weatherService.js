// Port of server.js weather + home.vue getCondition/getForecast

import {fetchJsonSafe} from '../utils/fetchSafe';

export const fetchCurrentWeather = async (config) => {
  const {key} = config.weather.openweathermap;
  if (!key) {
    return null;
  }
  const {lat, lng} = config.location;
  const lang = config.language || 'en';
  const url = `https://api.openweathermap.org/data/2.5/weather?lang=${lang}&lat=${lat}&lon=${lng}&APPID=${key}`;

  const data = await fetchJsonSafe(url);

  if (!data || !data.weather) {
    return null;
  }

  const condition = data.weather[0];
  const currentTemp = data.main.temp - 273;

  // Fetch daily high/low from OWM 5-day forecast
  let dayMin = currentTemp;
  let dayMax = currentTemp;
  {
    const fcUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&APPID=${key}`;
    const fcData = await fetchJsonSafe(fcUrl);
    if (fcData && fcData.list) {
      const today = new Date().toISOString().substring(0, 10);
      const todayEntries = fcData.list.filter((e) => e.dt_txt?.startsWith(today));
      if (todayEntries.length > 0) {
        dayMin = Math.min(...todayEntries.map((e) => e.main.temp_min - 273), currentTemp);
        dayMax = Math.max(...todayEntries.map((e) => e.main.temp_max - 273), currentTemp);
      }
    }
  }

  // Build weather object matching Netatmo format (from home.vue:1367-1397)
  const weather = {
    indoor: {
      time_utc: data.dt,
      Temperature: currentTemp.toFixed(1),
      CO2: null,
      Humidity: data.main.humidity,
      Pressure: data.main.pressure,
      min_temp: dayMin.toFixed(1),
      max_temp: dayMax.toFixed(1),
      pressure_trend: null,
    },
    outdoor: {
      time_utc: data.dt,
      Temperature: currentTemp.toFixed(1),
      Humidity: data.main.humidity,
      min_temp: dayMin.toFixed(1),
      max_temp: dayMax.toFixed(1),
      temp_trend: null,
      wind_deg: data.wind ? data.wind.deg : null,
      wind_speed: data.wind ? data.wind.speed : null,
    },
  };

  return {weather, condition};
};

// Fetch Met.no forecast (port of home.vue getForecast)
export const fetchForecast = async (config) => {
  const {lat, lng} = config.location;
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/?lat=${lat}&lon=${lng}`;

  const data = await fetchJsonSafe(url, {
    headers: {'User-Agent': 'HomeboardApp/1.0'},
  });

  if (data && data.properties && data.properties.timeseries) {
    // Group by day and pick the noon (12:00) entry for each day
    const series = data.properties.timeseries;
    const dayMap = {};
    for (const entry of series) {
      const date = entry.time.substring(0, 10);
      const hour = parseInt(entry.time.substring(11, 13), 10);
      if (!dayMap[date] || Math.abs(hour - 12) < Math.abs(parseInt(dayMap[date].time.substring(11, 13), 10) - 12)) {
        dayMap[date] = entry;
      }
    }
    const days = Object.keys(dayMap).sort().slice(0, 3);
    return days.map((d) => dayMap[d]);
  }
  return null;
};

// Netatmo public token cache
let publicTokenCache = {token: null, fetchedAt: 0};

const extractStationId = (urlOrMac) => {
  if (!urlOrMac) return null;
  try {
    const url = new URL(urlOrMac);
    const id = url.searchParams.get('stationid');
    if (id) return id;
  } catch {
    // Not a URL — treat as raw MAC/ID
  }
  // Accept raw MAC-like strings (xx:xx:xx:xx:xx:xx)
  if (/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(urlOrMac.trim())) {
    return urlOrMac.trim();
  }
  return urlOrMac.trim() || null;
};

export const fetchNetatmoPublicToken = async () => {
  const now = Date.now();
  if (publicTokenCache.token && now - publicTokenCache.fetchedAt < 30 * 60 * 1000) {
    return publicTokenCache.token;
  }
  const data = await fetchJsonSafe('https://auth.netatmo.com/weathermap/token');
  const token = data?.body;
  if (token) {
    publicTokenCache = {token, fetchedAt: now};
  }
  return token;
};

export const fetchNetatmoPublicForecast = async (config) => {
  const stationId = extractStationId(config.netatmo.publicUrl);
  if (!stationId) return null;

  const token = await fetchNetatmoPublicToken();
  if (!token) return null;

  const locale = config.language === 'sv' ? 'sv-SE' : 'en-US';
  const url = `https://app.netatmo.net/api/simplifiedfuturemeasure?device_id=${stationId}&locale=${locale}`;
  const data = await fetchJsonSafe(url, {
    headers: {Authorization: `Bearer ${token}`},
  });

  if (data && data.body) {
    const forecast = data.body;
    if (forecast.forecastDays) {
      forecast.forecastDays = forecast.forecastDays.slice(0, 3);
    }
    return forecast;
  }
  return null;
};

// Fetch Netatmo forecast (port of home.vue getNetatmoForecast)
export const fetchNetatmoForecast = async (config) => {
  const {device_id, module_id, bearer, locale} = config.netatmo.forecast;
  if (!device_id) {
    return null;
  }

  const url = `https://app.netatmo.net/api/simplifiedfuturemeasure?device_id=${device_id}&locale=${locale}&module_id=${module_id}`;
  const data = await fetchJsonSafe(url, {
    headers: {Authorization: `Bearer ${bearer}`},
  });

  if (data && data.body) {
    const forecast = data.body;
    if (forecast.forecastDays) {
      forecast.forecastDays = forecast.forecastDays.slice(0, 3);
    }
    return forecast;
  }
  return null;
};
