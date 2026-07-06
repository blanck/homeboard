import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, Linking, TouchableOpacity, ActivityIndicator, Switch} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {translate} from '../../utils/translations';
import {fetchTibberHomes} from '../../services/tibberService';
import {fetchDataApiDevices} from '../../services/tibberService';
import {startOAuthFlow, isDataApiConnected, clearTokens} from '../../services/tibberOAuthService';
import {openOAuthUrl} from '../../utils/oauthPopup';
import useStore from '../../store';
import DropdownPicker from './DropdownPicker';

const deviceIcon = (type) => {
  switch (type) {
    case 'thermostat': return 'thermostat';
    case 'inverter': return 'solar-power';
    case 'pulse': return 'flash';
    case 'homevolt': return 'battery-charging';
    case 'ev': return 'car-electric';
    default: return 'devices';
  }
};

const PROVIDERS = [
  {label: 'Disabled', value: 'disabled'},
  {label: 'Tibber', value: 'tibber'},
];

const EnergyTab = ({form, updateField, lang, Section, Field}) => {
  const [loadingHomes, setLoadingHomes] = useState(false);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [connected, setConnected] = useState(false);
  const tibberDataApiConnected = useStore((s) => s.tibberDataApiConnected);
  const cachedHomes = form.tibberHomes || [];
  const isTibber = form.energyProvider === 'tibber';
  const discoveredDevices = form.tibberDevices || [];

  // Check connection status on mount and when store changes
  useEffect(() => {
    isDataApiConnected().then(setConnected);
  }, [tibberDataApiConnected]);

  const loadHomes = async (apiKey) => {
    if (!apiKey) return;
    setLoadingHomes(true);
    try {
      const result = await fetchTibberHomes(apiKey);
      updateField('tibberHomes', result);
      if (result.length === 1 && !form.tibberHomeId) {
        updateField('tibberHomeId', result[0].id);
      }
    } catch {
      updateField('tibberHomes', []);
    }
    setLoadingHomes(false);
  };

  const handleConnect = async () => {
    try {
      const url = await startOAuthFlow();
      await openOAuthUrl(url);
    } catch (err) {
      console.warn('OAuth start error:', err);
    }
  };

  const handleDisconnect = async () => {
    await clearTokens();
    setConnected(false);
    updateField('tibberDevices', []);
  };

  const [discoverError, setDiscoverError] = useState('');

  const runDiscovery = async () => {
    if (!form.tibberHomeId) return;
    setLoadingDiscover(true);
    setDiscoverError('');
    try {
      const apiDevices = await fetchDataApiDevices(form.tibberHomeId);
      // Add V1 infrastructure devices (Pulse uses V1 WebSocket, not Data API)
      const staticDevices = [
        {deviceId: 'pulse', type: 'pulse', label: 'Tibber Pulse'},
      ];
      // Merge: static devices first, then discovered devices (EVs etc)
      const allDevices = [...staticDevices, ...apiDevices];
      updateField('tibberDevices', allDevices);
      if (apiDevices.length === 0) {
        setDiscoverError(translate('noDevicesFound', lang));
      }
    } catch (err) {
      console.warn('Discovery error:', err);
      updateField('tibberDevices', []);
      setDiscoverError(translate('discoveryFailed', lang));
    }
    setLoadingDiscover(false);
  };

  const isDeviceEnabled = (device) => {
    // For EVs, check individual device ID in the list
    if (device.type === 'ev') {
      return (form.tibberEvDeviceIds || []).includes(device.deviceId);
    }
    const key = 'tibberDevice_' + device.type;
    if (form[key] !== undefined) return form[key];
    if (device.type === 'thermostat') return !!form.tibberThermostat;
    if (device.type === 'inverter') return !!form.tibberInverter;
    if (device.type === 'pulse') return !!form.tibberPulse;
    if (device.type === 'homevolt') return !!form.tibberHomevolt;
    return false;
  };

  const toggleDevice = (device) => {
    if (device.type === 'ev') {
      const ids = form.tibberEvDeviceIds || [];
      const isOn = ids.includes(device.deviceId);
      const newIds = isOn
        ? ids.filter((id) => id !== device.deviceId)
        : [...ids, device.deviceId];
      updateField('tibberEvDeviceIds', newIds);
      updateField('tibberEv', newIds.length > 0);
      return;
    }

    const enabled = !isDeviceEnabled(device);
    updateField('tibberDevice_' + device.type, enabled);
    if (enabled) {
      if (device.type === 'thermostat') updateField('tibberThermostat', device.deviceId);
      if (device.type === 'inverter') {
        updateField('tibberInverter', device.deviceId);
        updateField('tibberProduction', device.deviceId);
      }
      if (device.type === 'pulse') updateField('tibberPulse', device.deviceId);
      if (device.type === 'homevolt') updateField('tibberHomevolt', device.deviceId);
    } else {
      if (device.type === 'thermostat') updateField('tibberThermostat', '');
      if (device.type === 'inverter') {
        updateField('tibberInverter', '');
        updateField('tibberProduction', '');
      }
      if (device.type === 'pulse') updateField('tibberPulse', '');
      if (device.type === 'homevolt') updateField('tibberHomevolt', '');
    }
  };

  const homeOptions = cachedHomes.map((h) => ({label: h.label, value: h.id}));

  return (
    <View>
      <Section title={translate('energy', lang)}>
        <DropdownPicker
          label={translate('provider', lang)}
          value={form.energyProvider}
          options={PROVIDERS}
          onValueChange={(v) => updateField('energyProvider', v)}
        />
      </Section>

      {isTibber ? (
        <View style={styles.columns}>
          <View style={styles.col}>
            <Section title="Tibber">
              <Field
                label={translate('tibberApiKey', lang)}
                value={form.tibberApiKey}
                onChangeText={(v) => updateField('tibberApiKey', v)}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={() => loadHomes(form.tibberApiKey)}
              />
              <View style={styles.keyRow}>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://developer.tibber.com/settings/accesstoken')}>
                  <Text style={styles.link}>{translate('tibberApiKeyHint', lang)}</Text>
                </TouchableOpacity>
                {form.tibberApiKey ? (
                  <TouchableOpacity
                    style={styles.fetchBtn}
                    onPress={() => loadHomes(form.tibberApiKey)}>
                    {loadingHomes ? (
                      <ActivityIndicator size="small" color="#cccccc" />
                    ) : (
                      <>
                        <Icon name="refresh" size={14} color="#cccccc" />
                        <Text style={styles.fetchText}>{translate('fetchHomes', lang)}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>

              <DropdownPicker
                label={translate('homeId', lang)}
                value={form.tibberHomeId}
                options={homeOptions}
                onValueChange={(v) => updateField('tibberHomeId', v)}
                placeholder={homeOptions.length > 0 ? translate('selectHome', lang) : translate('fetchHomes', lang)}
                disabled={homeOptions.length === 0}
              />
              <View style={styles.toggleList}>
                <View style={styles.deviceRow}>
                  <Icon name="lightning-bolt" size={18} color="#cccccc" />
                  <Text style={styles.deviceLabel}>{translate('showEnergyPrice', lang)}</Text>
                  <Switch
                    value={form.showEnergyPrice !== false}
                    onValueChange={(v) => updateField('showEnergyPrice', v)}
                    trackColor={{false: '#333', true: '#1B4781'}}
                    thumbColor="#ffffff"
                  />
                </View>
                <View style={styles.deviceRow}>
                  <Icon name="chart-line" size={18} color="#cccccc" />
                  <Text style={styles.deviceLabel}>{translate('showEnergyChart', lang)}</Text>
                  <Switch
                    value={form.showEnergyChart !== false}
                    onValueChange={(v) => updateField('showEnergyChart', v)}
                    trackColor={{false: '#333', true: '#1B4781'}}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            </Section>
          </View>

          <View style={styles.col}>
            <Section title={translate('tibberDevices', lang)}>
              {connected ? (
                <>
                  <View style={styles.connectedRow}>
                    <Icon name="check-circle" size={16} color="#3fcf40" />
                    <Text style={styles.connectedText}>{translate('connected', lang)}</Text>
                    <TouchableOpacity onPress={handleDisconnect}>
                      <Text style={styles.disconnectText}>{translate('disconnect', lang)}</Text>
                    </TouchableOpacity>
                  </View>
                  {!form.tibberHomeId ? (
                    <Text style={styles.hint}>{translate('selectHomeFirst', lang)}</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.tokenBtn}
                      onPress={runDiscovery}>
                      {loadingDiscover ? (
                        <ActivityIndicator size="small" color="#cccccc" />
                      ) : (
                        <>
                          <Icon name="magnify" size={16} color="#cccccc" />
                          <Text style={styles.tokenBtnText}>{translate('discoverDevices', lang)}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  {discoverError ? (
                    <Text style={styles.errorText}>{discoverError}</Text>
                  ) : null}
                  {discoveredDevices.length > 0 ? (
                    <View style={styles.deviceList}>
                      {discoveredDevices.map((device) => (
                        <View key={device.deviceId} style={styles.deviceRow}>
                          <Icon name={deviceIcon(device.type)} size={18} color="#cccccc" />
                          <Text style={styles.deviceLabel}>{device.label}</Text>
                          <Switch
                            value={isDeviceEnabled(device)}
                            onValueChange={() => toggleDevice(device)}
                            trackColor={{false: '#333', true: '#1B4781'}}
                            thumbColor="#ffffff"
                          />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.hint}>{translate('tibberOAuthHint', lang)}</Text>
                  <TouchableOpacity style={styles.tokenBtn} onPress={handleConnect}>
                    <Icon name="link" size={16} color="#cccccc" />
                    <Text style={styles.tokenBtnText}>{translate('connectTibber', lang)}</Text>
                  </TouchableOpacity>
                </>
              )}
            </Section>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  columns: {
    flexDirection: 'row',
    gap: 8,
  },
  col: {
    flex: 1,
  },
  hint: {
    color: '#666',
    fontSize: 11,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  link: {
    color: '#cccccc',
    fontSize: 11,
    marginBottom: 8,
    fontStyle: 'italic',
    textDecorationLine: 'underline',
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fetchText: {
    color: '#cccccc',
    fontSize: 11,
  },
  tokenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1B4781',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tokenBtnText: {
    color: '#cccccc',
    fontSize: 14,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  connectedText: {
    color: '#3fcf40',
    fontSize: 13,
    flex: 1,
  },
  disconnectText: {
    color: '#ff6666',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleList: {
    marginTop: 8,
    gap: 4,
  },
  deviceList: {
    marginTop: 8,
    gap: 4,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  deviceLabel: {
    color: '#cccccc',
    fontSize: 14,
    flex: 1,
  },
  errorText: {
    color: '#ff6666',
    fontSize: 12,
    marginTop: 8,
  },
});

export default EnergyTab;
