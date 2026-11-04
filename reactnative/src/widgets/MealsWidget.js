import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ImageBackground} from 'react-native';
import Svg, {Defs, LinearGradient, Stop, Rect} from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {translate} from '../utils/translations';
import {dateKey, addDays, hasMeal, hasRecipe} from '../utils/meals';
import {formatMinutes} from '../utils/recipe';
import {fs, sp} from '../utils/scale';
import WidgetCard from '../components/WidgetCard';

const UPCOMING_DAYS = 4;

const MealsWidget = () => {
  const days = useStore((s) => s.config.meals?.days) || {};
  const lang = useStore((s) => s.config.language || 'en');
  const showRecipe = useStore((s) => s.showRecipe);
  // Changes at midnight with the dashboard's clock re-render
  const today = new Date();
  const weekdays = translate('weekdaysShort', lang);

  const tonight = days[dateKey(today)];
  const upcoming = Array.from({length: UPCOMING_DAYS}, (_, i) => {
    const d = addDays(today, i + 1);
    return {d, meal: days[dateKey(d)]};
  });

  const open = (meal) => hasRecipe(meal) && showRecipe(meal);

  return (
    <WidgetCard variant="light">
      <Text style={styles.title}>{translate('meals', lang)}</Text>
      <TouchableOpacity style={styles.hero} activeOpacity={0.85} onPress={() => open(tonight)}>
        <ImageBackground
          source={tonight?.image ? {uri: tonight.image} : undefined}
          style={styles.heroImage}
          resizeMode="cover">
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="mealShade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.3" stopColor="#000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000" stopOpacity="0.75" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#mealShade)" />
          </Svg>
          <Text style={styles.tonight}>{translate('tonight', lang)}</Text>
          {hasMeal(tonight) ? (
            <View>
              <Text style={styles.heroName} numberOfLines={2}>
                {tonight.name}
              </Text>
              {tonight.minutes ? (
                <Text style={styles.heroMeta}>
                  <Icon name="clock-outline" size={fs(14)} color="#ffffff" /> {formatMinutes(tonight.minutes)}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.heroEmpty}>{translate('nothingPlanned', lang)}</Text>
          )}
        </ImageBackground>
      </TouchableOpacity>

      <View style={styles.list}>
        {upcoming.map(({d, meal}) => (
          <TouchableOpacity key={dateKey(d)} style={styles.row} onPress={() => open(meal)}>
            <Text style={styles.day}>{weekdays[d.getDay()]}</Text>
            <Text style={[styles.name, !hasMeal(meal) && styles.nameEmpty]} numberOfLines={1}>
              {hasMeal(meal) ? meal.name : '·'}
            </Text>
            {meal?.ingredients?.length ? <Icon name="book-open-variant" size={fs(14)} color="#777777" /> : null}
          </TouchableOpacity>
        ))}
      </View>
    </WidgetCard>
  );
};

const shadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.6)',
  textShadowOffset: {width: 0, height: 1},
  textShadowRadius: 6,
};

const styles = StyleSheet.create({
  title: {
    fontSize: fs(12),
    fontWeight: '500',
    color: '#555555',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hero: {
    flex: 1,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(40, 50, 80, 0.55)',
  },
  heroImage: {
    flex: 1,
    padding: sp(12),
    justifyContent: 'space-between',
  },
  tonight: {
    color: '#ffffff',
    fontSize: fs(12),
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    ...shadow,
  },
  heroName: {
    color: '#ffffff',
    fontSize: fs(24),
    fontWeight: '800',
    lineHeight: fs(29),
    ...shadow,
  },
  heroMeta: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: fs(14),
    marginTop: 2,
    ...shadow,
  },
  heroEmpty: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: fs(16),
    ...shadow,
  },
  list: {
    marginTop: sp(6),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(10),
    paddingVertical: sp(5),
    paddingHorizontal: 4,
  },
  day: {
    width: sp(28),
    fontSize: fs(13),
    fontWeight: '700',
    color: '#555555',
  },
  name: {
    flex: 1,
    fontSize: fs(16),
    color: '#222222',
  },
  nameEmpty: {
    color: '#999999',
  },
});

export default MealsWidget;
