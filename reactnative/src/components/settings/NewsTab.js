import React, {useState, useEffect} from 'react';
import {View, Text, TextInput, StyleSheet, Linking, TouchableOpacity} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {translate} from '../../utils/translations';
import DropdownPicker from './DropdownPicker';
import PillInput from './PillInput';
import SourcePicker from './SourcePicker';
import {CURRENTS_CATEGORIES_CACHE_KEY} from '../../services/newsService';

const NEWS_LANGUAGES = [
  {label: 'English', value: 'en'},
  {label: 'Svenska', value: 'sv'},
  {label: 'Deutsch', value: 'de'},
  {label: 'Français', value: 'fr'},
  {label: 'Español', value: 'es'},
];

const NEWS_PROVIDERS = [
  {label: 'NewsData.io', value: 'newsdata', site: 'https://newsdata.io', formField: 'newsKeyNewsdata'},
  {label: 'TheNewsAPI', value: 'thenewsapi', site: 'https://www.thenewsapi.com', formField: 'newsKeyThenewsapi'},
  {label: 'CurrentsAPI', value: 'currents', site: 'https://currentsapi.services', formField: 'newsKeyCurrents'},
  {label: 'NewsAPI.org', value: 'newsapiorg', site: 'https://newsapi.org', formField: 'newsKeyNewsapiorg'},
];

// Each provider has its own set of valid categories
const CATEGORIES_BY_PROVIDER = {
  newsdata: [
    'breaking', 'business', 'crime', 'domestic', 'education',
    'entertainment', 'environment', 'food', 'health', 'lifestyle',
    'politics', 'science', 'sports', 'technology', 'top', 'tourism', 'world',
  ],
  thenewsapi: [
    'general', 'science', 'sports', 'business', 'health',
    'entertainment', 'tech', 'politics', 'food', 'travel',
  ],
  currents: [
    'general', 'society', 'science_technology', 'politics_government',
    'economy_business_finance', 'arts_culture_entertainment', 'lifestyle_leisure',
    'human_interest', 'sport', 'crime_law_justice', 'education', 'environment',
    'labour', 'health', 'automotive', 'real_estate',
  ],
};

const NewsTab = ({form, updateField, lang, Section, Field, Row}) => {
  const selected = (form.newsCategories || '').split(',').filter(Boolean);
  const activeProvider =
    NEWS_PROVIDERS.find((p) => p.value === form.newsProvider) || NEWS_PROVIDERS[0];
  const [currentsLearned, setCurrentsLearned] = useState(null);

  useEffect(() => {
    if (activeProvider.value !== 'currents') return;
    AsyncStorage.getItem(CURRENTS_CATEGORIES_CACHE_KEY)
      .then((str) => {
        if (!str) return;
        const {items} = JSON.parse(str);
        if (Array.isArray(items)) setCurrentsLearned(items);
      })
      .catch(() => {});
  }, [activeProvider.value]);

  const categories =
    activeProvider.value === 'currents' && currentsLearned
      ? currentsLearned
      : CATEGORIES_BY_PROVIDER[activeProvider.value] || [];

  const [catInput, setCatInput] = useState('');

  const toggleCategory = (cat) => {
    const next = selected.includes(cat)
      ? selected.filter((c) => c !== cat)
      : [...selected, cat];
    updateField('newsCategories', next.join(','));
  };

  const addCustomCategory = (raw) => {
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    const set = new Set(selected);
    items.forEach((s) => set.add(s));
    updateField('newsCategories', [...set].join(','));
  };

  const handleCatChange = (text) => {
    if (text.includes(',')) {
      const parts = text.split(',');
      const last = parts.pop();
      addCustomCategory(parts.join(','));
      setCatInput(last);
    } else {
      setCatInput(text);
    }
  };

  const handleCatSubmit = () => {
    if (catInput.trim()) {
      addCustomCategory(catInput);
      setCatInput('');
    }
  };

  // Render the union: provider's known categories plus any selected custom ones
  const knownSet = new Set(categories);
  const customSelected = selected.filter((c) => !knownSet.has(c));
  const allCategories = [...categories, ...customSelected];

  return (
    <View>
      <View style={styles.providerRow}>
        <View style={styles.providerCol}>
          <Text style={styles.colTitle}>{translate('newsProvider', lang)}</Text>
          <DropdownPicker
            value={form.newsProvider || 'newsdata'}
            options={NEWS_PROVIDERS}
            onValueChange={(v) => updateField('newsProvider', v)}
          />
        </View>
        <View style={styles.providerCol}>
          <Text style={styles.colTitle}>{translate('newsApiKey', lang)}</Text>
          <Field
            value={form[activeProvider.formField] || ''}
            onChangeText={(v) => updateField(activeProvider.formField, v)}
            secureTextEntry
          />
        </View>
      </View>
      <TouchableOpacity onPress={() => Linking.openURL(activeProvider.site)}>
        <Text style={styles.link}>
          {translate('getKeyAt', lang)} {activeProvider.site.replace(/^https?:\/\//, '')}
        </Text>
      </TouchableOpacity>

      <Section title={translate('newsCategories', lang)}>
        <TextInput
          style={styles.catInput}
          value={catInput}
          onChangeText={handleCatChange}
          onSubmitEditing={handleCatSubmit}
          placeholder="Add category manually (e.g. science_technology)"
          placeholderTextColor="#666"
          autoCorrect={false}
          autoCapitalize="none"
          blurOnSubmit={false}
          returnKeyType="done"
        />
        <View style={styles.chips}>
          {allCategories.map((cat) => {
            const active = selected.includes(cat);
            const custom = !knownSet.has(cat);
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, active && styles.chipActive, custom && styles.chipCustom]}
                onPress={() => toggleCategory(cat)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hint}>{translate('categoriesHint', lang)}</Text>
      </Section>

      <Section title={translate('sources', lang)}>
        <SourcePicker
          value={form.newsSources}
          onChange={(v) => updateField('newsSources', v)}
          apiKey={form[activeProvider.formField]}
          language={form.newsLanguage}
          provider={activeProvider.value}
        />
      </Section>

      <Row>
        <View style={styles.col}>
          <DropdownPicker
            label={translate('newsLanguage', lang)}
            value={form.newsLanguage}
            options={NEWS_LANGUAGES}
            onValueChange={(v) => updateField('newsLanguage', v)}
          />
        </View>
        <View style={styles.colWide}>
          <Text style={styles.label}>{translate('excludeWords', lang)}</Text>
          <PillInput
            value={form.newsExclude}
            onChange={(v) => updateField('newsExclude', v)}
            placeholder="word"
          />
          <Text style={styles.hint}>{translate('excludeHint', lang)}</Text>
        </View>
      </Row>
    </View>
  );
};

const styles = StyleSheet.create({
  col: {
    flex: 1,
  },
  colWide: {
    flex: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
  },
  chipActive: {
    backgroundColor: 'rgba(200, 200, 200, 0.15)',
    borderColor: '#cccccc',
  },
  chipCustom: {
    borderStyle: 'dashed',
  },
  catInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    color: '#ffffff',
    fontSize: 13,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  chipText: {
    color: '#888',
    fontSize: 11,
  },
  chipTextActive: {
    color: '#cccccc',
    fontWeight: '600',
  },
  hint: {
    color: '#666',
    fontSize: 11,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  label: {
    color: '#aaaaaa',
    fontSize: 12,
    marginBottom: 4,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  providerCol: {
    flex: 1,
  },
  colTitle: {
    color: '#cccccc',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  link: {
    color: '#cccccc',
    fontSize: 11,
    marginBottom: 8,
    fontStyle: 'italic',
    textDecorationLine: 'underline',
  },
});

export default NewsTab;
