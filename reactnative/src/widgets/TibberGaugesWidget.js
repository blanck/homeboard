import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import useStore from '../store';
import GaugeCircle from '../components/GaugeCircle';
import {energyColor, solarColor} from '../utils/colors';
import {formatEnergyPrice, formatEnergyDate} from '../utils/formatting';
import {translate} from '../utils/translations';
import {fs} from '../utils/scale';

const TibberGaugesWidget = () => {
  const tibber = useStore((s) => s.tibber);
  const tibber2 = useStore((s) => s.tibber2);
  const config = useStore((s) => s.config);
  const lang = config.language || 'en';

  const priceInfo =
    tibber && tibber.currentSubscription
      ? tibber.currentSubscription.priceInfo
      : null;
  const current = priceInfo ? priceInfo.current : null;

  return (
    <>
      {/* Price Gauge */}
      {current && config.showEnergyPrice !== false ? (
        <View style={styles.card}>
          <Text style={styles.label}>{translate('price', lang)}</Text>
          <GaugeCircle
            value={Math.min(current.total, 1)}
            valueText={formatEnergyPrice(current.total)}
            valueTextColor={energyColor(current.level)}
            borderColor={energyColor(current.level)}
            size={120}
            subText={formatEnergyDate(current.startsAt)}
          />
        </View>
      ) : null}

      {/* Solar Gauge */}
      {tibber2 && tibber2.inverter ? (
        <View style={styles.card}>
          <Text style={styles.label}>{translate('production', lang)}</Text>
          <GaugeCircle
            value={parseFloat(tibber2.inverter.bubble.percent / 100)}
            valueText={tibber2.inverter.bubble.value + ' W'}
            valueTextColor={solarColor(tibber2.inverter.bubble.percent)}
            borderColor={solarColor(tibber2.inverter.bubble.percent)}
            size={120}
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 8,
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

export default TibberGaugesWidget;
