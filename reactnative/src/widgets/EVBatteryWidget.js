import React from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import useStore from '../store';
import {fs} from '../utils/scale';

const EVBatteryWidget = ({compact = false}) => {
  const tibber2 = useStore((s) => s.tibber2);

  if (
    !tibber2 ||
    !tibber2.electricVehicles ||
    tibber2.electricVehicles.length === 0
  ) {
    return null;
  }

  return (
    <View style={styles.container}>
      {tibber2.electricVehicles.map((vehicle, idx) => (
        <View key={idx} style={[styles.vehicle, !vehicle.isAlive && styles.offline]}>
          {!compact && vehicle.imgUrl ? (
            <Image
              source={{uri: vehicle.imgUrl}}
              style={styles.image}
              resizeMode="contain"
            />
          ) : null}
          <Text style={[styles.name, !vehicle.isAlive && styles.dimText]} numberOfLines={1}>
            {vehicle.batteryText?.split(' ').slice(0, -1).join(' ') || 'EV'}
          </Text>
          <Text style={[styles.percent, !vehicle.isAlive && styles.dimText]}>
            {vehicle.battery?.percent ?? 0}%
          </Text>
          <View style={styles.barBg}>
            <View
              style={[
                styles.barFill,
                {width: `${Math.min(vehicle.battery?.percent ?? 0, 100)}%`},
                !vehicle.isAlive ? styles.barDim :
                  vehicle.battery?.percent > 20 ? styles.barGreen : styles.barRed,
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 12,
  },
  vehicle: {
    alignItems: 'center',
  },
  image: {
    width: 100,
    height: 50,
    marginBottom: 4,
  },
  name: {
    fontSize: fs(11),
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  percent: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  barBg: {
    width: '80%',
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
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
  barDim: {
    backgroundColor: '#555',
  },
  offline: {
    opacity: 0.5,
  },
  dimText: {
    color: '#666666',
  },
});

export default EVBatteryWidget;
