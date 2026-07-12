// Tibber V1 GraphQL + WebSocket + Data API (REST)
import {getValidAccessToken, forceRefreshToken} from './tibberOAuthService';
import {fetchWithTimeout} from '../utils/fetchSafe';

const DATA_API_BASE = 'https://data-api.tibber.com';

// --- Data API (REST) — replaces V2 GraphQL ---

const dataApiFetch = async (path, retried = false) => {
  const token = await getValidAccessToken();
  if (!token) return null;

  let res;
  try {
    res = await fetchWithTimeout(`${DATA_API_BASE}${path}`, {
      headers: {Authorization: `Bearer ${token}`},
    });
  } catch {
    return null;
  }

  if (res.status === 401 && !retried) {
    const newToken = await forceRefreshToken();
    if (newToken) {
      return dataApiFetch(path, true);
    }
    return null;
  }

  if (!res.ok) return null;

  try {
    return await res.json();
  } catch {
    return null;
  }
};

// Fetch homes from Data API
export const fetchDataApiHomes = async () => {
  const data = await dataApiFetch('/v1/homes');
  if (!data) return [];
  // Normalize to [{id, label}] format
  return (Array.isArray(data) ? data : data.homes || []).map((h) => ({
    id: h.id,
    label: h.appNickname || h.address?.address1 || h.id,
    raw: h,
  }));
};

// Fetch all devices for a home
export const fetchDataApiDevices = async (homeId) => {
  const data = await dataApiFetch(`/v1/homes/${homeId}/devices`);
  if (!data) return [];
  const items = Array.isArray(data) ? data : data.devices || [];
  return items.map((d) => ({
    deviceId: d.id || d.deviceId,
    type: mapDeviceType(d),
    label: d.info?.name || d.info?.model || d.info?.brand || 'Unknown',
    raw: d,
  }));
};

// Decode base64 device ID to extract type hint
const decodeDeviceId = (id) => {
  try {
    // Base64 decode
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let str = '';
    const cleaned = id.replace(/[^A-Za-z0-9+/=]/g, '');
    for (let i = 0; i < cleaned.length; i += 4) {
      const a = chars.indexOf(cleaned[i]);
      const b = chars.indexOf(cleaned[i + 1]);
      const c = chars.indexOf(cleaned[i + 2]);
      const d = chars.indexOf(cleaned[i + 3]);
      str += String.fromCharCode((a << 2) | (b >> 4));
      if (c !== -1 && cleaned[i + 2] !== '=') str += String.fromCharCode(((b & 15) << 4) | (c >> 2));
      if (d !== -1 && cleaned[i + 3] !== '=') str += String.fromCharCode(((c & 3) << 6) | d);
    }
    return str.toLowerCase();
  } catch {
    return '';
  }
};

// Map Data API device types to our internal types
const mapDeviceType = (device) => {
  // Check decoded base64 ID first (e.g. "tesla vehicle:uuid")
  const decoded = decodeDeviceId(device.id || '');
  const brand = (device.info?.brand || '').toLowerCase();
  const model = (device.info?.model || '').toLowerCase();
  const combined = `${decoded} ${brand} ${model}`;

  if (combined.includes('vehicle') || combined.includes('tesla') || combined.includes('car')) return 'ev';
  if (combined.includes('thermostat') || combined.includes('heat pump')) return 'thermostat';
  if (combined.includes('inverter') || combined.includes('solar')) return 'inverter';
  if (combined.includes('pulse')) return 'pulse';
  if (combined.includes('homevolt') || combined.includes('battery')) return 'homevolt';
  if (combined.includes('charger') || combined.includes('evse')) return 'charger';
  return 'unknown';
};

// Fetch device details
export const fetchDataApiDeviceDetails = async (homeId, deviceId) => {
  return dataApiFetch(`/v1/homes/${homeId}/devices/${deviceId}`);
};

// Main polling function — replaces fetchTibber2
// Fetches all enabled device data and maps to the shape widgets expect
export const fetchTibberDevices = async (config) => {
  const homeId = config.tibber1?.homeId;
  if (!homeId) return null;

  const token = await getValidAccessToken();
  if (!token) return null;

  const hasThermostat = !!config.tibber2?.thermostat;
  const hasInverter = !!config.tibber2?.inverter;
  const hasHomevolt = !!config.tibber2?.homevolt;
  const hasEv = !!config.tibber2?.ev;
  const evDeviceIds = (config.tibber2?.evDeviceIds || []).filter((id) => id !== 'ev');

  if (!hasThermostat && !hasInverter && !hasHomevolt && !hasEv) {
    return null;
  }

  // Fetch all devices and their details
  const devices = await dataApiFetch(`/v1/homes/${homeId}/devices`);
  if (!devices) return null;

  const deviceList = Array.isArray(devices) ? devices : devices.devices || [];
  const result = {};

  for (const device of deviceList) {
    const details = await dataApiFetch(`/v1/homes/${homeId}/devices/${device.id || device.deviceId}`);
    if (!details) continue;
    const dtype = mapDeviceType(device);


    // Extract values from capabilities/attributes arrays
    const getCap = (id) => {
      const cap = (details.capabilities || []).find((c) => c.id === id);
      return cap?.value ?? cap?.currentValue ?? null;
    };
    const getAttr = (id) => {
      const attr = (details.attributes || []).find((a) => a.id === id);
      return attr?.value ?? null;
    };
    const isOnline = getAttr('isOnline');
    const name = details.info?.name || '';

    if (dtype === 'ev' && hasEv) {
      const deviceId = device.id || device.deviceId;
      // Only include vehicles selected in settings
      if (evDeviceIds.length > 0 && !evDeviceIds.includes(deviceId)) continue;
      const soc = getCap('storage.stateOfCharge');
      const percent = soc != null ? Number(soc) : 0;
      const alive = isOnline !== false;
      if (!result.electricVehicles) result.electricVehicles = [];
      result.electricVehicles.push({
        battery: {percent},
        isAlive: alive,
        imgUrl: '',
        batteryText: `${name} ${percent}%`,
      });
    }

    if (dtype === 'thermostat' && hasThermostat) {
      const targetTemp = getCap('thermostat.targetTemperature') ?? getCap('targetTemperature');
      const currentTemp = getCap('thermostat.currentTemperature') ?? getCap('temperature');
      result.thermostat = {
        state: {comfortTemperature: targetTemp != null ? Number(targetTemp) : 0},
        temperatureSensor: {
          measurement: {value: currentTemp != null ? Number(currentTemp) : 0},
        },
      };
    }

    if (dtype === 'inverter' && hasInverter) {
      const power = getCap('power') ?? getCap('solar.power');
      result.inverter = {
        bubble: {
          value: power != null ? Number(power) : 0,
          percent: 0,
        },
      };
    }

    if (dtype === 'homevolt' && hasHomevolt) {
      const soc = getCap('storage.stateOfCharge');
      const batteryPower = getCap('powerFlow.battery.power');
      const gridPower = getCap('powerFlow.grid.power');
      const loadPower = getCap('powerFlow.load.power');
      const ratedCapacity = getCap('storage.ratedCapacity');
      const availableEnergy = getCap('storage.availableEnergy');
      const chargedToday = getCap('energyFlow.day.battery.charged');
      const dischargedToday = getCap('energyFlow.day.battery.discharged');

      result.battery = {
        isAlive: isOnline !== false,
        name: details.info?.name !== '<no name>' ? details.info?.name : 'Homevolt',
        shortName: 'Homevolt',
        imageUrl: '',
        currentOperationMode: {value: batteryPower > 0 ? 'charging' : batteryPower < 0 ? 'discharging' : 'idle'},
        stateOfCharge: soc != null ? Number(soc) : 0,
        batteryPower: batteryPower != null ? Number(batteryPower) : 0,
        gridPower: gridPower != null ? Number(gridPower) : 0,
        loadPower: loadPower != null ? Number(loadPower) : 0,
        ratedCapacity: ratedCapacity != null ? Number(ratedCapacity) : 0,
        availableEnergy: availableEnergy != null ? Number(availableEnergy) : 0,
        aggregatedHistory: {
          periods: [{
            key: 'TODAY',
            items: [
              {energy: chargedToday != null ? Number(chargedToday) : 0},
              {energy: dischargedToday != null ? Number(dischargedToday) : 0},
            ],
          }],
        },
      };
    }
  }

  return Object.keys(result).length > 0 ? result : null;
};

// --- V1 GraphQL API (unchanged) ---

// Fetch available homes for a given V1 API key
export const fetchTibberHomes = async (apiKey) => {
  if (!apiKey) return [];

  const query = `query {
    viewer {
      homes {
        id
        appNickname
        address {
          address1
          city
        }
      }
    }
  }`;

  let response;
  try {
    response = await fetchWithTimeout('https://api.tibber.com/v1-beta/gql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({query}),
    });
  } catch {
    return [];
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return [];
  }
  if (data?.data?.viewer?.homes) {
    return data.data.viewer.homes.map((h) => ({
      id: h.id,
      label: h.appNickname || [h.address?.address1, h.address?.city].filter(Boolean).join(', ') || h.id,
    }));
  }
  return [];
};

export const fetchTibberPrices = async (config) => {
  const {apiKey, queryUrl} = config.tibber1.apiEndpoint;
  if (!apiKey) {
    return null;
  }

  const query = `query {
    viewer {
      homes {
        currentSubscription {
          id
          validFrom
          validTo
          status
          priceInfo {
            current {
              total
              energy
              tax
              startsAt
              currency
              level
            }
            today {
              total
              startsAt
            }
            tomorrow {
              total
              startsAt
            }
          }
        }
      }
    }
  }`;

  let response;
  try {
    response = await fetchWithTimeout(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({query}),
    });
  } catch {
    return null;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return null;
  }
  if (data && data.data && data.data.viewer && data.data.viewer.homes) {
    return data.data.viewer.homes[0];
  }
  return null;
};

// Set thermostat temperature (still uses V2 GraphQL if available)
export const setThermostat = async (config, temp) => {
  const token = await getValidAccessToken();
  if (!token) return;

  // TODO: Data API may not support mutations — keeping V2 GraphQL for now
  const queryUrl = config.tibber2?.apiEndpoint?.queryUrl || 'https://app.tibber.com/v4/gql';
  const mutation = `mutation { me { home(id: "${config.tibber1.homeId}") { thermostat(id: "${config.tibber2.thermostat}") { setState(comfortTemperature: ${temp}) } } } }`;

  try {
    await fetchWithTimeout(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({query: mutation}),
    });
  } catch {}
};

// Fetch the dynamic WebSocket URL from Tibber API
const fetchWebsocketUrl = async (apiKey, queryUrl) => {
  try {
    const response = await fetchWithTimeout(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({query: '{viewer {websocketSubscriptionUrl}}'}),
    });
    const data = await response.json();
    const url = data?.data?.viewer?.websocketSubscriptionUrl;
    if (url) return url;
  } catch {
    // ignore
  }
  return null;
};

// Create Tibber live feed WebSocket connection
export const createTibberFeed = (config, onData, onConnect, onDisconnect) => {
  const {apiKey, queryUrl, feedUrl} = config.tibber1.apiEndpoint;
  const homeId = config.tibber1.homeId;

  if (!apiKey || !homeId || !config.tibber1.active) {
    return null;
  }

  let ws = null;
  let reconnectTimer = null;
  let stopped = false;
  let failures = 0;
  const MAX_DELAY_MS = 10 * 60 * 1000;

  const scheduleReconnect = () => {
    if (stopped) return;
    const delay = Math.min(30000 * Math.pow(2, Math.min(failures, 5)), MAX_DELAY_MS);
    reconnectTimer = setTimeout(connect, delay);
  };

  const connect = async () => {
    if (stopped) return;

    const wsUrl = await fetchWebsocketUrl(apiKey, queryUrl) || feedUrl;
    if (!wsUrl) {
      failures++;
      scheduleReconnect();
      return;
    }

    try {
      ws = new WebSocket(wsUrl, 'graphql-transport-ws');

      ws.onopen = () => {
        ws.send(JSON.stringify({type: 'connection_init', payload: {token: apiKey}}));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'connection_ack') {
          failures = 0;
          ws.send(
            JSON.stringify({
              id: '1',
              type: 'subscribe',
              payload: {
                query: `subscription { liveMeasurement(homeId:"${homeId}") { timestamp power accumulatedConsumption maxPower powerProduction } }`,
              },
            }),
          );
          if (onConnect) {
            onConnect();
          }
        } else if (msg.type === 'next' && msg.payload && msg.payload.data) {
          if (onData) {
            onData(msg.payload.data.liveMeasurement);
          }
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        if (onDisconnect) {
          onDisconnect();
        }
        failures++;
        scheduleReconnect();
      };
    } catch {
      failures++;
      scheduleReconnect();
    }
  };

  connect();

  const cleanup = () => {
    stopped = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    if (ws) {
      ws.close();
    }
  };

  cleanup.reconnectNow = () => {
    if (stopped) return;
    failures = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws && ws.readyState !== WebSocket.OPEN) {
      try { ws.close(); } catch {}
    }
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      connect();
    }
  };

  return cleanup;
};
