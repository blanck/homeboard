import React, {useEffect, useCallback, useState, useRef} from 'react';
import {View, StyleSheet, TouchableOpacity, Text, StatusBar, ImageBackground} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from './store';
import usePolling from './hooks/usePolling';
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
import LaMarzoccoWidget from './widgets/LaMarzoccoWidget';

// Components
import SettingsModal from './components/SettingsModal';
import NewsPopup from './components/NewsPopup';
import PlaylistPopup from './components/PlaylistPopup';
import SearchPopup from './components/SearchPopup';

// Services
import {fetchCurrentWeather, fetchForecast, fetchNetatmoForecast, fetchNetatmoPublicForecast} from './services/weatherService';
import {fetchNews} from './services/newsService';
import {fetchQuotes} from './services/stockService';
import {fetchCalendar} from './services/calendarService';
import {fetchTibberPrices, fetchTibberDevices, createTibberFeed} from './services/tibberService';
import {fetchLaMarzoccoStatus} from './services/lamarzoccoService';

// Background images
const bgBeach = require('./assets/images/beach.jpg');
const bgNight = require('./assets/images/night.jpg');

const Dashboard = () => {
  const insets = useSafeAreaInsets();
  const config = useStore((s) => s.config);
  const setWeather = useStore((s) => s.setWeather);
  const setCurrentCondition = useStore((s) => s.setCurrentCondition);
  const setForecast = useStore((s) => s.setForecast);
  const setArticles = useStore((s) => s.setArticles);
  const setQuotes = useStore((s) => s.setQuotes);
  const setEvents = useStore((s) => s.setEvents);
  const setTibber = useStore((s) => s.setTibber);
  const setTibber2 = useStore((s) => s.setTibber2);
  const setTibberFeed = useStore((s) => s.setTibberFeed);
  const setLaMarzocco = useStore((s) => s.setLaMarzocco);
  const setSettingsVisible = useStore((s) => s.setSettingsVisible);
  const tibber = useStore((s) => s.tibber);
  const quotes = useStore((s) => s.quotes);
  const lamarzocco = useStore((s) => s.lamarzocco);

  const isTibberEnabled = config.energyProvider === 'tibber' || (config.energyProvider === undefined && !!config.tibber1?.apiEndpoint?.apiKey);
  const isOnline = useIsOnline();

  // Re-evaluate time periodically (for background switch and night mode)
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const timer = setInterval(() => {
      setHour(new Date().getHours());
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine polling interval — reduced frequency between 2-8am
  const isNightMode = hour > 2 && hour < 8;
  const minuteInterval = isNightMode ? 30 * 60 * 1000 : 10 * 60 * 1000;

  // Weather + stocks + news — every 10 min (30 min at night)
  const fetchMinutely = useCallback(async () => {
    try {
      const result = await fetchCurrentWeather(config);
      if (result) {
        setWeather(result.weather);
        setCurrentCondition(result.condition);
      }
    } catch (err) {
      console.warn('Weather error:', err);
    }

    try {
      const articles = await fetchNews(config);
      if (articles) {
        setArticles(articles);
      }
    } catch (err) {
      console.warn('News error:', err);
    }

    try {
      if (config.quotes && config.quotes.length > 0) {
        const q = await fetchQuotes(config.quotes);
        if (q) {
          setQuotes(q);
        }
      }
    } catch (err) {
      console.warn('Stocks error:', err);
    }
  }, [config, setWeather, setCurrentCondition, setArticles, setQuotes]);

  usePolling(fetchMinutely, minuteInterval);

  // Forecast + calendar + tibber prices — every 60 min
  const fetchHourly = useCallback(async () => {
    try {
      let fc = null;
      if (config.netatmo?.mode === 'public' && config.netatmo?.publicUrl) {
        fc = await fetchNetatmoPublicForecast(config);
      } else if (config.netatmo?.forecast?.device_id) {
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

    try {
      const events = await fetchCalendar(config);
      if (events) {
        setEvents(events);
      }
    } catch (err) {
      console.warn('Calendar error:', err);
    }

    if (isTibberEnabled) {
      try {
        const tibberData = await fetchTibberPrices(config);
        if (tibberData) {
          setTibber(tibberData);
        }
      } catch (err) {
        console.warn('Tibber error:', err);
      }

      try {
        const t2 = await fetchTibberDevices(config);
        if (t2) {
          setTibber2(t2);
        }
      } catch (err) {
        console.warn('Tibber devices error:', err);
      }
    }

    try {
      const lmSerial = config.smartDevices?.lamarzocco?.serialNumber;
      const lmEnabled = config.smartDevices?.lamarzocco?.showWidget !== false;
      if (lmSerial && lmEnabled) {
        const lm = await fetchLaMarzoccoStatus(lmSerial);
        if (lm) {
          setLaMarzocco(lm);
        }
      }
    } catch (err) {
      console.warn('LaMarzocco error:', err);
    }
  }, [config, isTibberEnabled, setForecast, setEvents, setTibber, setTibber2, setLaMarzocco]);

  usePolling(fetchHourly, 60 * 60 * 1000);

  // Refetch everything immediately when network reconnects
  useNetworkRefresh(useCallback(() => {
    fetchMinutely();
    fetchHourly();
    tibberFeedCleanupRef.current?.reconnectNow?.();
  }, [fetchMinutely, fetchHourly]));

  // Tibber live feed (WebSocket) — continuous
  const tibberFeedCleanupRef = useRef(null);
  useEffect(() => {
    if (isTibberEnabled && config.tibber2?.pulse && config.tibber1?.apiEndpoint?.apiKey && config.tibber1?.homeId) {
      const cleanup = createTibberFeed(
        config,
        (data) => setTibberFeed(data),
      );
      tibberFeedCleanupRef.current = cleanup;
      return () => {
        tibberFeedCleanupRef.current = null;
        cleanup();
      };
    } else {
      setTibberFeed(null);
    }
  }, [
    config.tibber1?.apiEndpoint?.apiKey,
    config.tibber1?.homeId,
    config.tibber1?.active,
    config.tibber2?.pulse,
    isTibberEnabled,
    setTibberFeed,
  ]);

  // Show stocks widget OR tibber price chart in middle-right column
  const stocksConfigured = config.quotes && config.quotes.length > 0;
  const hasStocks = stocksConfigured && quotes && quotes.length > 0;
  const hasTibberPrices =
    isTibberEnabled &&
    config.showEnergyPrice !== false &&
    config.showEnergyChart !== false &&
    tibber &&
    tibber.currentSubscription &&
    tibber.currentSubscription.priceInfo &&
    tibber.currentSubscription.priceInfo.today;

  const tibber2 = useStore((s) => s.tibber2);
  const tibberFeed = useStore((s) => s.tibberFeed);
  const hasEnergyWidgets =
    isTibberEnabled &&
    ((tibber && tibber.currentSubscription?.priceInfo?.current) ||
    (tibber2 && (tibber2.inverter || tibber2.thermostat || tibber2.battery)) ||
    (tibber2 && tibber2.electricVehicles && tibber2.electricVehicles.length > 0) ||
    (tibberFeed && tibberFeed.power));
  const lmWidgetEnabled = config.smartDevices?.lamarzocco?.showWidget !== false;
  const hasLaMarzocco = !!lamarzocco && lmWidgetEnabled;
  const hasHomeWidgets = hasEnergyWidgets || hasLaMarzocco;

  // Background: custom URL per time of day, fallback to bundled defaults
  const isEvening = hour >= 19 || hour < 7;
  const dayUrl = config.background?.dayUrl;
  const eveningUrl = config.background?.eveningUrl;
  const bgSource = isEvening
    ? (eveningUrl ? {uri: eveningUrl} : bgNight)
    : (dayUrl ? {uri: dayUrl} : bgBeach);

  return (
    <ImageBackground source={bgSource} style={styles.background} resizeMode="cover">
      <View
        style={[
          styles.container,
          {
            paddingTop: 20 + insets.top,
            paddingBottom: 20 + insets.bottom,
            paddingLeft: 20 + insets.left,
            paddingRight: 20 + insets.right,
          },
        ]}>
        <StatusBar hidden />

        {/* Row 1: Weather | Clock | Forecast */}
        <View style={styles.topRow}>
          <View style={styles.col35}>
            <WeatherWidget />
          </View>
          <View style={styles.col30}>
            <ClockWidget />
          </View>
          <View style={styles.col35}>
            <ForecastWidget />
          </View>
        </View>

        {/* Row 2: News | Calendar | Stocks/Prices */}
        <View style={styles.middleRow}>
          <View style={styles.col35}>
            <NewsWidget />
          </View>
          <View style={styles.col30}>
            <CalendarWidget />
          </View>
          <View style={styles.col35}>
            {hasStocks ? <StocksWidget /> : null}
            {!hasStocks && hasTibberPrices ? <TibberPriceWidget /> : null}
            {!hasStocks && !hasTibberPrices ? <TodoWidget /> : null}
          </View>
        </View>

        {/* Row 3: Sonos | Playlists | Home (gauges, thermo, EV) */}
        <View style={styles.bottomRow}>
          <View style={styles.col35}>
            <SonosWidget />
          </View>
          <View style={styles.col30}>
            <PlaylistWidget />
          </View>
          <View style={styles.col35}>
            {hasHomeWidgets ? (
              <View style={styles.homeCol}>
                {hasEnergyWidgets && <TibberGaugesWidget />}
                {tibberFeed && tibberFeed.power ? (
                  <View style={styles.homeCard}>
                    <ConsumptionWidget />
                  </View>
                ) : null}
                {tibber2 && tibber2.battery ? (
                  <View style={styles.homeCard}>
                    <HomevoltWidget />
                  </View>
                ) : null}
                {tibber2 && tibber2.thermostat ? (
                  <View style={styles.homeCard}>
                    <ThermostatWidget />
                  </View>
                ) : null}
                {tibber2 && tibber2.electricVehicles && tibber2.electricVehicles.length > 0 ? (
                  <View style={styles.homeCard}>
                    <EVBatteryWidget />
                  </View>
                ) : null}
                {hasLaMarzocco ? (
                  <View style={styles.homeCard}>
                    <LaMarzoccoWidget />
                  </View>
                ) : null}
              </View>
            ) : null}
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
        <PlaylistPopup />
        <SearchPopup />
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
  // Row 2 - 48% height
  middleRow: {
    flexDirection: 'row',
    flex: 4.8,
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
  homeCol: {
    flex: 35,
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    gap: 4,
  },
  homeCard: {
    flex: 1,
    maxWidth: 180,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
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
