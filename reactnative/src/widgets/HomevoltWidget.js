import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {fs} from '../utils/scale';

const formatEnergy = (wh) => {
  if (wh >= 1000) return (wh / 1000).toFixed(1) + ' kWh';
  return Math.round(wh) + ' Wh';
};

const formatPower = (w) => {
  const abs = Math.abs(w);
  if (abs >= 1000) return (abs / 1000).toFixed(1) + ' kW';
  return Math.round(abs) + ' W';
};

const HomevoltWidget = () => {
  const tibber2 = useStore((s) => s.tibber2);

  if (!tibber2 || !tibber2.battery) {
    return null;
  }

  const battery = tibber2.battery;
  const soc = battery.stateOfCharge ?? 0;
  const today = battery.aggregatedHistory?.periods?.find(p => p.key === 'TODAY');
  const charged = today?.items?.[0];
  const discharged = today?.items?.[1];
  const mode = battery.currentOperationMode?.value || '';

  // Battery icon based on SoC
  const batteryIcon = soc > 80 ? 'battery-high' :
    soc > 40 ? 'battery-medium' :
    soc > 10 ? 'battery-low' : 'battery-outline';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{battery.name || 'Homevolt'}</Text>
      <View style={styles.socRow}>
        <Icon
          name={mode === 'charging' ? 'battery-charging' : batteryIcon}
          size={28}
          color={!battery.isAlive ? '#888' : soc > 20 ? '#3fcf40' : '#ff4444'}
        />
        <Text style={styles.socText}>{soc}%</Text>
      </View>
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            {width: `${Math.min(soc, 100)}%`},
            soc > 20 ? styles.barGreen : styles.barRed,
          ]}
        />
      </View>
      {battery.batteryPower != null && battery.batteryPower !== 0 ? (
        <Text style={styles.power}>
          {battery.batteryPower > 0 ? '▼ ' : '▲ '}{formatPower(battery.batteryPower)}
        </Text>
      ) : null}
      {charged && charged.energy > 0 ? (
        <Text style={styles.stat}>▼ {formatEnergy(charged.energy)}</Text>
      ) : null}
      {discharged && discharged.energy > 0 ? (
        <Text style={styles.stat}>▲ {formatEnergy(discharged.energy)}</Text>
      ) : null}
      {!battery.isAlive ? (
        <Text style={styles.offline}>OFFLINE</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  label: {
    color: '#ffffff',
    fontSize: fs(11),
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  socRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  socText: {
    color: '#ffffff',
    fontSize: fs(20),
    fontWeight: 'bold',
  },
  barBg: {
    width: '80%',
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barGreen: {
    backgroundColor: '#3fcf40',
  },
  barRed: {
    backgroundColor: '#ff4444',
  },
  power: {
    color: '#cccccc',
    fontSize: fs(10),
    marginTop: 2,
  },
  stat: {
    color: '#999999',
    fontSize: fs(9),
    marginTop: 1,
  },
  offline: {
    fontSize: fs(8),
    color: '#f83e30',
    marginTop: 2,
  },
});

export default HomevoltWidget;
