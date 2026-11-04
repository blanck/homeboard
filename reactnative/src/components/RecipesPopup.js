import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {translate} from '../utils/translations';
import {dateKey, addDays, hasMeal, hasRecipe} from '../utils/meals';
import {formatMinutes} from '../utils/recipe';
import {fs, sp} from '../utils/scale';

const DAYS_SHOWN = 7;

const RecipesPopup = () => {
  const visible = useStore((s) => s.recipesVisible);
  const hide = useStore((s) => s.hideRecipes);
  const showRecipe = useStore((s) => s.showRecipe);
  const openSettings = useStore((s) => s.openSettings);
  const days = useStore((s) => s.config.meals?.days) || {};
  const lang = useStore((s) => s.config.language || 'en');

  if (!visible) return null;

  const today = new Date();
  const weekdays = translate('weekdaysShort', lang);
  const planned = Array.from({length: DAYS_SHOWN}, (_, i) => addDays(today, i))
    .map((d, i) => ({d, isToday: i === 0, meal: days[dateKey(d)]}))
    .filter(({meal}) => hasMeal(meal));

  const open = (meal) => {
    hide();
    showRecipe(meal);
  };

  const planMeals = () => {
    hide();
    openSettings('meals');
  };

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={hide}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={hide} />
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>{translate('recipes', lang)}</Text>
            <TouchableOpacity onPress={hide} hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
              <Icon name="close" size={sp(28)} color="#cccccc" />
            </TouchableOpacity>
          </View>

          {planned.length ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {planned.map(({d, isToday, meal}) => {
                const tappable = hasRecipe(meal);
                return (
                  <TouchableOpacity
                    key={dateKey(d)}
                    style={styles.row}
                    disabled={!tappable}
                    onPress={() => open(meal)}>
                    {meal.image ? (
                      <Image source={{uri: meal.image}} style={styles.photo} />
                    ) : (
                      <View style={[styles.photo, styles.noPhoto]}>
                        <Icon name="silverware-fork-knife" size={sp(22)} color="#666688" />
                      </View>
                    )}
                    <View style={styles.rowText}>
                      <Text style={[styles.day, isToday && styles.today]}>
                        {isToday ? translate('tonight', lang) : `${weekdays[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`}
                      </Text>
                      <Text style={styles.name} numberOfLines={2}>
                        {meal.name || meal.source || meal.url}
                      </Text>
                      {meal.minutes ? <Text style={styles.time}>{formatMinutes(meal.minutes)}</Text> : null}
                    </View>
                    {tappable ? <Icon name="chevron-right" size={sp(24)} color="#666688" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.empty}>{translate('nothingPlanned', lang)}</Text>
          )}

          <TouchableOpacity style={styles.planBtn} onPress={planMeals}>
            <Icon name="calendar-edit" size={sp(18)} color="#ffffff" />
            <Text style={styles.planText}>{translate('planMeals', lang)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    width: '90%',
    maxWidth: sp(640),
    maxHeight: '85%',
    backgroundColor: '#16162a',
    borderRadius: 12,
    padding: sp(20),
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp(12),
  },
  title: {
    color: '#ffffff',
    fontSize: fs(24),
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(14),
    paddingVertical: sp(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2e2e4a',
  },
  photo: {
    width: sp(84),
    height: sp(64),
    borderRadius: 6,
    backgroundColor: '#222',
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  day: {
    color: '#9a9ab8',
    fontSize: fs(13),
    fontWeight: '600',
  },
  today: {
    color: '#e8a33d',
  },
  name: {
    color: '#ffffff',
    fontSize: fs(18),
    fontWeight: '600',
  },
  time: {
    color: '#9a9ab8',
    fontSize: fs(13),
  },
  empty: {
    color: '#9a9ab8',
    fontSize: fs(16),
    paddingVertical: sp(24),
    textAlign: 'center',
  },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(8),
    backgroundColor: '#1B4781',
    borderRadius: 20,
    paddingVertical: sp(10),
    marginTop: sp(14),
  },
  planText: {
    color: '#ffffff',
    fontSize: fs(15),
    fontWeight: '600',
  },
});

export default RecipesPopup;
