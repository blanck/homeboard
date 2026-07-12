import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking} from 'react-native';
import useStore from '../store';
import {
  formatPercent,
  formatStockPrice,
  formatStockSymbol,
  formatLastUpdated,
} from '../utils/formatting';
import {stockColor, stockTypeBorder, staleColor} from '../utils/colors';
import {translate} from '../utils/translations';
import WidgetCard from '../components/WidgetCard';
import {fs} from '../utils/scale';

const StocksWidget = () => {
  const quotes = useStore((s) => s.quotes);
  const stale = useStore((s) => (s.stale.quotes || 0) > 0);
  const config = useStore((s) => s.config);
  const lang = config.language || 'en';

  const lastUpdated =
    quotes && quotes.length > 0
      ? formatLastUpdated(quotes[0].price.regularMarketTime, lang)
      : '';

  const onPressStock = (symbol) => {
    const url = `https://finance.yahoo.com/chart/${encodeURIComponent(symbol)}`;
    Linking.openURL(url);
  };

  return (
    <WidgetCard variant="light">
      <View style={styles.header}>
        <Text style={styles.title}>{translate('stocks', lang)}</Text>
        <Text style={styles.updated}>{lastUpdated}</Text>
      </View>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {quotes
          ? quotes.map((quote, index) => {
              const p = quote.price;
              const borderColor = stockTypeBorder(p.quoteType);
              const pctColor = stale
                ? staleColor
                : stockColor(p.regularMarketChangePercent);
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.row, {borderLeftColor: borderColor}]}
                  onPress={() => onPressStock(p.symbol)}>
                  <Text style={styles.symbol}>
                    {formatStockSymbol(p.symbol)}
                  </Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.shortName}
                  </Text>
                  <Text style={styles.price}>
                    {p.currencySymbol} {formatStockPrice(p.regularMarketPrice)}
                  </Text>
                  <View style={[styles.chip, {backgroundColor: pctColor}]}>
                    <Text style={styles.chipText}>
                      {formatPercent(p.regularMarketChangePercent)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          : null}
      </ScrollView>
    </WidgetCard>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: fs(16),
    fontWeight: '500',
    color: '#555555',
    textTransform: 'uppercase',
  },
  updated: {
    fontSize: fs(12),
    fontWeight: '400',
    color: '#445566',
    textTransform: 'uppercase',
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(230, 230, 230, 0.2)',
    borderRadius: 4,
    borderLeftWidth: 5,
    marginVertical: 2,
    marginHorizontal: 8,
    paddingHorizontal: 6,
    height: 36,
  },
  symbol: {
    fontSize: fs(15),
    fontWeight: '500',
    color: '#445566',
    width: '18%',
  },
  name: {
    fontSize: fs(13),
    fontWeight: '400',
    color: '#333333',
    flex: 1,
  },
  price: {
    fontSize: fs(14),
    fontWeight: '400',
    color: '#333333',
    textAlign: 'right',
    width: '22%',
  },
  chip: {
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 70,
    alignItems: 'center',
    marginLeft: 4,
  },
  chipText: {
    color: '#ffffff',
    fontSize: fs(14),
    fontWeight: 'bold',
  },
});

export default StocksWidget;
