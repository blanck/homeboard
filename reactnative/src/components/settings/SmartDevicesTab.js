import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, Switch} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {translate} from '../../utils/translations';
import {loginLaMarzocco, clearLaMarzoccoAuth, fetchMachines} from '../../services/lamarzoccoService';
import DropdownPicker from './DropdownPicker';
import {canScanTuya, scanTuyaDevices, mergeTuyaDevices} from '../../services/tuyaService';

const DEVICE_TYPES = [
  {label: 'None', value: ''},
  {label: 'La Marzocco', value: 'lamarzocco'},
];

const SmartDevicesTab = ({form, updateField, onApply, lang, Section, Field, Row}) => {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [machines, setMachines] = useState([]);
  const [tuyaScanning, setTuyaScanning] = useState(false);
  const [tuyaError, setTuyaError] = useState('');

  const tuyaDevices = form.tuyaDevices || [];

  const updateTuyaDevice = (id, field, value) =>
    updateField(
      'tuyaDevices',
      (current = []) => (current || []).map((d) => (d.id === id ? {...d, [field]: value} : d)),
    );

  const handleTuyaScan = async () => {
    setTuyaError('');
    setTuyaScanning(true);
    try {
      const found = await scanTuyaDevices();
      updateField('tuyaDevices', (current = []) => mergeTuyaDevices(current || [], found));
      if (!found.length) setTuyaError(translate('tuyaNoDevices', lang));
    } catch (err) {
      setTuyaError(err.message);
    }
    setTuyaScanning(false);
  };

  const selectedDevice = form.smartDeviceType || '';
  const hasLM = selectedDevice === 'lamarzocco';
  const isConnected = hasLM && !!form.lmSerialNumber;

  const pickMachine = (m) => {
    const changes = {
      smartDeviceType: 'lamarzocco',
      lmSerialNumber: m.serialNumber,
      lmMachineName: m.name || m.model || 'La Marzocco',
      lmShowWidget: true,
    };
    Object.entries(changes).forEach(([k, v]) => updateField(k, v));
    // Save now: on a phone the Pi only sees it once saved
    onApply?.(changes);
  };

  // A login shared from another device lists the machines without logging in here
  useEffect(() => {
    if (!hasLM) return;
    let live = true;
    fetchMachines()
      .then((list) => {
        if (!live || !list?.length) return;
        setMachines(list);
        if (!form.lmSerialNumber) pickMachine(list[0]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLM]);

  const handleLogin = async () => {
    if (!email || !password) return false;
    setLoading(true);
    setError('');
    try {
      const result = await loginLaMarzocco(email, password);
      if (result && result.length > 0) {
        setMachines(result);
        // Pick a machine right away (changeable below): an unpicked one left the widget off
        pickMachine(result.find((m) => m.serialNumber === form.lmSerialNumber) || result[0]);
        setLoading(false);
        return true;
      } else {
        setError(translate('noDevicesFound', lang));
      }
    } catch (err) {
      setError(
        err.code === 'USER_MUST_ACCEPT_POLICY'
          ? translate('lmAcceptPolicy', lang)
          : err.message || 'Login failed',
      );
    }
    setLoading(false);
    return false;
  };

  const handleDisconnect = async () => {
    await clearLaMarzoccoAuth();
    updateField('lmSerialNumber', '');
    updateField('lmMachineName', '');
    setMachines([]);
  };

  return (
    <View>
      <Section title={translate('smartDevices', lang)}>
        <DropdownPicker
          label={translate('deviceType', lang)}
          value={selectedDevice}
          options={DEVICE_TYPES}
          onValueChange={(v) => updateField('smartDeviceType', v)}
        />
      </Section>

      {hasLM && (
        <Section title="La Marzocco">
          {isConnected ? (
            <View style={styles.deviceCard}>
              <View style={styles.deviceHeader}>
                <Icon name="coffee-maker" size={20} color={form.lmShowWidget !== false ? '#3fcf40' : '#666'} />
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>
                    {form.lmMachineName || 'La Marzocco'}
                  </Text>
                  <Text style={styles.deviceSerial}>{form.lmSerialNumber}</Text>
                </View>
                <Switch
                  value={form.lmShowWidget !== false}
                  onValueChange={(v) => updateField('lmShowWidget', v)}
                  trackColor={{false: '#444', true: '#3fcf40'}}
                  thumbColor="#fff"
                />
              </View>
              <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
                <Text style={styles.disconnectText}>{translate('disconnect', lang)}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.hint}>
                {translate('lmLoginHint', lang)}
              </Text>
              <TouchableOpacity style={styles.loginBtn} onPress={() => setShowLogin(true)}>
                <Icon name="login" size={16} color="#fff" style={styles.btnIcon} />
                <Text style={styles.loginText}>{translate('login', lang)}</Text>
              </TouchableOpacity>
            </View>
          )}

          {machines.length > 1 && (
            <DropdownPicker
              label={translate('selectMachine', lang)}
              value={form.lmSerialNumber}
              options={machines.map((m) => ({
                label: `${m.name || m.model} (${m.serialNumber})`,
                value: m.serialNumber,
              }))}
              onValueChange={(v) => {
                const m = machines.find((x) => x.serialNumber === v);
                if (m) pickMachine(m);
              }}
            />
          )}
        </Section>
      )}

      {canScanTuya() ? (
        <Section title={translate('tuya', lang)}>
          <Text style={styles.hint}>{translate('tuyaHint', lang)}</Text>
          <TouchableOpacity
            style={styles.loginBtn}
            disabled={tuyaScanning}
            onPress={handleTuyaScan}>
            <Icon name="lan-connect" size={16} color="#fff" style={styles.btnIcon} />
            <Text style={styles.loginText}>
              {tuyaScanning ? translate('scanning', lang) : translate('scanNetwork', lang)}
            </Text>
          </TouchableOpacity>
          {tuyaError ? <Text style={styles.error}>{tuyaError}</Text> : null}
          {tuyaDevices.map((device) => (
            <View key={device.id} style={styles.deviceCard}>
              <View style={styles.deviceHeader}>
                <Icon
                  name="lightbulb-outline"
                  size={20}
                  color={device.localKey ? '#3fcf40' : '#666'}
                />
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.name || device.id}</Text>
                  <Text style={styles.deviceSerial}>
                    {device.ip} · v{device.version}
                  </Text>
                </View>
              </View>
              <Field
                label={translate('deviceName', lang)}
                value={device.name}
                onChangeText={(v) => updateTuyaDevice(device.id, 'name', v)}
                placeholder={device.id}
              />
              <Field
                label={translate('localKey', lang)}
                value={device.localKey}
                onChangeText={(v) => updateTuyaDevice(device.id, 'localKey', v)}
                placeholder="................"
              />
            </View>
          ))}
        </Section>
      ) : null}

      <Section title={translate('pool', lang)}>
        <Field
          label={translate('poolHost', lang)}
          value={form.poolHost}
          onChangeText={(v) => updateField('poolHost', v)}
          placeholder="192.168.1.250"
        />
        <Text style={styles.hint}>{translate('poolHostHint', lang)}</Text>
        {form.poolHost ? (
          <>
            <View style={styles.deviceCard}>
              <View style={styles.deviceHeader}>
                <Icon
                  name="pool"
                  size={20}
                  color={form.poolShowWidget !== false ? '#4fc3f7' : '#666'}
                />
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{translate('pool', lang)}</Text>
                  <Text style={styles.deviceSerial}>{form.poolHost}</Text>
                </View>
                <Switch
                  value={form.poolShowWidget !== false}
                  onValueChange={(v) => updateField('poolShowWidget', v)}
                  trackColor={{false: '#444', true: '#3fcf40'}}
                  thumbColor="#fff"
                />
              </View>
            </View>
            <Text style={styles.thresholdTitle}>
              {translate('poolThresholds', lang)}
            </Text>
            <Row>
              <Field
                half
                label={translate('phMin', lang)}
                value={form.poolPhMin}
                onChangeText={(v) => updateField('poolPhMin', v)}
                placeholder="7.0"
                keyboardType="numeric"
              />
              <Field
                half
                label={translate('phMax', lang)}
                value={form.poolPhMax}
                onChangeText={(v) => updateField('poolPhMax', v)}
                placeholder="7.6"
                keyboardType="numeric"
              />
            </Row>
            <Row>
              <Field
                half
                label={translate('tempMin', lang)}
                value={form.poolTempMin}
                onChangeText={(v) => updateField('poolTempMin', v)}
                keyboardType="numeric"
              />
              <Field
                half
                label={translate('tempMax', lang)}
                value={form.poolTempMax}
                onChangeText={(v) => updateField('poolTempMax', v)}
                keyboardType="numeric"
              />
            </Row>
          </>
        ) : null}
      </Section>

      {/* Login Modal */}
      <Modal
        visible={showLogin}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
        navigationBarTranslucent={true}
        onRequestClose={() => setShowLogin(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>La Marzocco</Text>
            <Text style={styles.modalHint}>
              {translate('lmLoginHint', lang)}
            </Text>
            <Text style={styles.fieldLabel}>{translate('email', lang)}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor="#666"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
            <Text style={styles.fieldLabel}>{translate('password', lang)}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#666"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={async () => {
                const success = await handleLogin();
                if (success) setShowLogin(false);
              }}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowLogin(false);
                  setError('');
                }}>
                <Text style={styles.cancelText}>{translate('cancel', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.btnDisabled]}
                onPress={async () => {
                  const success = await handleLogin();
                  if (success) {
                    setShowLogin(false);
                  }
                }}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitText}>{translate('login', lang)}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  deviceCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    maxWidth: 320,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  deviceSerial: {
    color: '#666',
    fontSize: 11,
  },
  hint: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  thresholdTitle: {
    color: '#aaaaaa',
    fontSize: 12,
    marginTop: 12,
    marginBottom: 6,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  btnIcon: {
    marginRight: 6,
  },
  loginText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  disconnectText: {
    color: '#ff6666',
    fontSize: 13,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '75%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalHint: {
    color: '#888',
    fontSize: 12,
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 12,
  },
  error: {
    color: '#ff4444',
    fontSize: 12,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelText: {
    color: '#888',
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: '#333',
    borderRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

export default SmartDevicesTab;
