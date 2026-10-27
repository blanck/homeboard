import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {translate} from '../utils/translations';
import {fs} from '../utils/scale';

const OK_COLOR = '#4fc3f7';
const ALERT_COLOR = '#ff6b6b';

const toNum = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// An unset threshold never alerts, so a half-configured range still works
const outOfRange = (value, min, max) => {
  if (value === null || value === undefined) return false;
  const lo = toNum(min);
  const hi = toNum(max);
  if (lo !== null && value < lo) return true;
  if (hi !== null && value > hi) return true;
  return false;
};

const PoolWidget = () => {
  const pool = useStore((s) => s.pool);
  const config = useStore((s) => s.config);

  if (!pool) return null;

  const lang = config.language;
  const settings = config.smartDevices?.pool || {};
  const phAlert = outOfRange(pool.ph, settings.phMin, settings.phMax);
  const tempAlert = outOfRange(pool.temperature, settings.tempMin, settings.tempMax);
  const alert = phAlert || tempAlert;

  return (
    <View style={[styles.container, alert && styles.containerAlert]}>
      <Text style={styles.label}>{translate('pool', lang)}</Text>
      <Icon name="pool" size={30} color={alert ? ALERT_COLOR : OK_COLOR} />
      {pool.temperature !== null ? (
        <Text style={[styles.temp, tempAlert && styles.alertText]}>
          {pool.temperature.toFixed(1)}°C
        </Text>
      ) : null}
      {pool.ph !== null ? (
        <Text style={[styles.ph, phAlert && styles.alertText]}>
          {translate('ph', lang)} {pool.ph.toFixed(2)}
        </Text>
      ) : null}
      {alert ? (
        <Text style={styles.alertLabel}>{translate('poolOutOfRange', lang)}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  containerAlert: {
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
  },
  label: {
    color: '#ffffff',
    fontSize: fs(11),
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  temp: {
    color: '#ffffff',
    fontSize: fs(16),
    fontWeight: 'bold',
    marginTop: 6,
  },
  ph: {
    color: '#cccccc',
    fontSize: fs(11),
    marginTop: 2,
  },
  alertText: {
    color: ALERT_COLOR,
  },
  alertLabel: {
    color: ALERT_COLOR,
    fontSize: fs(8),
    marginTop: 3,
    textAlign: 'center',
  },
});

export default PoolWidget;
