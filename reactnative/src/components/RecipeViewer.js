import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import { translate } from '../utils/translations';
import {
  formatMinutes,
  isIngredientHeading,
  isStepHeading,
} from '../utils/recipe';
import { convertUnits, resolveUnits } from '../utils/units';
import { fs, sp } from '../utils/scale';

const PANEL_BG = '#16162a';

// Headings get no number, so the steps under them count on from 1, 2, 3...
const numberSteps = steps => {
  let n = 0;
  return steps.map(step => ({ step, n: isStepHeading(step) ? 0 : ++n }));
};

const RecipeViewer = () => {
  const recipe = useStore(s => s.currentRecipe);
  const hideRecipe = useStore(s => s.hideRecipe);
  const showArticle = useStore(s => s.showArticle);
  const lang = useStore(s => s.config.language || 'en');
  const units = useStore(s => resolveUnits(s.config.units));
  // Ticked ingredients and steps, so the cook can keep their place
  const [ticked, setTicked] = useState({});

  useEffect(() => {
    setTicked({});
  }, [recipe]);

  if (!recipe) return null;

  const ingredients = recipe.ingredients || [];
  const steps = recipe.steps || [];
  const toggle = key => setTicked(prev => ({ ...prev, [key]: !prev[key] }));
  const isHeading = item => isIngredientHeading(item, recipe.source);
  const measured = text => convertUnits(text, units);

  const openOriginal = () => {
    hideRecipe();
    showArticle({
      title: recipe.name,
      url: recipe.url,
      source: { name: recipe.source },
    });
  };

  // Sites may already spell it out: "Makes 12", "20 crêpes"
  const servings = /^[\d\s–-]+$/.test(recipe.servings || '')
    ? `${recipe.servings} ${translate('servings', lang)}`
    : recipe.servings;

  const meta = [
    recipe.minutes ? formatMinutes(recipe.minutes) : '',
    servings,
    recipe.source,
  ].filter(Boolean);

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={hideRecipe}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={hideRecipe} />
        <View style={styles.panel}>
          <View style={styles.header}>
            {recipe.image ? (
              <Image source={{ uri: recipe.image }} style={styles.photo} />
            ) : null}
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>
                {recipe.name}
              </Text>
              {meta.length ? (
                <Text style={styles.meta}>{meta.join(' · ')}</Text>
              ) : null}
              <View style={styles.actions}>
                {recipe.url ? (
                  <TouchableOpacity
                    style={[styles.action, styles.actionQuiet]}
                    onPress={openOriginal}
                  >
                    <Icon name="open-in-new" size={sp(16)} color="#cccccc" />
                    <Text style={styles.actionQuietText}>
                      {translate('originalPage', lang)}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              onPress={hideRecipe}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="close" size={sp(28)} color="#cccccc" />
            </TouchableOpacity>
          </View>

          {ingredients.length || steps.length ? (
            <View style={styles.columns}>
              <ScrollView
                style={styles.ingredientsCol}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.colTitle}>
                  {translate('ingredients', lang)}
                </Text>
                {ingredients.map((item, i) =>
                  isHeading(item) ? (
                    <Text key={`i${i}`} style={styles.subheading}>
                      {item}
                    </Text>
                  ) : (
                    <TouchableOpacity
                      key={`i${i}`}
                      style={styles.ingredient}
                      onPress={() => toggle(`i${i}`)}
                    >
                      <Icon
                        name={
                          ticked[`i${i}`]
                            ? 'checkbox-marked-circle'
                            : 'checkbox-blank-circle-outline'
                        }
                        size={sp(20)}
                        color={ticked[`i${i}`] ? '#3fcf40' : '#666688'}
                      />
                      <Text
                        style={[
                          styles.ingredientText,
                          ticked[`i${i}`] && styles.done,
                        ]}
                      >
                        {measured(item)}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </ScrollView>
              <ScrollView
                style={styles.stepsCol}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.colTitle}>{translate('steps', lang)}</Text>
                {numberSteps(steps).map(({ step, n }, i) =>
                  n ? (
                    <TouchableOpacity
                      key={`s${i}`}
                      style={styles.step}
                      onPress={() => toggle(`s${i}`)}
                    >
                      <View
                        style={[
                          styles.stepNumber,
                          ticked[`s${i}`] && styles.stepNumberDone,
                        ]}
                      >
                        <Text style={styles.stepNumberText}>{n}</Text>
                      </View>
                      <Text
                        style={[
                          styles.stepText,
                          ticked[`s${i}`] && styles.done,
                        ]}
                      >
                        {measured(step)}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text key={`s${i}`} style={styles.subheading}>
                      {step}
                    </Text>
                  ),
                )}
              </ScrollView>
            </View>
          ) : (
            <Text style={styles.empty}>{translate('noRecipeData', lang)}</Text>
          )}
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
    height: '90%',
    backgroundColor: PANEL_BG,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: sp(20),
    gap: sp(20),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2e2e4a',
  },
  photo: {
    width: sp(200),
    height: sp(134),
    borderRadius: 8,
    backgroundColor: '#222',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#ffffff',
    fontSize: fs(28),
    fontWeight: '700',
    lineHeight: fs(34),
  },
  meta: {
    color: '#9a9ab8',
    fontSize: fs(15),
    marginTop: sp(6),
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp(10),
    marginTop: sp(14),
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(8),
    backgroundColor: '#1B4781',
    borderRadius: 20,
    paddingVertical: sp(8),
    paddingHorizontal: sp(16),
  },
  actionQuiet: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3a3a5a',
  },
  actionQuietText: {
    color: '#cccccc',
    fontSize: fs(15),
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
  },
  ingredientsCol: {
    flex: 1,
    paddingHorizontal: sp(20),
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#2e2e4a',
  },
  stepsCol: {
    flex: 1,
    paddingHorizontal: sp(24),
  },
  colTitle: {
    color: '#9a9ab8',
    fontSize: fs(13),
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: sp(18),
    marginBottom: sp(10),
  },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(10),
    paddingVertical: sp(7),
  },
  ingredientText: {
    flex: 1,
    color: '#e8e8f0',
    fontSize: fs(18),
    lineHeight: fs(24),
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp(14),
    paddingVertical: sp(10),
  },
  stepNumber: {
    width: sp(30),
    height: sp(30),
    borderRadius: sp(15),
    backgroundColor: '#1B4781',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberDone: {
    backgroundColor: '#2e2e4a',
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: fs(15),
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    color: '#e8e8f0',
    fontSize: fs(19),
    lineHeight: fs(28),
  },
  done: {
    color: '#5a5a78',
    textDecorationLine: 'line-through',
  },
  subheading: {
    color: '#ffffff',
    fontSize: fs(16),
    fontWeight: '700',
    marginTop: sp(14),
    marginBottom: sp(4),
  },
  empty: {
    color: '#9a9ab8',
    fontSize: fs(16),
    padding: sp(24),
  },
});

export default RecipeViewer;
