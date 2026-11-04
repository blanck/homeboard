import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { translate } from '../../utils/translations';
import { dateKey, addDays, startOfWeek, hasMeal } from '../../utils/meals';
import { fetchRecipe } from '../../utils/recipe';
import { searchRecipes } from '../../utils/recipeSearch';
import { deviceUnits } from '../../utils/units';
import DropdownPicker from './DropdownPicker';

const MealsTab = ({ form, updateField, lang, Section, Field }) => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  // Only the day being edited unfolds, as in the chores tab
  const [expanded, setExpanded] = useState(() => dateKey(new Date()));
  const [fetching, setFetching] = useState('');
  const [status, setStatus] = useState({});
  // Search per open day: {query, results, searching, adding, showLink}
  const [finder, setFinder] = useState({});
  const finderFor = key => finder[key] || {};
  const patchFinder = (key, patch) =>
    setFinder(f => ({ ...f, [key]: { ...(f[key] || {}), ...patch } }));

  const meals = form.mealDays || {};
  const weekdays = translate('weekdaysShort', lang);
  const todayKey = dateKey(new Date());
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const patchDay = (key, patch) =>
    updateField('mealDays', prev => ({
      ...(prev || {}),
      [key]: { ...(prev || {})[key], ...patch },
    }));

  const clearDay = key =>
    updateField('mealDays', prev => {
      const next = { ...(prev || {}) };
      delete next[key];
      return next;
    });

  const importRecipe = async key => {
    const url = (meals[key]?.url || '').trim();
    if (!/^https?:\/\//i.test(url)) {
      setStatus(s => ({ ...s, [key]: translate('recipeBadLink', lang) }));
      return;
    }
    setFetching(key);
    setStatus(s => ({ ...s, [key]: '' }));
    const recipe = await fetchRecipe(url);
    setFetching('');
    if (!recipe) {
      setStatus(s => ({ ...s, [key]: translate('recipeFetchFailed', lang) }));
      return;
    }
    // Keep a name the user already typed; it is often shorter than the site's
    patchDay(key, { ...recipe, name: meals[key]?.name || recipe.name });
    setStatus(s => ({
      ...s,
      [key]: recipe.ingredients.length
        ? `${recipe.ingredients.length} ${translate(
            'ingredients',
            lang,
          ).toLowerCase()} · ${recipe.steps.length} ${translate(
            'steps',
            lang,
          ).toLowerCase()}`
        : translate('noRecipeData', lang),
    }));
  };

  const runSearch = async key => {
    const query = (finderFor(key).query || '').trim();
    if (!query) return;
    patchFinder(key, { searching: true, results: null });
    const results = await searchRecipes(query, lang);
    patchFinder(key, { searching: false, results });
  };

  // The site's recipe data wins, but a failed import still plans the meal
  const addResult = async (key, result) => {
    patchFinder(key, { adding: result.url });
    const recipe = await fetchRecipe(result.url);
    patchDay(key, {
      ...(recipe || {}),
      name: recipe?.name || result.title,
      url: result.url,
      image: recipe?.image || result.image,
      source: recipe?.source || result.source,
    });
    setFinder(f => ({ ...f, [key]: {} }));
    setStatus(s => ({
      ...s,
      [key]: recipe?.ingredients?.length ? '' : translate('noRecipeData', lang),
    }));
  };

  const addNameOnly = key => {
    const query = (finderFor(key).query || '').trim();
    if (!query) return;
    patchDay(key, {
      name: query,
      url: '',
      ingredients: [],
      steps: [],
      image: '',
    });
    setFinder(f => ({ ...f, [key]: {} }));
  };

  // Fills empty days from the same weekday a week earlier
  const copyLastWeek = () =>
    updateField('mealDays', prev => {
      const next = { ...(prev || {}) };
      for (const d of week) {
        const key = dateKey(d);
        const source = next[dateKey(addDays(d, -7))];
        if (!hasMeal(next[key]) && hasMeal(source)) next[key] = { ...source };
      }
      return next;
    });

  const weekLabel = `${weekStart.getDate()}/${
    weekStart.getMonth() + 1
  } - ${addDays(weekStart, 6).getDate()}/${
    addDays(weekStart, 6).getMonth() + 1
  }`;

  // Shows what Auto resolved to, since a tablet's region is often wrong
  const unitOptions = [
    {
      label: `${translate('unitsAuto', lang)} (${
        deviceUnits() === 'imperial' ? 'lb, oz' : 'g, l'
      })`,
      value: 'auto',
    },
    { label: translate('unitsMetric', lang), value: 'metric' },
    { label: translate('unitsImperial', lang), value: 'imperial' },
  ];

  return (
    <View>
      <DropdownPicker
        label={translate('measurements', lang)}
        value={form.units || 'auto'}
        options={unitOptions}
        onValueChange={v => updateField('units', v)}
      />
      <Section title={translate('mealPlan', lang)}>
        <View style={styles.weekBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setWeekStart(w => addDays(w, -7))}
          >
            <Icon name="chevron-left" size={22} color="#cccccc" />
          </TouchableOpacity>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setWeekStart(w => addDays(w, 7))}
          >
            <Icon name="chevron-right" size={22} color="#cccccc" />
          </TouchableOpacity>
          <View style={styles.spacer} />
          <TouchableOpacity style={styles.copyBtn} onPress={copyLastWeek}>
            <Icon name="content-copy" size={14} color="#ffffff" />
            <Text style={styles.copyBtnText}>
              {translate('copyLastWeek', lang)}
            </Text>
          </TouchableOpacity>
        </View>

        {week.map(d => {
          const key = dateKey(d);
          const meal = meals[key] || {};
          const open = expanded === key;
          return (
            <View
              key={key}
              style={[styles.dayCard, key === todayKey && styles.today]}
            >
              <TouchableOpacity
                style={styles.dayRow}
                onPress={() => setExpanded(open ? null : key)}
              >
                <Text style={styles.dayLabel}>
                  {weekdays[d.getDay()]} {d.getDate()}/{d.getMonth() + 1}
                </Text>
                <Text
                  style={[styles.dayMeal, !hasMeal(meal) && styles.dayEmpty]}
                  numberOfLines={1}
                >
                  {hasMeal(meal)
                    ? meal.name || meal.url
                    : translate('nothingPlanned', lang)}
                </Text>
                {meal.ingredients?.length ? (
                  <Icon name="book-open-variant" size={16} color="#6a9ee0" />
                ) : null}
                <Icon
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#777"
                />
              </TouchableOpacity>

              {open ? (
                <View style={styles.dayBody}>
                  {hasMeal(meal) && !finderFor(key).changing ? (
                    <View style={styles.planned}>
                      {meal.image ? (
                        <Image
                          source={{ uri: meal.image }}
                          style={styles.plannedImage}
                        />
                      ) : null}
                      <View style={styles.plannedInfo}>
                        <Text style={styles.plannedName}>
                          {meal.name || meal.url}
                        </Text>
                        <Text style={styles.plannedMeta} numberOfLines={1}>
                          {[
                            meal.source,
                            meal.ingredients?.length
                              ? `${meal.ingredients.length} ${translate(
                                  'ingredients',
                                  lang,
                                ).toLowerCase()}`
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View>
                      <View style={styles.searchRow}>
                        <TextInput
                          style={styles.searchInput}
                          value={finderFor(key).query || ''}
                          onChangeText={v => patchFinder(key, { query: v })}
                          placeholder={translate(
                            'recipeSearchPlaceholder',
                            lang,
                          )}
                          placeholderTextColor="#666"
                          returnKeyType="search"
                          onSubmitEditing={() => runSearch(key)}
                          autoCorrect={false}
                        />
                        <TouchableOpacity
                          style={styles.fetchBtn}
                          onPress={() => runSearch(key)}
                        >
                          {finderFor(key).searching ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Icon name="magnify" size={20} color="#ffffff" />
                          )}
                        </TouchableOpacity>
                      </View>

                      {finderFor(key).results ? (
                        finderFor(key).results.length ? (
                          finderFor(key).results.map(r => (
                            <TouchableOpacity
                              key={r.url}
                              style={styles.result}
                              disabled={!!finderFor(key).adding}
                              onPress={() => addResult(key, r)}
                            >
                              {r.image ? (
                                <Image
                                  source={{ uri: r.image }}
                                  style={styles.resultImage}
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.resultImage,
                                    styles.resultNoImage,
                                  ]}
                                >
                                  <Icon
                                    name="silverware-fork-knife"
                                    size={20}
                                    color="#555"
                                  />
                                </View>
                              )}
                              <View style={styles.resultInfo}>
                                <Text
                                  style={styles.resultTitle}
                                  numberOfLines={2}
                                >
                                  {r.title}
                                </Text>
                                <Text style={styles.resultSource}>
                                  {r.source}
                                </Text>
                              </View>
                              {finderFor(key).adding === r.url ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#ffffff"
                                />
                              ) : (
                                <Icon
                                  name="plus-circle-outline"
                                  size={24}
                                  color="#6a9ee0"
                                />
                              )}
                            </TouchableOpacity>
                          ))
                        ) : (
                          <Text style={styles.status}>
                            {translate('noResults', lang)}
                          </Text>
                        )
                      ) : null}

                      {(finderFor(key).query || '').trim() &&
                      !finderFor(key).searching ? (
                        <TouchableOpacity
                          style={styles.textBtn}
                          onPress={() => addNameOnly(key)}
                        >
                          <Icon name="pencil-outline" size={16} color="#9ab" />
                          <Text style={styles.textBtnText}>
                            {translate('addWithoutRecipe', lang).replace(
                              '{name}',
                              finderFor(key).query.trim(),
                            )}
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {finderFor(key).showLink ? (
                        <View style={styles.linkRow}>
                          <View style={styles.linkField}>
                            <Field
                              label={translate('recipeLink', lang)}
                              value={meal.url || ''}
                              onChangeText={v => patchDay(key, { url: v })}
                              placeholder="https://"
                              returnKeyType="go"
                              onSubmitEditing={() => importRecipe(key)}
                            />
                          </View>
                          <TouchableOpacity
                            style={[styles.fetchBtn, styles.linkBtn]}
                            disabled={fetching === key}
                            onPress={() => importRecipe(key)}
                          >
                            {fetching === key ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text style={styles.fetchBtnText}>
                                {translate('fetchRecipe', lang)}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.textBtn}
                          onPress={() => patchFinder(key, { showLink: true })}
                        >
                          <Icon name="link-variant" size={16} color="#777" />
                          <Text style={[styles.textBtnText, styles.mutedText]}>
                            {translate('pasteRecipeLink', lang)}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  {status[key] ? (
                    <Text style={styles.status}>{status[key]}</Text>
                  ) : null}
                  {hasMeal(meal) ? (
                    <View style={styles.dayActions}>
                      {finderFor(key).changing ? (
                        <TouchableOpacity
                          style={styles.textBtn}
                          onPress={() => setFinder(f => ({ ...f, [key]: {} }))}
                        >
                          <Icon name="close" size={16} color="#9ab" />
                          <Text style={styles.textBtnText}>
                            {translate('cancel', lang)}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.textBtn}
                          onPress={() =>
                            patchFinder(key, {
                              changing: true,
                              query: meal.name || '',
                            })
                          }
                        >
                          <Icon name="swap-horizontal" size={16} color="#9ab" />
                          <Text style={styles.textBtnText}>
                            {translate('changeMeal', lang)}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => clearDay(key)}
                      >
                        <Icon name="trash-can-outline" size={16} color="#a55" />
                        <Text style={styles.clearText}>
                          {translate('clearDay', lang)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
        <Text style={styles.hint}>{translate('mealsHint', lang)}</Text>
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  navBtn: {
    padding: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
  },
  weekLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 110,
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3a3a3a',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  copyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  dayCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 6,
  },
  today: {
    borderColor: '#2f6bb5',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayLabel: {
    color: '#aaaaaa',
    fontSize: 13,
    fontWeight: '700',
    width: 70,
  },
  dayMeal: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  dayEmpty: {
    color: '#666',
    fontStyle: 'italic',
  },
  dayBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  planned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  plannedImage: {
    width: 72,
    height: 72,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  plannedInfo: {
    flex: 1,
  },
  plannedName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  plannedMeta: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    color: '#ffffff',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  resultImage: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  resultNoImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultSource: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  textBtnText: {
    color: '#9ab',
    fontSize: 13,
  },
  mutedText: {
    color: '#777',
  },
  dayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  linkBtn: {
    marginBottom: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  linkField: {
    flex: 1,
  },
  fetchBtn: {
    backgroundColor: '#1B4781',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 90,
    alignItems: 'center',
  },
  fetchBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  status: {
    color: '#9ab',
    fontSize: 12,
    marginBottom: 8,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  clearText: {
    color: '#a55',
    fontSize: 12,
  },
  hint: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
  },
});

export default MealsTab;
