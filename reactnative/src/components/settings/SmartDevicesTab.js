import React, {useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, Switch} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {translate} from '../../utils/translations';
import {loginLaMarzocco, clearLaMarzoccoAuth} from '../../services/lamarzoccoService';
import DropdownPicker from './DropdownPicker';

const DEVICE_TYPES = [
  {label: 'None', value: ''},
  {label: 'La Marzocco', value: 'lamarzocco'},
];

const SmartDevicesTab = ({form, updateField, lang, Section, Field}) => {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [machines, setMachines] = useState([]);

  const selectedDevice = form.smartDeviceType || '';
  const hasLM = selectedDevice === 'lamarzocco';
  const isConnected = hasLM && !!form.lmSerialNumber;

  const handleLogin = async () => {
    if (!email || !password) return false;
    setLoading(true);
    setError('');
    try {
      const result = await loginLaMarzocco(email, password);
      if (result && result.length > 0) {
        setMachines(result);
        if (result.length === 1) {
          updateField('lmSerialNumber', result[0].serialNumber);
          updateField('lmMachineName', result[0].name || result[0].model || 'La Marzocco');
        }
        setLoading(false);
        return true;
      } else {
        setError(translate('noDevicesFound', lang));
      }
    } catch (err) {
      setError(err.message || 'Login failed');
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
                updateField('lmSerialNumber', v);
                const m = machines.find((x) => x.serialNumber === v);
                if (m) updateField('lmMachineName', m.name || m.model);
              }}
            />
          )}
        </Section>
      )}

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
