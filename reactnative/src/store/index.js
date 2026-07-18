import {create} from 'zustand';
import defaults from '../config/defaults';

const useStore = create((set, get) => ({
  // Config
  config: {...defaults},
  configLoaded: false,
  setConfig: (config) => set({config: {...defaults, ...config}, configLoaded: true}),
  updateConfig: (partial) =>
    set((state) => ({config: {...state.config, ...partial}})),

  // Weather
  weather: null,
  currentCondition: null,
  forecast: null,
  setWeather: (weather) => set({weather}),
  setCurrentCondition: (currentCondition) => set({currentCondition}),
  setForecast: (forecast) => set({forecast}),

  // Time
  currentTime: '',
  currentDay: '',
  remoteTime: '',
  remoteAbbr: '',
  setTime: (data) => set(data),

  // News
  articles: null,
  setArticles: (articles) => set({articles}),

  // Calendar
  events: null,
  setEvents: (events) => set({events}),

  // Stocks
  quotes: null,
  setQuotes: (quotes) =>
    set((state) => ({quotes, stale: {...state.stale, quotes: 0}})),

  // Data freshness: a failed or incomplete poll keeps the previous data and
  // bumps the slice's miss counter so widgets grey their accents instead of
  // disappearing. Once a widget has data it stays until real data replaces
  // it (or settings are saved, which resets via the plain setters)
  stale: {},
  reportFetch: (key, data, valid) =>
    set((state) => {
      if (valid) {
        return {[key]: data, stale: {...state.stale, [key]: 0}};
      }
      if (state[key] == null) {
        // Nothing retained yet: partial data beats an empty widget, but
        // flag it stale so it renders greyed
        return {[key]: data, stale: {...state.stale, [key]: 1}};
      }
      return {stale: {...state.stale, [key]: (state.stale[key] || 0) + 1}};
    }),

  // Tibber
  tibber: null,
  tibber2: null,
  tibberFeed: null,
  tibberDataApiConnected: false,
  setTibber: (tibber) =>
    set((state) => ({tibber, stale: {...state.stale, tibber: 0}})),
  setTibber2: (tibber2) =>
    set((state) => ({tibber2, stale: {...state.stale, tibber2: 0}})),
  setTibberFeed: (tibberFeed) => set({tibberFeed}),
  setTibberDataApiConnected: (v) => set({tibberDataApiConnected: v}),

  // Spotify
  spotifyConnected: false,
  setSpotifyConnected: (v) => set({spotifyConnected: v}),

  // La Marzocco
  lamarzocco: null,
  setLaMarzocco: (lamarzocco) => set({lamarzocco}),

  // Sonos
  sonos: {
    state: null,
    track: null,
    volume: 0,
    position: 0,
    ratio: 1,
    increment: 0,
    shuffle: false,
  },
  setSonosTrack: (track) =>
    set((state) => ({
      sonos: {
        ...state.sonos,
        track,
        position: track.position || 0,
        ratio: track.duration ? 100 / track.duration : 1,
      },
    })),
  setSonosState: (sonosState) =>
    set((state) => ({
      sonos: {
        ...state.sonos,
        state: sonosState,
        increment: sonosState === 'playing' ? 1 : 0,
      },
    })),
  setSonosVolume: (volume) =>
    set((state) => ({sonos: {...state.sonos, volume}})),
  setSonosShuffle: (shuffle) =>
    set((state) => ({sonos: {...state.sonos, shuffle}})),
  incrementSonosPosition: () =>
    set((state) => ({
      sonos: {
        ...state.sonos,
        position: state.sonos.position + state.sonos.increment,
      },
    })),

  // UI state
  settingsVisible: false,
  newsPopupVisible: false,
  currentArticle: null,
  playlistPopupVisible: false,
  currentPlaylist: null,
  setSettingsVisible: (visible) => set({settingsVisible: visible}),
  showArticle: (article) =>
    set({currentArticle: article, newsPopupVisible: true}),
  hideArticle: () => set({newsPopupVisible: false, currentArticle: null}),
  popupAnchor: null,
  showPlaylist: (playlist, anchor) =>
    set({currentPlaylist: playlist, playlistPopupVisible: true, popupAnchor: anchor || null}),
  hidePlaylist: () => set({playlistPopupVisible: false, currentPlaylist: null, popupAnchor: null}),
  quickPickPopupVisible: false,
  currentQuickPick: null,
  showQuickPick: (category, anchor) =>
    set({currentQuickPick: category, quickPickPopupVisible: true, popupAnchor: anchor || null}),
  hideQuickPick: () =>
    set({quickPickPopupVisible: false, currentQuickPick: null, popupAnchor: null}),
  groupVolumeVisible: false,
  showGroupVolume: () => set({groupVolumeVisible: true}),
  hideGroupVolume: () => set({groupVolumeVisible: false}),
  searchPopupVisible: false,
  showSearch: (anchor) =>
    set({searchPopupVisible: true, popupAnchor: anchor || null}),
  hideSearch: () =>
    set({searchPopupVisible: false, popupAnchor: null}),

  // Screen
  asleep: false,
  keepAwake: true,
  setKeepAwake: (keepAwake) => set({keepAwake}),
}));

export default useStore;
