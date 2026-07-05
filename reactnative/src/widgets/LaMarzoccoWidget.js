import React, {useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ActivityIndicator} from 'react-native';
import useStore from '../store';
import CoffeeMachineIcon from '../components/CoffeeMachineIcon';
import {toggleLaMarzoccoMode} from '../services/lamarzoccoService';
import {fs} from '../utils/scale';

const statusColor = (status) => {
  switch (status) {
    case 'PoweredOn':
    case 'Brewing':
      return '#3fcf40';
    case 'StandBy':
      return '#f0a030';
    default:
      return '#888';
  }
};

const statusLabel = (status) => {
  switch (status) {
    case 'PoweredOn':
      return 'On';
    case 'Brewing':
      return 'Brewing';
    case 'StandBy':
      return 'Standby';
    default:
      return 'Off';
  }
};

const LaMarzoccoWidget = () => {
  const lamarzocco = useStore((s) => s.lamarzocco);
  const config = useStore((s) => s.config);
  const setLaMarzocco = useStore((s) => s.setLaMarzocco);
  const [toggling, setToggling] = useState(false);

  if (!lamarzocco) return null;

  const serialNumber = config.smartDevices?.lamarzocco?.serialNumber;
  const isOn = lamarzocco.status === 'PoweredOn' || lamarzocco.status === 'Brewing';
  const boilerTemp = lamarzocco.coffeeBoiler?.temperature;

  const handleToggle = async () => {
    if (toggling || !serialNumber) return;
    setToggling(true);
    const newMode = isOn ? 'StandBy' : 'BrewingMode';
    const ok = await toggleLaMarzoccoMode(serialNumber, newMode);
    if (ok) {
      setLaMarzocco({
        ...lamarzocco,
        status: isOn ? 'StandBy' : 'PoweredOn',
      });
    }
    setToggling(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {config.smartDevices?.lamarzocco?.machineName || 'La Marzocco'}
      </Text>
      <View style={styles.icon}>
        <CoffeeMachineIcon size={36} color={statusColor(lamarzocco.status)} />
      </View>
      {boilerTemp ? (
        <Text style={styles.temp}>{boilerTemp}°C</Text>
      ) : null}
      <Text style={[styles.status, {color: statusColor(lamarzocco.status)}]}>
        {statusLabel(lamarzocco.status)}
      </Text>
      {lamarzocco.coffeeBoiler && lamarzocco.coffeeBoiler.status === 'HeatingUp' ? (
        <Text style={styles.boilerStatus}>◐ Heating</Text>
      ) : null}
      <TouchableOpacity
        style={[styles.toggleBtn, isOn && styles.toggleBtnOn]}
        onPress={handleToggle}
        disabled={toggling}>
        {toggling ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.toggleText}>{isOn ? 'Standby' : 'Turn On'}</Text>
        )}
      </TouchableOpacity>
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
    marginBottom: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  icon: {
    marginBottom: 8,
  },
  temp: {
    color: '#ffffff',
    fontSize: fs(16),
    fontWeight: 'bold',
    marginBottom: 2,
  },
  status: {
    fontSize: fs(9),
    marginTop: 4,
  },
  boilerStatus: {
    color: '#888',
    fontSize: fs(8),
    marginTop: 3,
  },
  toggleBtn: {
    marginTop: 12,
    backgroundColor: '#3a3a3a',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  toggleBtnOn: {
    backgroundColor: '#2a5a2a',
  },
  toggleText: {
    color: '#ffffff',
    fontSize: fs(9),
    fontWeight: '600',
  },
});

export default LaMarzoccoWidget;
