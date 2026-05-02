const defaults = {
  location: {
    lat: 56.4277887,
    lng: 12.842306,
  },
  language: 'en',
  autosleep: '22-07', // hh-hh

  quotes: ['^GSPC', '^DJI', '^IXIC', '^RUT', '^OMX', 'SI=F', 'GC=F'],

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
    provider: 'newsdata',
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
