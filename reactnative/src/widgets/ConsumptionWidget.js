import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import useStore from '../store';
import GaugeCircle from '../components/GaugeCircle';
import {powerColor} from '../utils/colors';
import {formatPowerText, formatPowerValue} from '../utils/formatting';
import {translate} from '../utils/translations';
import {fs} from '../utils/scale';

const ConsumptionWidget = () => {
  const tibberFeed = useStore((s) => s.tibberFeed);
  const config = useStore((s) => s.config);
  const lang = config.language || 'en';

  if (!tibberFeed || !tibberFeed.power) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{translate('consumption', lang)}</Text>
      <GaugeCircle
        value={formatPowerValue(
          tibberFeed.power,
          tibberFeed.maxPower,
          tibberFeed.powerProduction,
        )}
        valueText={formatPowerText(tibberFeed.power, tibberFeed.powerProduction)}
        valueTextColor={powerColor(tibberFeed.power, tibberFeed.maxPower)}
        borderColor={powerColor(tibberFeed.power, tibberFeed.maxPower)}
        size={120}
        subText={
          parseFloat(tibberFeed.accumulatedConsumption).toFixed(1) +
          ' kWh ' +
          translate('today', lang)
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: fs(12),
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
});

export default ConsumptionWidget;
