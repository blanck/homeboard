import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  Animated,
  Alert,
} from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DevSettings} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {translate} from '../utils/translations';
import defaults from '../config/defaults';
import {fetchNews} from '../services/newsService';
import {fetchTibberPrices, fetchTibberDevices} from '../services/tibberService';
import GeneralTab from './settings/GeneralTab';
import WeatherTab from './settings/WeatherTab';
import EnergyTab from './settings/EnergyTab';
import NewsTab from './settings/NewsTab';
import StocksTab from './settings/StocksTab';
import CalendarTab from './settings/CalendarTab';
import MusicTab from './settings/MusicTab';
import SmartDevicesTab from './settings/SmartDevicesTab';
import ShareTab from './settings/ShareTab';

const SETTINGS_KEY = 'homeboard_settings';
const SECRETS_KEY = 'homeboard_secrets';

// Load saved settings on app start
export const loadSettings = async () => {
  try {
    const [settingsStr, secretsStr] = await Promise.all([
      AsyncStorage.getItem(SETTINGS_KEY),
      EncryptedStorage.getItem(SECRETS_KEY),
    ]);

    const settings = settingsStr ? JSON.parse(settingsStr) : {};
    const secrets = secretsStr ? JSON.parse(secretsStr) : {};

    // Merge secrets into config
    return deepMerge(defaults, settings, secrets);
  } catch (err) {
    console.warn('Error loading settings:', err);
    return defaults;
  }
};

const deepMerge = (...objects) => {
  const result = {};
  for (const obj of objects) {
    for (const key in obj) {
      if (
        obj[key] &&
        typeof obj[key] === 'object' &&
        !Array.isArray(obj[key])
      ) {
        result[key] = deepMerge(result[key] || {}, obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
  }
  return result;
};

const TABS = [
  {key: 'general', icon: 'cog'},
  {key: 'weather', icon: 'weather-partly-cloudy'},
  {key: 'energy', icon: 'flash'},
  {key: 'news', icon: 'newspaper'},
  {key: 'stocks', icon: 'chart-line'},
  {key: 'calendar', icon: 'calendar'},
  {key: 'music', icon: 'music'},
  {key: 'smartDevices', icon: 'devices'},
  {key: 'share', icon: 'sync'},
];

const SettingsModal = () => {
  const visible = useStore((s) => s.settingsVisible);
  const setSettingsVisible = useStore((s) => s.setSettingsVisible);
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);
  const setKeepAwake = useStore((s) => s.setKeepAwake);
  const setArticles = useStore((s) => s.setArticles);
  const setTibber = useStore((s) => s.setTibber);
  const setTibber2 = useStore((s) => s.setTibber2);
  const lang = config.language || 'en';

  const [activeTab, setActiveTab] = useState('general');
  const [form, setForm] = useState({});
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.92);
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
        mass: 0.8,
      }).start();
    }
  }, [visible, scale]);

  useEffect(() => {
    if (visible) {
      setForm({
        language: config.language || 'en',
        lat: String(config.location?.lat || ''),
        lng: String(config.location?.lng || ''),
        locationName: config.location?.name || '',
        localzone: config.time?.localzone || '',
        remotezone: config.time?.remotezone || '',
        owmKey: config.weather?.openweathermap?.key || '',
        netatmoMode: config.netatmo?.mode || 'public',
        netatmoPublicUrl: config.netatmo?.publicUrl || '',
        netatmoClientId: config.netatmo?.client_id || '',
        netatmoClientSecret: config.netatmo?.client_secret || '',
        netatmoDeviceId: config.netatmo?.options?.device_id || '',
        netatmoForecastDeviceId: config.netatmo?.forecast?.device_id || '',
        netatmoForecastModuleId: config.netatmo?.forecast?.module_id || '',
        netatmoForecastBearer: config.netatmo?.forecast?.bearer || '',
        energyProvider: config.energyProvider || 'disabled',
        tibberApiKey: config.tibber1?.apiEndpoint?.apiKey || '',
        tibberHomeId: config.tibber1?.homeId || '',
        tibberHomes: config.tibber1?.homes || [],
        showEnergyPrice: config.showEnergyPrice !== false,
        showEnergyChart: config.showEnergyChart !== false,
        tibberDevices: config.tibber2?.devices || [],
        tibberThermostat: config.tibber2?.thermostat || '',
        tibberInverter: config.tibber2?.inverter || '',
        tibberProduction: config.tibber2?.production || '',
        tibberPulse: config.tibber2?.pulse || '',
        tibberHomevolt: config.tibber2?.homevolt || '',
        tibberEv: !!config.tibber2?.ev,
        tibberEvDeviceIds: config.tibber2?.evDeviceIds || [],
        newsProvider: config.newsapi?.provider || 'newsdata',
        newsKeyNewsdata:
          config.newsapi?.keys?.newsdata ||
          (!config.newsapi?.provider && config.newsapi?.key) ||
          '',
        newsKeyThenewsapi: config.newsapi?.keys?.thenewsapi || '',
        newsKeyCurrents: config.newsapi?.keys?.currents || '',
        newsKeyNewsapiorg: config.newsapi?.keys?.newsapiorg || '',
        newsSources: config.newsapi?.headlines?.sources || '',
        newsLanguage: config.newsapi?.headlines?.language || 'en',
        newsCategories: (config.newsapi?.headlines?.categories || []).join(','),
        newsExclude: (config.newsapi?.exclude || []).join(', '),
        quotes: (config.quotes || []).join(', '),
        sonosIp: config.sonos?.ip || '',
        sonosName: config.sonos?.name || '',
        sonosGroup: config.sonos?.group || '',
        sonosRegion: config.sonos?.region || '2311',
        calSharedUrl: config.calendar?.shared?.url || '',
        calHolidayUrl: config.calendar?.holiday?.url || '',
        backgroundDayUrl: config.background?.dayUrl || '',
        backgroundEveningUrl: config.background?.eveningUrl || '',
        autosleep: config.autosleep || '',
        keepAwake: config.keepAwake !== false,
        quickPicks: config.quickPicks || [],
        smartDeviceType: config.smartDevices?.lamarzocco?.serialNumber ? 'lamarzocco' : '',
        lmSerialNumber: config.smartDevices?.lamarzocco?.serialNumber || '',
        lmMachineName: config.smartDevices?.lamarzocco?.machineName || '',
        lmShowWidget: config.smartDevices?.lamarzocco?.showWidget !== false,
      });
      setActiveTab('general');
    }
  }, [visible, config]);

  const updateField = (key, value) => {
    setForm((prev) => ({...prev, [key]: value}));
  };


  const saveSettings = async () => {
    const newConfig = {
      language: form.language,
      location: {
        lat: parseFloat(form.lat) || 0,
        lng: parseFloat(form.lng) || 0,
        name: form.locationName,
      },
      time: {
        localzone: form.localzone,
        remotezone: form.remotezone,
      },
      weather: {
        openweathermap: {key: form.owmKey},
      },
      netatmo: {
        mode: form.netatmoMode || 'public',
        publicUrl: form.netatmoPublicUrl || '',
        client_id: form.netatmoClientId,
        client_secret: form.netatmoClientSecret,
        options: {device_id: form.netatmoDeviceId},
        forecast: {
          device_id: form.netatmoForecastDeviceId,
          module_id: form.netatmoForecastModuleId,
          bearer: form.netatmoForecastBearer,
          locale: form.language === 'sv' ? 'sv-SE' : 'en-US',
        },
      },
      energyProvider: form.energyProvider || 'disabled',
      showEnergyPrice: form.showEnergyPrice !== false,
      showEnergyChart: form.showEnergyChart !== false,
      tibber1: {
        ...config.tibber1,
        apiEndpoint: {
          ...config.tibber1.apiEndpoint,
          apiKey: form.tibberApiKey,
        },
        homeId: form.tibberHomeId,
        homes: form.tibberHomes || [],
      },
      tibber2: {
        ...config.tibber2,
        devices: form.tibberDevices || [],
        thermostat: form.tibberThermostat || '',
        inverter: form.tibberInverter || '',
        production: form.tibberProduction || '',
        pulse: form.tibberPulse || '',
        homevolt: form.tibberHomevolt || '',
        ev: form.tibberEv || false,
        evDeviceIds: form.tibberEvDeviceIds || [],
      },
      newsapi: {
        provider: form.newsProvider || 'newsdata',
        keys: {
          newsdata: form.newsKeyNewsdata || '',
          thenewsapi: form.newsKeyThenewsapi || '',
          currents: form.newsKeyCurrents || '',
          newsapiorg: form.newsKeyNewsapiorg || '',
        },
        headlines: {
          language: form.newsLanguage,
          sources: form.newsSources,
          categories: form.newsCategories
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          pageSize: 30,
        },
        exclude: form.newsExclude
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      },
      quotes: form.quotes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      sonos: {
        ip: form.sonosIp,
        name: form.sonosName,
        group: form.sonosGroup,
        region: form.sonosRegion,
      },
      calendar: {
        shared: {url: form.calSharedUrl, type: 'VEVENT', days: 30},
        holiday: {url: form.calHolidayUrl, type: 'VEVENT', days: 90},
      },
      smartDevices: {
        lamarzocco: {
          serialNumber: form.lmSerialNumber || '',
          machineName: form.lmMachineName || '',
          showWidget: form.lmShowWidget !== false,
        },
      },
      background: {dayUrl: form.backgroundDayUrl, eveningUrl: form.backgroundEveningUrl},
      autosleep: form.autosleep,
      keepAwake: form.keepAwake,
      playlist: config.playlist || {},
      quickPicks: form.quickPicks || [],
    };

    // Separate secrets from preferences
    const secrets = {
      weather: {openweathermap: {key: form.owmKey}},
      netatmo: {
        client_id: form.netatmoClientId,
        client_secret: form.netatmoClientSecret,
      },
      tibber1: {apiEndpoint: {apiKey: form.tibberApiKey}},
      newsapi: {
        keys: {
          newsdata: form.newsKeyNewsdata || '',
          thenewsapi: form.newsKeyThenewsapi || '',
          currents: form.newsKeyCurrents || '',
          newsapiorg: form.newsKeyNewsapiorg || '',
        },
      },
    };

    const preferences = JSON.parse(JSON.stringify(newConfig));
    if (preferences.weather?.openweathermap) {
      preferences.weather.openweathermap.key = '';
    }
    if (preferences.netatmo) {
      preferences.netatmo.client_id = '';
      preferences.netatmo.client_secret = '';
    }
    if (preferences.tibber1?.apiEndpoint) {
      preferences.tibber1.apiEndpoint.apiKey = '';
    }
    if (preferences.newsapi) {
      preferences.newsapi.keys = {newsdata: '', thenewsapi: '', currents: ''};
      delete preferences.newsapi.key;
    }

    try {
      await Promise.all([
        AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences)),
        EncryptedStorage.setItem(SECRETS_KEY, JSON.stringify(secrets)),
      ]);
    } catch (err) {
      console.warn('Error saving settings:', err);
    }

    // Check if news settings changed
    const activeProvider = form.newsProvider || 'newsdata';
    const activeKey = newConfig.newsapi?.keys?.[activeProvider] || '';
    const newsChanged =
      form.newsProvider !== (config.newsapi?.provider || 'newsdata') ||
      form.newsKeyNewsdata !== (config.newsapi?.keys?.newsdata || '') ||
      form.newsKeyThenewsapi !== (config.newsapi?.keys?.thenewsapi || '') ||
      form.newsKeyCurrents !== (config.newsapi?.keys?.currents || '') ||
      form.newsKeyNewsapiorg !== (config.newsapi?.keys?.newsapiorg || '') ||
      form.newsSources !== (config.newsapi?.headlines?.sources || '') ||
      form.newsLanguage !== (config.newsapi?.headlines?.language || 'en') ||
      form.newsCategories !== (config.newsapi?.headlines?.categories || []).join(',') ||
      form.newsExclude !== (config.newsapi?.exclude || []).join(', ');

    setConfig(newConfig);
    setKeepAwake(form.keepAwake);
    setSettingsVisible(false);

    if (newsChanged && activeKey) {
      fetchNews(newConfig).then((articles) => {
        if (articles) setArticles(articles);
      }).catch(() => {});
    }

    // Re-fetch tibber data with new config
    if (newConfig.energyProvider === 'tibber') {
      if (newConfig.tibber1?.apiEndpoint?.apiKey) {
        fetchTibberPrices(newConfig).then((data) => {
          if (data) setTibber(data);
        }).catch((err) => console.warn('Tibber prices fetch error:', err));
      }
      fetchTibberDevices(newConfig).then((data) => {
        if (data) setTibber2(data);
      }).catch((err) => console.warn('Tibber devices fetch error:', err));
    }
  };

  const tabProps = {
    form,
    updateField,
    lang,
    Section,
    Field,
    Row,
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab {...tabProps} owmKey={form.owmKey} />;
      case 'weather':
        return <WeatherTab {...tabProps} />;
      case 'energy':
        return <EnergyTab {...tabProps} />;
      case 'news':
        return <NewsTab {...tabProps} />;
      case 'stocks':
        return <StocksTab {...tabProps} />;
      case 'calendar':
        return <CalendarTab {...tabProps} />;
      case 'music':
        return <MusicTab {...tabProps} />;
      case 'smartDevices':
        return <SmartDevicesTab {...tabProps} />;
      case 'share':
        return <ShareTab {...tabProps} />;
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={saveSettings}>
      <Pressable style={styles.overlay} onPress={saveSettings}>
        <Animated.View style={[styles.modal, {transform: [{scale}]}]}>
          <Pressable style={styles.modalInner} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {translate('settings', lang)}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => DevSettings.reload()} style={styles.reloadBtn}>
                <Icon name="refresh" size={24} color="#cccccc" />
              </TouchableOpacity>
              <TouchableOpacity onPress={saveSettings}>
                <Icon name="close" size={24} color="#cccccc" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tab Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabBar}
            contentContainerStyle={styles.tabBarContent}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  activeTab === tab.key && styles.tabActive,
                ]}
                onPress={() => setActiveTab(tab.key)}>
                <Icon name={tab.icon} size={18} color={activeTab === tab.key ? '#cccccc' : '#888'} style={styles.tabIcon} />
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === tab.key && styles.tabLabelActive,
                  ]}>
                  {translate(tab.key, lang)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tab Content */}
          {activeTab === 'music' ? (
            <View style={styles.body}>
              {renderTab()}
            </View>
          ) : (
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {renderTab()}
            </ScrollView>
          )}

          </Pressable>
        </Animated.View>
      </Pressable>

    </Modal>
  );
};

export const Section = ({title, children, style}) => (
  <View style={[styles.section, style]}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

export const Row = ({children}) => <View style={styles.row}>{children}</View>;

export const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  half,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
}) => (
  <View style={[styles.field, half && styles.halfField]}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <View style={styles.inputWrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ''}
        placeholderTextColor="#666"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      {value ? (
        <TouchableOpacity
          style={styles.clearBtn}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          onPress={() => onChangeText('')}>
          <Icon name="close-circle" size={16} color="#555" />
        </TouchableOpacity>
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    height: '90%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
  },
  modalInner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  reloadBtn: {},
  closeBtn: {
    color: '#cccccc',
    fontSize: 16,
  },
  tabBar: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tabBarContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#cccccc',
  },
  tabIcon: {
    marginRight: 4,
  },
  tabLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#cccccc',
  },
  body: {
    flex: 1,
    padding: 16,
  },
  bodyContent: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#cccccc',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  field: {
    marginBottom: 10,
  },
  halfField: {
    flex: 1,
  },
  label: {
    color: '#aaaaaa',
    fontSize: 12,
    marginBottom: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
  },
  clearBtn: {
    paddingHorizontal: 8,
  },
});

export default SettingsModal;
