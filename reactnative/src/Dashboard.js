import React, {useEffect, useCallback, useState, useRef} from 'react';
import {View, StyleSheet, TouchableOpacity, Text, StatusBar, ImageBackground, Platform} from 'react-native';
import {useShallow} from 'zustand/react/shallow';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from './store';
import usePolling from './hooks/usePolling';
import useAutoSleep from './hooks/useAutoSleep';
import useNetworkRefresh from './hooks/useNetworkRefresh';
import useIsOnline from './hooks/useIsOnline';

// Widgets
import WeatherWidget from './widgets/WeatherWidget';
import ClockWidget from './widgets/ClockWidget';
import ForecastWidget from './widgets/ForecastWidget';
import NewsWidget from './widgets/NewsWidget';
import CalendarWidget from './widgets/CalendarWidget';
import StocksWidget from './widgets/StocksWidget';
import TibberPriceWidget from './widgets/TibberPriceWidget';
import TibberGaugesWidget from './widgets/TibberGaugesWidget';
import ThermostatWidget from './widgets/ThermostatWidget';
import EVBatteryWidget from './widgets/EVBatteryWidget';
import HomevoltWidget from './widgets/HomevoltWidget';
import ConsumptionWidget from './widgets/ConsumptionWidget';
import SonosWidget from './widgets/SonosWidget';
import PlaylistWidget from './widgets/PlaylistWidget';
import TodoWidget from './widgets/TodoWidget';
import ChoresWidget from './widgets/ChoresWidget';
import CountdownWidget from './widgets/CountdownWidget';
import MealsWidget from './widgets/MealsWidget';
import RecipesWidget from './widgets/RecipesWidget';
import HeadlinesWidget, {HEADLINE_COUNT} from './widgets/HeadlinesWidget';
import LaMarzoccoWidget from './widgets/LaMarzoccoWidget';
import PoolWidget from './widgets/PoolWidget';

// Components
import SettingsModal from './components/SettingsModal';
import NewsPopup from './components/NewsPopup';
import RecipeViewer from './components/RecipeViewer';
import RecipesPopup from './components/RecipesPopup';
import LaMarzoccoPopup from './components/LaMarzoccoPopup';
import PlaylistPopup from './components/PlaylistPopup';
import GroupVolumePopup from './components/GroupVolumePopup';
import SearchPopup from './components/SearchPopup';
import Toast from './components/Toast';

// Services
import {fetchCurrentWeather, fetchForecast, fetchNetatmoForecast} from './services/weatherService';
import {fetchNews, loadCachedNews} from './services/newsService';
import {fetchQuotes} from './services/stockService';
import {fetchCalendar} from './services/calendarService';
import {fetchTibberPrices, fetchTibberDevices, createTibberFeed} from './services/tibberService';
import {fetchLaMarzoccoStatus} from './services/lamarzoccoService';
import {fetchPoolStatus} from './services/poolService';
import {resolveSlots} from './utils/layout';

// Background images
import bgBeach from './assets/images/beach.jpg';
import bgNight from './assets/images/night.jpg';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const Dashboard = () => {
  const insets = useSafeAreaInsets();
  const config = useStore((s) => s.config);
  const setWeather = useStore((s) => s.setWeather);
  const setCurrentCondition = useStore((s) => s.setCurrentCondition);
  const setForecast = useStore((s) => s.setForecast);
  const setArticles = useStore((s) => s.setArticles);
  const setEvents = useStore((s) => s.setEvents);
  const reportFetch = useStore((s) => s.reportFetch);
  const setTibberFeed = useStore((s) => s.setTibberFeed);
  const setLaMarzocco = useStore((s) => s.setLaMarzocco);
  const setPool = useStore((s) => s.setPool);
  const setSettingsVisible = useStore((s) => s.setSettingsVisible);
  const isKioskDisplay = useStore((s) => s.isKioskDisplay);
  const asleep = useStore((s) => s.asleep);
  // Presence flags only: live data must not re-render the whole dashboard
  const has = useStore(
    useShallow((s) => ({
      quotes: !!s.quotes && s.quotes.length > 0,
      // No fetch has answered yet (reportFetch sets stale on the first reply)
      quotesPending: s.stale.quotes === undefined,
      tibberPending: s.stale.tibber === undefined,
      tibberToday: !!s.tibber?.currentSubscription?.priceInfo?.today,
      tibberCurrent: !!s.tibber?.currentSubscription?.priceInfo?.current,
      inverter: !!s.tibber2?.inverter,
      thermostat: !!s.tibber2?.thermostat,
      battery: !!s.tibber2?.battery,
      ev: s.tibber2?.electricVehicles?.length > 0,
      power: !!s.tibberFeed?.power,
      lamarzocco: !!s.lamarzocco,
      pool: !!s.pool,
    })),
  );

  const isTibberEnabled = config.energyProvider === 'tibber' || (config.energyProvider === undefined && !!config.tibber1?.apiEndpoint?.apiKey);
  const isOnline = useIsOnline();
  // Hold polling until saved settings are loaded, otherwise the first fetch
  // runs against defaults and real data waits a full poll interval
  const configLoaded = useStore((s) => s.configLoaded);

  // Minute tick (sparser asleep): children read the clock at render, e.g.
  // meal/recipe date rollover, the price chart window and "updated" labels
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const step = asleep ? 10 * MIN : MIN;
    let timer;
    const next = () => {
      timer = setTimeout(() => {
        setTick(Date.now());
        next();
      }, step - (Date.now() % step) + 50);
    };
    next();
    return () => clearTimeout(timer);
  }, [asleep]);
  const hour = new Date(tick).getHours();

  // Last good headlines from the previous run, so a restart is never blank
  useEffect(() => {
    loadCachedNews().then((cached) => {
      if (cached && !useStore.getState().articles) setArticles(cached);
    });
  }, [setArticles]);

  const onUserActivity = useAutoSleep(config.autosleep, {
    enabled: configLoaded,
    controlsPanel: Platform.OS === 'web' && isKioskDisplay,
  });

  // Fallback for setups without an autosleep window
  const isNightMode = hour > 2 && hour < 8;
  const poll = (sleepIntervalMs, extra) => ({
    enabled: configLoaded,
    asleep,
    sleepIntervalMs,
    ...extra,
  });

  const fetchWeather = useCallback(async () => {
    try {
      const result = await fetchCurrentWeather(config);
      if (result) {
        setWeather(result.weather);
        setCurrentCondition(result.condition);
      }
    } catch (err) {
      console.warn('Weather error:', err);
    }
  }, [config, setWeather, setCurrentCondition]);
  const runWeather = usePolling(fetchWeather, (isNightMode ? 30 : 10) * MIN, poll(HOUR));

  // Own 30 min slot: riding the 10 min weather poll blew the 100/day free tiers
  const fetchNewsPoll = useCallback(async () => {
    try {
      const articles = await fetchNews(config);
      if (articles) setArticles(articles);
    } catch (err) {
      console.warn('News error:', err);
    }
  }, [config, setArticles]);
  const runNews = usePolling(fetchNewsPoll, 30 * MIN, poll(null));

  const stocksConfigured = !!config.quotes && config.quotes.length > 0;
  const fetchStocks = useCallback(async () => {
    try {
      const q = await fetchQuotes(config.quotes);
      reportFetch('quotes', q, !!(q && q.length > 0));
    } catch (err) {
      console.warn('Stocks error:', err);
      reportFetch('quotes', null, false);
    }
  }, [config.quotes, reportFetch]);
  const runStocks = usePolling(fetchStocks, 10 * MIN, poll(null, {enabled: configLoaded && stocksConfigured}));

  const poolCfg = config.smartDevices?.pool;
  const poolOn = !!poolCfg?.host && poolCfg.showWidget !== false;
  const fetchPool = useCallback(async () => {
    try {
      const status = await fetchPoolStatus(poolCfg.host);
      if (status) setPool(status);
    } catch (err) {
      console.warn('Pool error:', err);
    }
  }, [poolCfg?.host, setPool]);
  const runPool = usePolling(fetchPool, 10 * MIN, poll(HOUR, {enabled: configLoaded && poolOn}));

  const fetchForecastPoll = useCallback(async () => {
    try {
      // Netatmo needs both an owned station and a live bearer; without them
      // this is a guaranteed 403 every hour. met.no is the default source.
      let fc = null;
      const netatmo = config.netatmo?.forecast;
      if (netatmo?.device_id && netatmo?.bearer) {
        fc = await fetchNetatmoForecast(config);
      }
      if (!fc) {
        fc = await fetchForecast(config);
      }
      if (fc) {
        setForecast(fc);
      }
    } catch (err) {
      console.warn('Forecast error:', err);
    }
  }, [config, setForecast]);
  const runForecast = usePolling(fetchForecastPoll, HOUR, poll(3 * HOUR));

  const fetchCalendarPoll = useCallback(async () => {
    try {
      const events = await fetchCalendar(config);
      if (events) {
        setEvents(events);
      }
    } catch (err) {
      console.warn('Calendar error:', err);
    }
  }, [config, setEvents]);
  const runCalendar = usePolling(fetchCalendarPoll, HOUR, poll(3 * HOUR));

  const fetchPrices = useCallback(async () => {
    try {
      const tibberData = await fetchTibberPrices(config);
      const priceInfo = tibberData?.currentSubscription?.priceInfo;
      reportFetch(
        'tibber',
        tibberData,
        !!(priceInfo?.current && priceInfo?.today?.length),
      );
    } catch (err) {
      console.warn('Tibber error:', err);
      reportFetch('tibber', null, false);
    }
  }, [config, reportFetch]);
  // Aligned to the top of the hour so `current` and `today` turn over on
  // time, and a wake after an hour or day boundary refetches
  const runPrices = usePolling(
    fetchPrices,
    HOUR,
    poll(3 * HOUR, {enabled: configLoaded && isTibberEnabled, align: true}),
  );

  const fetchDevices = useCallback(async () => {
    try {
      const t2 = await fetchTibberDevices(config);
      // Incomplete if a device section we had last time is missing now
      const prev = useStore.getState().tibber2;
      const missingSection =
        !!prev && !!t2 && Object.keys(prev).some((k) => !t2[k]);
      reportFetch('tibber2', t2, !!t2 && !missingSection);
    } catch (err) {
      console.warn('Tibber devices error:', err);
      reportFetch('tibber2', null, false);
    }
  }, [config, reportFetch]);
  const runDevices = usePolling(
    fetchDevices,
    HOUR,
    poll(3 * HOUR, {enabled: configLoaded && isTibberEnabled}),
  );

  const lmSerial = config.smartDevices?.lamarzocco?.serialNumber;
  const lmWidgetEnabled = config.smartDevices?.lamarzocco?.showWidget !== false;
  const fetchLaMarzocco = useCallback(async () => {
    try {
      const lm = await fetchLaMarzoccoStatus(lmSerial);
      if (lm) {
        setLaMarzocco(lm);
      }
    } catch (err) {
      console.warn('LaMarzocco error:', err);
    }
  }, [lmSerial, setLaMarzocco]);
  const runLaMarzocco = usePolling(
    fetchLaMarzocco,
    HOUR,
    poll(null, {enabled: configLoaded && !!lmSerial && lmWidgetEnabled}),
  );

  // Tibber live feed (WebSocket), closed while asleep
  const tibberFeedCleanupRef = useRef(null);

  const pollers = {
    weather: runWeather,
    news: runNews,
    stocks: runStocks,
    pool: runPool,
    forecast: runForecast,
    calendar: runCalendar,
    tibber: runPrices,
    tibber2: runDevices,
    lamarzocco: runLaMarzocco,
  };
  const pollersRef = useRef(pollers);
  pollersRef.current = pollers;

  // Paused pollers (news while asleep) defer the reconnect run to the wake
  useNetworkRefresh(useCallback(() => {
    Object.values(pollersRef.current).forEach((runNow) => runNow());
    tibberFeedCleanupRef.current?.reconnectNow?.();
  }, []));

  // Settings refresh and saves. runNow picks up the latest callbacks, so the
  // run sees the config saved in the same tap
  const refreshNonce = useStore((s) => s.refreshNonce);
  useEffect(() => {
    if (!refreshNonce) return;
    const keys = useStore.getState().refreshKeys;
    useStore.setState({refreshKeys: []});
    const wanted = keys === null ? Object.keys(pollersRef.current) : keys;
    wanted.forEach((k) => pollersRef.current[k]?.(true));
    if (keys === null || keys.includes('tibber')) {
      tibberFeedCleanupRef.current?.reconnectNow?.();
    }
  }, [refreshNonce]);

  const tibberApiKey = config.tibber1?.apiEndpoint?.apiKey;
  const tibberHomeId = config.tibber1?.homeId;
  const feedWanted = isTibberEnabled && !!config.tibber2?.pulse && !!tibberApiKey && !!tibberHomeId;
  useEffect(() => {
    if (!feedWanted) {
      setTibberFeed(null);
      return;
    }
    // Keep the last reading on screen; the feed reopens on wake
    if (asleep) return;
    const cleanup = createTibberFeed(
      useStore.getState().config,
      (data) => setTibberFeed(data),
    );
    tibberFeedCleanupRef.current = cleanup;
    return () => {
      tibberFeedCleanupRef.current = null;
      cleanup?.();
    };
  }, [
    feedWanted,
    tibberApiKey,
    tibberHomeId,
    config.tibber1?.active,
    config.tibber2?.pulse,
    asleep,
    setTibberFeed,
  ]);

  // Show stocks widget OR tibber price chart in middle-right column
  const hasStocks = stocksConfigured && has.quotes;
  const wantsTibberPrices =
    isTibberEnabled &&
    config.showEnergyPrice !== false &&
    config.showEnergyChart !== false;
  const hasTibberPrices = wantsTibberPrices && has.tibberToday;

  const slots = resolveSlots(config);
  const showsHeadlines = Object.values(slots).includes('headlines');

  // 'auto' only exists in the middle-right slot and goes by what has data
  const renderWidget = (widget) => {
    switch (widget) {
      case 'weather':
        return <WeatherWidget />;
      case 'clock':
        return <ClockWidget />;
      case 'forecast':
        return <ForecastWidget />;
      case 'news':
        return <NewsWidget skip={showsHeadlines ? HEADLINE_COUNT : 0} />;
      case 'calendar':
        return <CalendarWidget />;
      case 'sonos':
        return <SonosWidget />;
      case 'playlists':
        return <PlaylistWidget />;
      case 'stocks':
        return hasStocks ? <StocksWidget /> : null;
      case 'energy':
        return hasTibberPrices ? <TibberPriceWidget /> : null;
      case 'todo':
        return <TodoWidget />;
      case 'chores':
        return <ChoresWidget />;
      case 'headlines':
        return <HeadlinesWidget />;
      case 'countdown':
        return <CountdownWidget />;
      case 'meals':
        return <MealsWidget />;
      case 'auto':
        if (hasStocks) {
          return <StocksWidget />;
        }
        if (hasTibberPrices) {
          return <TibberPriceWidget />;
        }
        // Stay empty until the first fetch answers, so To Do does not flash by first
        if ((stocksConfigured && has.quotesPending) || (wantsTibberPrices && has.tibberPending)) {
          return null;
        }
        return <TodoWidget />;
      default:
        return null;
    }
  };

  const hasEnergyWidgets =
    isTibberEnabled &&
    (has.tibberCurrent || has.inverter || has.thermostat || has.battery || has.ev || has.power);
  const hasLaMarzocco = has.lamarzocco && lmWidgetEnabled;
  const poolWidgetEnabled = config.smartDevices?.pool?.showWidget !== false;
  const hasPool = has.pool && poolWidgetEnabled;

  const showTile = (tile) => config.layout?.tiles?.[tile] !== false;
  const showConsumption = has.power && showTile('consumption');
  const showBattery = has.battery && showTile('battery');
  const showEV = has.ev && showTile('ev');
  const showThermostat = has.thermostat && showTile('thermostat');

  // Background: custom URL per time of day, fallback to bundled defaults
  const isEvening = hour >= 19 || hour < 7;
  const dayUrl = config.background?.dayUrl;
  const eveningUrl = config.background?.eveningUrl;
  const bgSource = isEvening
    ? (eveningUrl ? {uri: eveningUrl} : bgNight)
    : (dayUrl ? {uri: dayUrl} : bgBeach);

  return (
    <ImageBackground
      source={bgSource}
      style={styles.background}
      resizeMode="cover">
      {/* Not on ImageBackground: it forwards the prop to its Image, under the widgets */}
      <View
        onTouchStart={onUserActivity}
        style={[
          styles.container,
          {
            paddingTop: 20 + insets.top,
            // 10 tighter than the top: the extra goes to the middle row
            paddingBottom: 10 + insets.bottom,
            paddingLeft: 20 + insets.left,
            paddingRight: 20 + insets.right,
          },
        ]}>
        <StatusBar hidden />

        {/* Row 1: Weather | Clock | Forecast */}
        <View style={styles.topRow}>
          <View style={styles.col35}>{renderWidget(slots.topLeft)}</View>
          <View style={styles.col30}>{renderWidget(slots.topCenter)}</View>
          <View style={styles.col35}>{renderWidget(slots.topRight)}</View>
        </View>

        {/* Row 2: News | Calendar | Stocks/Prices */}
        <View style={styles.middleRow}>
          <View style={styles.col35}>{renderWidget(slots.midLeft)}</View>
          <View style={styles.col30}>{renderWidget(slots.midCenter)}</View>
          <View style={styles.col35}>{renderWidget(slots.midRight)}</View>
        </View>

        {/* Row 3: Sonos | Playlists | Home (gauges, thermo, EV) */}
        {/* The home panel gets extra width from the playlists, which only
            need about 70% of a regular column */}
        <View style={styles.bottomRow}>
          <View style={styles.col35}>{renderWidget(slots.bottomLeft)}</View>
          <View style={styles.colPlaylists}>{renderWidget(slots.bottomCenter)}</View>
          <View style={styles.colHome}>
            <View style={styles.homePanel}>
              <View style={styles.homeCol}>
                {hasEnergyWidgets && showTile('gauges') && <TibberGaugesWidget />}
                {showConsumption ? (
                  <View style={styles.homeCard}>
                    <ConsumptionWidget />
                  </View>
                ) : null}
                {showBattery && showEV ? (
                  // Battery + EV share one tile as stacked half-size widgets
                  <View style={styles.homeCard}>
                    <View style={styles.stackHalf}>
                      <HomevoltWidget compact />
                    </View>
                    <View style={styles.stackHalf}>
                      <EVBatteryWidget compact />
                    </View>
                  </View>
                ) : (
                  <>
                    {showBattery ? (
                      <View style={styles.homeCard}>
                        <HomevoltWidget />
                      </View>
                    ) : null}
                    {showEV ? (
                      <View style={styles.homeCard}>
                        <EVBatteryWidget />
                      </View>
                    ) : null}
                  </>
                )}
                {showThermostat ? (
                  <View style={styles.homeCard}>
                    <ThermostatWidget />
                  </View>
                ) : null}
                {hasLaMarzocco ? (
                  <View style={styles.homeCard}>
                    <LaMarzoccoWidget />
                  </View>
                ) : null}
                {hasPool ? (
                  <View style={styles.homeCard}>
                    <PoolWidget />
                  </View>
                ) : null}
                {showTile('recipes') ? (
                  <View style={styles.homeCard}>
                    <RecipesWidget />
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* Offline indicator */}
        {!isOnline && (
          <View style={styles.offlinePill}>
            <Icon name="wifi-off" size={14} color="#ffb74d" />
            <Text style={styles.offlineText}>Offline</Text>
          </View>
        )}

        {/* Settings cog */}
        <TouchableOpacity
          style={styles.settingsCog}
          onPress={() => setSettingsVisible(true)}>
          <Icon name="cog-outline" size={26} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

        {/* Modals */}
        <SettingsModal />
        <NewsPopup />
        <RecipesPopup />
        <RecipeViewer />
        <LaMarzoccoPopup />
        <PlaylistPopup />
        <GroupVolumePopup />
        <SearchPopup />
        <Toast />
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  // Row 1 - 28% height
  topRow: {
    flexDirection: 'row',
    flex: 2.8,
    marginBottom: 8,
  },
  // Row 2 - 48% height, plus a fixed 10 reclaimed from the bottom padding so
  // the news/calendar/chores cards get taller without shrinking the other rows
  middleRow: {
    flexDirection: 'row',
    flexGrow: 4.8,
    flexShrink: 1,
    flexBasis: 10,
    marginBottom: 8,
  },
  // Row 3 - 24% height
  bottomRow: {
    flexDirection: 'row',
    flex: 2.4,
  },
  col35: {
    flex: 35,
  },
  col30: {
    flex: 30,
  },
  colPlaylists: {
    flex: 21,
  },
  colHome: {
    flex: 44,
  },
  // Dark panel that always fills the column, leaving visible room for
  // future tiles
  homePanel: {
    flex: 1,
    margin: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  homeCol: {
    flex: 1,
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    gap: 12,
  },
  homeCard: {
    flex: 1,
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  stackHalf: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsCog: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
    zIndex: 999,
    elevation: 10,
  },
  offlinePill: {
    position: 'absolute',
    top: 14,
    right: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    zIndex: 999,
    elevation: 10,
  },
  offlineText: {
    color: '#ffb74d',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default Dashboard;
