import React, {useEffect, useState, useMemo, useCallback} from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  fetchTheNewsApiSources,
  fetchNewsdataSources,
  fetchCurrentsSources,
} from '../../services/newsService';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const FETCHERS = {
  newsdata: {fn: fetchNewsdataSources, cacheKey: 'homeboard_newsdata_sources'},
  thenewsapi: {fn: fetchTheNewsApiSources, cacheKey: 'homeboard_thenewsapi_sources'},
  currents: {fn: fetchCurrentsSources, cacheKey: 'homeboard_currents_sources'},
};

const SourcePicker = ({value, onChange, apiKey, language, provider = 'thenewsapi'}) => {
  const cfg = FETCHERS[provider] || FETCHERS.thenewsapi;
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inputValue, setInputValue] = useState('');

  const selected = useMemo(
    () =>
      new Set(
        (value || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    [value],
  );

  const load = useCallback(
    async (force = false) => {
      if (!apiKey) {
        setSources(null);
        setError('apiKeyMissing');
        return;
      }
      setError(null);
      if (!force) {
        try {
          const cached = await AsyncStorage.getItem(cfg.cacheKey);
          if (cached) {
            const {fetchedAt, language: cachedLang, items} = JSON.parse(cached);
            const fresh = Date.now() - fetchedAt < CACHE_TTL_MS;
            if (fresh && cachedLang === language && Array.isArray(items)) {
              setSources(items);
              return;
            }
          }
        } catch {}
      }
      setLoading(true);
      const result = await cfg.fn(apiKey, language);
      setLoading(false);
      if (Array.isArray(result)) {
        setSources(result);
        AsyncStorage.setItem(
          cfg.cacheKey,
          JSON.stringify({fetchedAt: Date.now(), language, items: result}),
        ).catch(() => {});
      } else if (result && result.error) {
        setError(result.error);
      } else {
        setError('Unable to load sources');
      }
    },
    [apiKey, language, cfg],
  );

  useEffect(() => {
    setSources(null);
    setError(null);
    if (!apiKey) {
      setError('apiKeyMissing');
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => load(false), 700);
    return () => {
      clearTimeout(timer);
    };
  }, [apiKey, language, cfg, load]);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next].join(','));
  };

  const ordered = useMemo(() => {
    const apiList = sources || [];
    const seen = new Set();
    const unique = [];
    for (const s of apiList) {
      if (s.id && !seen.has(s.id)) {
        seen.add(s.id);
        unique.push(s);
      }
    }
    // Add selected items that aren't in the API list (manual entries)
    for (const id of selected) {
      if (!seen.has(id)) {
        seen.add(id);
        unique.push({id, domain: id, _custom: true});
      }
    }
    return unique.sort((a, b) => {
      const aSel = selected.has(a.id) ? 0 : 1;
      const bSel = selected.has(b.id) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      const aLabel = (a.domain || a.id || '').toLowerCase();
      const bLabel = (b.domain || b.id || '').toLowerCase();
      return aLabel.localeCompare(bLabel);
    });
  }, [sources, selected]);

  const addCustom = (raw) => {
    const items = raw
      .split(',')
      .map((s) => s.trim().replace(/^https?:\/\//, '').replace(/^www\./, ''))
      .filter(Boolean);
    if (items.length === 0) return;
    const next = new Set(selected);
    items.forEach((s) => next.add(s));
    onChange([...next].join(','));
  };

  const handleInputChange = (text) => {
    if (text.includes(',')) {
      const parts = text.split(',');
      const last = parts.pop();
      addCustom(parts.join(','));
      setInputValue(last);
    } else {
      setInputValue(text);
    }
  };

  const handleInputSubmit = () => {
    if (inputValue.trim()) {
      addCustom(inputValue);
      setInputValue('');
    }
  };

  return (
    <View>
      <TextInput
        style={styles.manualInput}
        value={inputValue}
        onChangeText={handleInputChange}
        onSubmitEditing={handleInputSubmit}
        placeholder="Add domain manually (e.g. cnn.com)"
        placeholderTextColor="#666"
        autoCorrect={false}
        autoCapitalize="none"
        blurOnSubmit={false}
        returnKeyType="done"
      />
      {loading && !sources ? (
        <ActivityIndicator size="small" color="#888" style={styles.loader} />
      ) : null}

      {error === 'apiKeyMissing' ? (
        <Text style={styles.errText}>Enter your API key first.</Text>
      ) : error ? (
        <Text style={styles.errText}>Could not load: {error}</Text>
      ) : null}

      {sources ? (
        <>
          <View style={styles.header}>
            <Text style={styles.count}>
              {selected.size} selected · {ordered.length} sources
            </Text>
            <TouchableOpacity onPress={() => load(true)} hitSlop={8}>
              <Icon name="refresh" size={16} color="#888" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled">
            {ordered.map((s) => {
              const active = selected.has(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.chip,
                    active && styles.chipActive,
                    s._custom && styles.chipCustom,
                  ]}
                  onPress={() => toggle(s.id)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {s.domain || s.id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  manualInput: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  loader: {
    marginVertical: 8,
  },
  errText: {
    color: '#e57373',
    fontSize: 12,
    marginBottom: 8,
  },
  count: {
    color: '#888',
    fontSize: 11,
  },
  chipsScroll: {
    maxHeight: 134,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 6,
    padding: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingBottom: 4,
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
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderColor: '#4CAF50',
  },
  chipCustom: {
    borderStyle: 'dashed',
  },
  chipText: {
    color: '#888',
    fontSize: 11,
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default SourcePicker;
