import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import useStore from '../store';
import {setThermostat} from '../services/tibberService';
import {fs} from '../utils/scale';

const ThermostatWidget = () => {
  const tibber2 = useStore((s) => s.tibber2);
  const config = useStore((s) => s.config);
  const setTibber2 = useStore((s) => s.setTibber2);

  if (!tibber2 || !tibber2.thermostat) {
    return null;
  }

  const thermo = tibber2.thermostat;
  const comfortTemp = thermo.state.comfortTemperature;
  const currentTemp = thermo.temperatureSensor.measurement.value;

  const handleSetThermo = (change) => {
    const newTemp = comfortTemp + change;
    // Optimistic update
    setTibber2({
      ...tibber2,
      thermostat: {
        ...thermo,
        state: {...thermo.state, comfortTemperature: newTemp},
      },
    });
    setThermostat(config, newTemp);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => handleSetThermo(0.5)} style={styles.arrow}>
        <Text style={styles.arrowText}>▲</Text>
      </TouchableOpacity>
      <Text style={styles.temp}> {comfortTemp}°</Text>
      <Text style={styles.current}>{currentTemp}°</Text>
      <TouchableOpacity onPress={() => handleSetThermo(-0.5)} style={styles.arrow}>
        <Text style={styles.arrowText}>▼</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    padding: 4,
  },
  arrowText: {
    fontSize: fs(36),
    color: '#ffffff',
  },
  temp: {
    fontSize: fs(42),
    fontWeight: 'bold',
    color: '#ffffff',
    lineHeight: fs(46),
  },
  current: {
    fontSize: fs(18),
    color: '#666666',
    fontWeight: '400',
  },
});

export default ThermostatWidget;
