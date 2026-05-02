import React, {useMemo} from 'react';
import {View, Text, StyleSheet, useWindowDimensions} from 'react-native';
import useStore from '../store';
import {translate} from '../utils/translations';
import {energyColor} from '../utils/colors';
import PriceChart from '../components/PriceChart';
import WidgetCard from '../components/WidgetCard';
import dayjs from 'dayjs';
import {fs} from '../utils/scale';

const TibberPriceWidget = () => {
  const tibber = useStore((s) => s.tibber);
  const config = useStore((s) => s.config);
  const {width} = useWindowDimensions();
  const lang = config.language || 'en';

  // Build chart data — port of home.vue priceChart computed
  const {chartData, currentPrice} = useMemo(() => {
    if (!tibber || !tibber.currentSubscription || !tibber.currentSubscription.priceInfo) {
      return {chartData: [], currentPrice: null};
    }

    const priceInfo = tibber.currentSubscription.priceInfo;
    const values = [];

    if (priceInfo.today) {
      for (const val of priceInfo.today) {
        if (dayjs(val.startsAt).diff(dayjs()) > -(2 * 60 * 60 * 1000)) {
          values.push({
            name: dayjs(val.startsAt).format('H'),
            value: val.total,
          });
        }
      }
    }

    if (priceInfo.tomorrow) {
      for (const val of priceInfo.tomorrow) {
        if (dayjs(val.startsAt).diff(dayjs()) < 12 * 60 * 60 * 1000) {
          values.push({
            name: dayjs(val.startsAt).format('H'),
            value: val.total,
          });
        }
      }
    }

    let cp = null;
    if (priceInfo.current) {
      const curr = priceInfo.current;
      cp = {
        label: (curr.total * 100).toFixed(1) + ' öre',
        value: curr.total,
        level: curr.level,
      };
    }

    return {chartData: values, currentPrice: cp};
  }, [tibber]);

  if (!tibber || !tibber.currentSubscription) {
    return null;
  }

  // Chart width = ~35% of screen
  const chartWidth = Math.min(width * 0.33, 500);

  return (
    <WidgetCard variant="light">
      <Text style={styles.title}>{translate('prices', lang)}</Text>
      <PriceChart
        data={chartData}
        currentPrice={currentPrice}
        width={chartWidth}
        height={200}
      />
    </WidgetCard>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: fs(12),
    fontWeight: '500',
    color: '#555555',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
});

export default TibberPriceWidget;
