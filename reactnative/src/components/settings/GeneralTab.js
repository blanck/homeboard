import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Alert,
  FlatList,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {translate} from '../../utils/translations';
import DropdownPicker from './DropdownPicker';

const TIMEZONES = [
  'Europe/Stockholm',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

const HOURS = Array.from({length: 24}, (_, i) => ({
  label: String(i).padStart(2, '0') + ':00',
  value: String(i),
}));

// Kiosk-only system controls, backed by /system/* on the web server
const systemAction = (action, confirmMsg) => {
  if (confirmMsg && !window.confirm(confirmMsg)) return;
  fetch(`/system/${action}`, {method: 'POST'}).catch(() => {});
};

const GeneralTab = ({form, updateField, lang, owmKey, Section, Field, Row}) => {
  const [searchQuery, setSearchQuery] = useState(form.locationName || '');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Parse autosleep "22-07" format
  const sleepParts = (form.autosleep || '22-07').split('-');
  const sleepStart = sleepParts[0] || '22';
  const sleepEnd = sleepParts[1] || '7';

  const updateSleep = (which, val) => {
    if (which === 'start') {
      updateField('autosleep', `${val}-${sleepEnd}`);
    } else {
      updateField('autosleep', `${sleepStart}-${val}`);
    }
  };

  const requestLocation = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission denied', 'Location permission is required');
          return;
        }
      }
      Geolocation.getCurrentPosition(
        (pos) => {
          updateField('lat', String(pos.coords.latitude));
          updateField('lng', String(pos.coords.longitude));
        },
        (err) => Alert.alert('Location Error', err.message),
        {enableHighAccuracy: true, timeout: 15000},
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const searchAddress = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&addressdetails=1`;
      const resp = await fetch(url, {
        headers: {'User-Agent': 'HomeboardApp/1.0'},
      });
      const data = await resp.json();
      if (!resp.ok) {
        Alert.alert('API Error', `HTTP ${resp.status}`);
        setSearchResults([]);
      } else if (Array.isArray(data)) {
        setSearchResults(data);
        if (data.length === 0) {
          Alert.alert('No results', `No locations found for "${searchQuery}"`);
        }
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to search: ' + err.message);
    }
    setSearching(false);
  };

  const localTzOptions = [
    {label: translate('deviceDefault', lang), value: ''},
    ...TIMEZONES.map(tz => ({label: tz, value: tz})),
  ];

  const remoteTzOptions = [
    {label: translate('hidden', lang), value: ''},
    ...TIMEZONES.map(tz => ({label: tz, value: tz})),
  ];

  const languageOptions = [
    {label: 'English', value: 'en'},
    {label: 'Svenska', value: 'sv'},
  ];

  return (
    <View>
      <Row>
        <View style={styles.col}>
          <DropdownPicker
            label={translate('language', lang)}
            value={form.language}
            options={languageOptions}
            onValueChange={(v) => updateField('language', v)}
          />
        </View>
        <View style={styles.col}>
          <DropdownPicker
            label={translate('localTimezone', lang)}
            value={form.localzone}
            options={localTzOptions}
            onValueChange={(v) => updateField('localzone', v)}
          />
        </View>
        <View style={styles.col}>
          <DropdownPicker
            label={translate('remoteTimezone', lang)}
            value={form.remotezone}
            options={remoteTzOptions}
            onValueChange={(v) => updateField('remotezone', v)}
          />
        </View>
      </Row>

      <Section title={translate('location', lang)}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={translate('searchAddress', lang)}
            placeholderTextColor="#666"
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={searchAddress}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={searchAddress}>
            <Text style={styles.searchBtnText}>
              {searching ? '...' : translate('search', lang)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.locBtn} onPress={requestLocation}>
            <Text style={styles.searchBtnText}>📍</Text>
          </TouchableOpacity>
        </View>

        {searchResults.length > 0 && (
          <View style={styles.resultsList}>
            {searchResults.map((r, i) => (
              <TouchableOpacity
                key={i}
                style={styles.resultItem}
                onPress={() => {
                  updateField('lat', String(r.lat));
                  updateField('lng', String(r.lon));
                  setSearchResults([]);
                  const short = r.address
                    ? [r.address.city || r.address.town || r.address.village, r.address.country].filter(Boolean).join(', ')
                    : r.display_name.split(',').slice(0, 2).join(',').trim();
                  setSearchQuery(short);
                  updateField('locationName', short);
                }}>
                <Text style={styles.resultText} numberOfLines={2}>
                  {r.display_name}
                </Text>
                <Text style={styles.resultCoords}>
                  {parseFloat(r.lat).toFixed(4)}, {parseFloat(r.lon).toFixed(4)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Row>
          <Field
            label={translate('latitude', lang)}
            value={form.lat}
            onChangeText={(v) => updateField('lat', v)}
            half
            keyboardType="numeric"
          />
          <Field
            label={translate('longitude', lang)}
            value={form.lng}
            onChangeText={(v) => updateField('lng', v)}
            half
            keyboardType="numeric"
          />
        </Row>
      </Section>

      <View style={styles.sleepRow}>
        <Switch
          value={form.keepAwake}
          onValueChange={(v) => updateField('keepAwake', v)}
          trackColor={{false: '#333', true: '#1B4781'}}
          thumbColor="#ffffff"
        />
        <Text style={styles.sleepLabel}>{translate('keepAwake', lang)}</Text>
        <View style={styles.sleepDropdown}>
          <DropdownPicker
            label={translate('startHour', lang)}
            value={sleepEnd}
            options={HOURS}
            onValueChange={(v) => updateSleep('end', v)}
          />
        </View>
        <View style={styles.sleepDropdown}>
          <DropdownPicker
            label={translate('endHour', lang)}
            value={sleepStart}
            options={HOURS}
            onValueChange={(v) => updateSleep('start', v)}
          />
        </View>
        {Platform.OS === 'web' ? (
          <TouchableOpacity
            style={[styles.systemBtn, styles.sleepBtnSpacing]}
            onPress={() => systemAction('sleep')}>
            <Text style={styles.systemBtnText}>{translate('sleepScreen', lang)}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Section title={translate('background', lang)}>
        <Field
          label={translate('backgroundDay', lang)}
          value={form.backgroundDayUrl}
          onChangeText={(v) => updateField('backgroundDayUrl', v)}
          placeholder={translate('backgroundHint', lang)}
        />
        <Field
          label={translate('backgroundEvening', lang)}
          value={form.backgroundEveningUrl}
          onChangeText={(v) => updateField('backgroundEveningUrl', v)}
          placeholder={translate('backgroundHint', lang)}
        />
      </Section>

      {Platform.OS === 'web' ? (
        <Section title={translate('system', lang)}>
          <View style={styles.systemRow}>
            <TouchableOpacity
              style={styles.systemBtn}
              onPress={() =>
                systemAction('restart', translate('confirmRestartServer', lang))
              }>
              <Text style={styles.systemBtnText}>
                {translate('restartServer', lang)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.systemBtn, styles.systemBtnDanger]}
              onPress={() =>
                systemAction('reboot', translate('confirmReboot', lang))
              }>
              <Text style={styles.systemBtnText}>
                {translate('rebootDevice', lang)}
              </Text>
            </TouchableOpacity>
          </View>
        </Section>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  col: {
    flex: 1,
  },
  systemRow: {
    flexDirection: 'row',
    gap: 10,
  },
  systemBtn: {
    backgroundColor: '#3a3a3a',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  sleepBtnSpacing: {
    marginLeft: 10,
  },
  systemBtnDanger: {
    backgroundColor: '#5a2a2a',
  },
  systemBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  locBtn: {
    backgroundColor: '#1B4781',
    borderRadius: 6,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchBtn: {
    backgroundColor: '#555555',
    borderRadius: 6,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsList: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#444',
  },
  resultText: {
    color: '#ffffff',
    fontSize: 14,
  },
  resultCoords: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  sleepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  sleepLabel: {
    color: '#aaaaaa',
    fontSize: 14,
    marginRight: 12,
  },
  sleepDropdown: {
    width: 100,
  },
});

export default GeneralTab;
