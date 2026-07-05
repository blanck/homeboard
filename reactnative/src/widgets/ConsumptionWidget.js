import React, {useState, useCallback} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import useStore from '../store';
import GaugeCircle from '../components/GaugeCircle';
import {powerColor} from '../utils/colors';
import {formatPowerText, formatPowerValue} from '../utils/formatting';
import {translate} from '../utils/translations';
import {fs, sp} from '../utils/scale';

const ConsumptionWidget = () => {
  const tibberFeed = useStore((s) => s.tibberFeed);
  const config = useStore((s) => s.config);
  const lang = config.language || 'en';

  // Same measured sizing as the price gauge so both circles match
  const [gaugeSize, setGaugeSize] = useState(0);
  const onLayout = useCallback((e) => {
    const {height} = e.nativeEvent.layout;
    setGaugeSize(Math.max(70, Math.round((height - sp(24)) * 0.9)));
  }, []);

  if (!tibberFeed || !tibberFeed.power) {
    return null;
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Text style={styles.label}>{translate('consumption', lang)}</Text>
      {gaugeSize > 0 ? (
        <GaugeCircle
          value={formatPowerValue(
            tibberFeed.power,
            tibberFeed.maxPower,
            tibberFeed.powerProduction,
          )}
          valueText={formatPowerText(tibberFeed.power, tibberFeed.powerProduction)}
          valueTextColor={powerColor(tibberFeed.power, tibberFeed.maxPower)}
          borderColor={powerColor(tibberFeed.power, tibberFeed.maxPower)}
          size={gaugeSize}
          subText={
            parseFloat(tibberFeed.accumulatedConsumption).toFixed(1) +
            ' kWh ' +
            translate('today', lang)
          }
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  label: {
    color: '#ffffff',
    fontSize: fs(11),
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
});

export default ConsumptionWidget;
