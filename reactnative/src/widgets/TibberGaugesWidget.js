import React, {useState, useCallback} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import useStore from '../store';
import GaugeCircle from '../components/GaugeCircle';
import {energyColor, solarColor, staleColor} from '../utils/colors';
import {formatEnergyPrice, formatEnergyDate} from '../utils/formatting';
import {translate} from '../utils/translations';
import {fs, sp} from '../utils/scale';

const TibberGaugesWidget = () => {
  const tibber = useStore((s) => s.tibber);
  const tibber2 = useStore((s) => s.tibber2);
  const priceStale = useStore((s) => (s.stale.tibber || 0) > 0);
  const devicesStale = useStore((s) => (s.stale.tibber2 || 0) > 0);
  const config = useStore((s) => s.config);
  const lang = config.language || 'en';

  // Size the gauge to the tile: label (~26) + GaugeCircle's own +20 overhead
  const [gaugeSize, setGaugeSize] = useState(0);
  const onCardLayout = useCallback((e) => {
    const {height} = e.nativeEvent.layout;
    setGaugeSize(Math.max(70, Math.round((height - sp(24)) * 0.9)));
  }, []);

  const priceInfo =
    tibber && tibber.currentSubscription
      ? tibber.currentSubscription.priceInfo
      : null;
  const current = priceInfo ? priceInfo.current : null;

  return (
    <>
      {/* Price Gauge */}
      {current && config.showEnergyPrice !== false ? (
        <View style={styles.card} onLayout={onCardLayout}>
          <Text style={styles.label}>{translate('price', lang)}</Text>
          {gaugeSize > 0 ? (
            <GaugeCircle
              value={Math.min(current.total, 1)}
              valueText={formatEnergyPrice(current.total)}
              valueTextColor={priceStale ? staleColor : energyColor(current.level)}
              borderColor={priceStale ? staleColor : energyColor(current.level)}
              size={gaugeSize}
              subText={formatEnergyDate(current.startsAt)}
            />
          ) : null}
        </View>
      ) : null}

      {/* Solar Gauge */}
      {tibber2 && tibber2.inverter ? (
        <View style={styles.card}>
          <Text style={styles.label}>{translate('production', lang)}</Text>
          <GaugeCircle
            value={parseFloat(tibber2.inverter.bubble.percent / 100)}
            valueText={tibber2.inverter.bubble.value + ' W'}
            valueTextColor={devicesStale ? staleColor : solarColor(tibber2.inverter.bubble.percent)}
            borderColor={devicesStale ? staleColor : solarColor(tibber2.inverter.bubble.percent)}
            size={gaugeSize > 0 ? gaugeSize : sp(120)}
            labelText={
              tibber2.inverterProduction
                ? parseFloat(
                    tibber2.inverterProduction.keyFigures[0].valueText,
                  ).toFixed(1) +
                  ' ' +
                  tibber2.inverterProduction.keyFigures[0].unitText +
                  ' ' +
                  translate('today', lang)
                : ''
            }
          />
        </View>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 2,
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

export default TibberGaugesWidget;
