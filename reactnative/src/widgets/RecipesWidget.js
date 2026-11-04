import React from 'react';
import {Text, StyleSheet, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {translate} from '../utils/translations';
import {dateKey, hasMeal} from '../utils/meals';
import {fs} from '../utils/scale';

const RecipesWidget = () => {
  const days = useStore((s) => s.config.meals?.days) || {};
  const lang = useStore((s) => s.config.language || 'en');
  const showRecipes = useStore((s) => s.showRecipes);
  const tonight = days[dateKey(new Date())];

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.7} onPress={showRecipes}>
      <Text style={styles.label}>{translate('recipes', lang)}</Text>
      <View style={styles.icon}>
        <Icon name="book-open-variant" size={36} color="#e8a33d" />
      </View>
      <Text style={styles.meal} numberOfLines={2}>
        {hasMeal(tonight) ? tonight.name || tonight.source : translate('nothingPlanned', lang)}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: fs(11),
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  icon: {
    marginBottom: 8,
  },
  meal: {
    color: '#ffffff',
    fontSize: fs(10),
    textAlign: 'center',
  },
});

export default RecipesWidget;
