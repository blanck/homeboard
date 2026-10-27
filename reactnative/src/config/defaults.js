import {DEFAULT_RSS_FEEDS} from './newsFeeds';

const defaults = {
  location: {
    lat: 56.4277887,
    lng: 12.842306,
  },
  language: 'en',
  autosleep: '22-07', // hh-hh

  quotes: ['^GSPC', '^DJI', '^IXIC', '^RUT', '^OMX', 'SI=F', 'GC=F'],

  // Which module fills the middle-right column: auto picks the first of
  // stocks / energy prices / todo that has data
  rightModule: 'auto',

  countdown: {
    title: 'Thailand',
    date: '2026-11-16', // YYYY-MM-DD
    time: '', // HH:MM local, empty = midnight
    imageUrl:
      'https://static.wixstatic.com/media/f6eb7e_ca361ed00bf744928455bca7c2bf24e0~mv2.jpg/v1/fill/w_2475,h_1650,al_c,q_90,usm_0.66_1.00_0.01,enc_auto/f6eb7e_ca361ed00bf744928455bca7c2bf24e0~mv2.jpg',
  },

  chores: {
    members: [], // {id, name, color}
    items: [], // {id, name, icon, points, assignee, recurrence, days, dayOfMonth}
    showPoints: true,
  },

  time: {
    localzone: '', // Empty = use device timezone
    remotezone: 'America/Los_Angeles',
  },

  weather: {
    openweathermap: {
      key: '',
    },
  },

  netatmo: {
    mode: 'public',
    publicUrl: '',
    client_id: '',
    client_secret: '',
    username: '',
    password: '',
    options: {device_id: ''},
    forecast: {
      device_id: '',
      module_id: '',
      bearer: '',
      locale: 'en-US',
    },
  },

  newsapi: {
    rssFeeds: DEFAULT_RSS_FEEDS,
    // Whole-word match on title + summary; hits are shown first
    keywords: [],
    provider: 'rss',
    keys: {
      newsdata: '',
      thenewsapi: '',
      currents: '',
    },
    headlines: {
      language: 'en',
      sources: '',
      pageSize: 30,
    },
    exclude: [],
  },

  sonos: {
    ip: '', // Manual IP since we can't use node-sonos discovery
    group: '',
    region: '2311',
  },

  calendar: {
    shared: {url: '', type: 'VEVENT', days: 30},
    holiday: {url: '', type: 'VEVENT', days: 90},
  },

  energyProvider: 'disabled',
  showEnergyPrice: true,
  showEnergyChart: true,

  tibber1: {
    active: true,
    apiEndpoint: {
      apiKey: '',
      feedUrl: 'wss://api.tibber.com/v1-beta/gql/subscriptions',
      queryUrl: 'https://api.tibber.com/v1-beta/gql',
    },
    homeId: '',
  },

  tibber2: {
    thermostat: '',
    inverter: '',
    production: '',
    pulse: '',
    homevolt: '',
    ev: false,
    evDeviceIds: [],
  },

  smartDevices: {
    lamarzocco: {
      serialNumber: '',
      machineName: '',
      showWidget: true,
    },
  },

  playlist: {},
  quickPicks: [],

  background: {dayUrl: '', eveningUrl: ''},
  keepAwake: true,
};

export default defaults;
