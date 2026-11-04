import React from 'react';
import {View, Text, StyleSheet, Switch} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {translate} from '../../utils/translations';
import {SLOT_ROWS, formSlots, moveWidget, slotOptions} from '../../utils/layout';
import DropdownPicker from './DropdownPicker';

const COLUMN_LABELS = ['slotLeft', 'slotCenter', 'slotRight'];

const WIDGET_LABELS = {
  auto: 'moduleAuto',
  none: 'widgetNone',
  weather: 'weather',
  clock: 'widgetClock',
  forecast: 'widgetForecast',
  news: 'news',
  calendar: 'calendar',
  stocks: 'stocks',
  energy: 'prices',
  todo: 'todo',
  headlines: 'topStories',
  chores: 'chores',
  countdown: 'countdown',
  meals: 'meals',
  sonos: 'Sonos',
  playlists: 'widgetPlaylists',
};

// La Marzocco and the pool keep the switches they already have in Smart Devices
const TILES = [
  {tile: 'gauges', label: 'tileGauges', icon: 'gauge'},
  {tile: 'consumption', label: 'consumption', icon: 'flash'},
  {tile: 'battery', label: 'tileBattery', icon: 'home-battery-outline'},
  {tile: 'ev', label: 'tileEv', icon: 'car-electric-outline'},
  {tile: 'thermostat', label: 'tileThermostat', icon: 'thermostat'},
  {field: 'lmShowWidget', label: 'La Marzocco', icon: 'coffee-maker'},
  {field: 'poolShowWidget', label: 'pool', icon: 'pool'},
  {tile: 'recipes', label: 'recipes', icon: 'book-open-variant'},
];

const LayoutTab = ({form, updateField, lang, Section, Row}) => {
  const slots = formSlots(form);
  const tiles = form.layoutTiles || {};

  const assign = (slot, widget) => {
    const {midRight, ...rest} = moveWidget(slots, slot, widget);
    updateField('layoutSlots', rest);
    updateField('rightModule', midRight);
  };

  const isOn = ({tile, field}) => (tile ? tiles[tile] : form[field]) !== false;
  const setOn = ({tile, field}, on) =>
    tile ? updateField('layoutTiles', {...tiles, [tile]: on}) : updateField(field, on);

  return (
    <View>
      {SLOT_ROWS.map((row) => (
        <Section key={row.title} title={translate(row.title, lang)}>
          <Row>
            {row.slots.map((slot, column) => (
              <View key={slot} style={styles.col}>
                <DropdownPicker
                  label={translate(COLUMN_LABELS[column], lang)}
                  value={slots[slot]}
                  options={slotOptions(slot).map((value) => ({
                    value,
                    label: translate(WIDGET_LABELS[value], lang),
                  }))}
                  onValueChange={(widget) => assign(slot, widget)}
                />
              </View>
            ))}
            {row.slots.length < COLUMN_LABELS.length ? (
              <View style={styles.col}>
                <DropdownPicker
                  disabled
                  label={translate('slotRight', lang)}
                  value=""
                  options={[]}
                  placeholder={translate('homePanel', lang)}
                />
              </View>
            ) : null}
          </Row>
        </Section>
      ))}

      <Section title={translate('homePanel', lang)}>
        {TILES.map((item) => (
          <View key={item.label} style={styles.tileRow}>
            <Icon name={item.icon} size={18} color="#cccccc" />
            <Text style={styles.tileLabel}>{translate(item.label, lang)}</Text>
            <Switch
              value={isOn(item)}
              onValueChange={(on) => setOn(item, on)}
              trackColor={{false: '#333', true: '#1B4781'}}
              thumbColor="#ffffff"
            />
          </View>
        ))}
        <Text style={styles.hint}>{translate('homePanelHint', lang)}</Text>
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  col: {
    flex: 1,
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  tileLabel: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  hint: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
  },
});

export default LayoutTab;
