import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {translate} from '../../utils/translations';
import PillInput from './PillInput';

const StocksTab = ({form, updateField, lang, Section}) => {
  return (
    <View>
      <Section title={translate('stockSymbols', lang)}>
        <PillInput
          value={form.quotes}
          onChange={(v) => updateField('quotes', v)}
          placeholder="^GSPC"
        />
        <Text style={styles.hint}>{translate('stocksHint', lang)}</Text>
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  hint: {
    color: '#666',
    fontSize: 11,
    marginBottom: 8,
    fontStyle: 'italic',
  },
});

export default StocksTab;
