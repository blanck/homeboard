import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {translate} from '../utils/translations';
import {playFavorite, playSpotifyURI, searchAllSonos} from '../services/sonosService';
import {isSpotifyConnected, searchSpotify} from '../services/spotifyOAuthService';

const SEARCH_DEBOUNCE_MS = 350;

const SearchPopup = () => {
  const visible = useStore((s) => s.searchPopupVisible);
  const hide = useStore((s) => s.hideSearch);
  const config = useStore((s) => s.config);
  const spotifyConnectedFlag = useStore((s) => s.spotifyConnected);
  const sonosIp = config.sonos?.ip;
  const lang = config.language || 'en';
  const [spotifyOn, setSpotifyOn] = useState(false);

  useEffect(() => {
    isSpotifyConnected().then(setSpotifyOn);
  }, [visible, spotifyConnectedFlag]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
      setQuery('');
      setResults([]);
      setError(null);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          damping: 22,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [visible, slideAnim, fadeAnim]);

  useEffect(() => {
    if (!visible) return;
    const trimmed = query.trim();
    if (!trimmed || !sonosIp) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const [sonosResults, spotifyResults] = await Promise.all([
          searchAllSonos(sonosIp, trimmed),
          spotifyOn
            ? searchSpotify(trimmed, {types: ['playlist'], limit: 10}).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (reqIdRef.current !== id) return;
        const merged = [...sonosResults, ...spotifyResults];
        const seen = new Set();
        const deduped = merged.filter((r) => {
          if (!r.uri || seen.has(r.uri)) return false;
          seen.add(r.uri);
          return true;
        });
        setResults(deduped);
        setLoading(false);
      } catch (err) {
        if (reqIdRef.current === id) {
          setError(err.message || 'Search failed');
          setResults([]);
          setLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, visible, sonosIp, spotifyOn]);

  const onSelect = useCallback(
    async (item) => {
      if (!sonosIp) {
        hide();
        return;
      }
      try {
        if (item.uri && item.uri.startsWith('spotify:')) {
          await playSpotifyURI(sonosIp, item.uri);
        } else {
          await playFavorite(sonosIp, item);
        }
      } catch (err) {
        console.warn('Sonos play error:', err);
      }
      hide();
    },
    [sonosIp, hide],
  );

  if (!visible) return null;

  const window = Dimensions.get('window');
  const PANEL_WIDTH = Math.min(720, Math.round(window.width * 0.7));
  const PANEL_MAX_HEIGHT = Math.round(window.height * 0.42);
  const PANEL_TOP = Math.max(24, Math.round(window.height * 0.04));

  const panelStyle = {
    position: 'absolute',
    top: PANEL_TOP,
    left: Math.round((window.width - PANEL_WIDTH) / 2),
    width: PANEL_WIDTH,
    maxHeight: PANEL_MAX_HEIGHT,
  };

  const panelAnimStyle = {
    opacity: slideAnim,
    transform: [{
      translateY: slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [30, 0],
      }),
    }],
  };

  const sourceLabel = (source) => {
    switch (source) {
      case 'favorite': return 'Favorite';
      case 'playlist': return 'Playlist';
      case 'album': return 'Album';
      case 'track': return 'Track';
      case 'spotify-playlist': return 'Spotify · Playlist';
      case 'spotify-album': return 'Spotify · Album';
      case 'spotify-track': return 'Spotify · Track';
      default: return source || '';
    }
  };

  return (
    <Modal
      visible={true}
      animationType="none"
      transparent={true}
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={hide}>
      <Animated.View style={[styles.overlay, {opacity: fadeAnim}]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={hide} />
        <Animated.View
          style={[
            styles.panel,
            panelStyle,
            panelAnimStyle,
          ]}>
          <View style={styles.searchRow}>
            <Icon name="magnify" size={20} color="#888" />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder={translate('searchSonosPlaceholder', lang)}
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {loading ? <ActivityIndicator size="small" color="#888" /> : null}
          </View>

          {!sonosIp ? (
            <Text style={styles.hint}>{translate('searchNeedsSonos', lang)}</Text>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
              {results.length === 0 && query.trim() && !loading ? (
                <Text style={styles.empty}>{translate('noResults', lang)}</Text>
              ) : (
                results.map((item, i) => (
                  <TouchableOpacity
                    key={`${item.uri}-${i}`}
                    style={styles.item}
                    onPress={() => onSelect(item)}>
                    {item.albumArtURI ? (
                      <Image source={{uri: item.albumArtURI}} style={styles.cover} />
                    ) : (
                      <View style={[styles.cover, styles.coverFallback]}>
                        <Icon name="music" size={20} color="#666" />
                      </View>
                    )}
                    <View style={styles.itemText}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.itemSub} numberOfLines={1}>
                        {[sourceLabel(item.source), item.creator].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    backgroundColor: 'rgba(20,20,20,0.97)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 4,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  cover: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#222',
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  itemSub: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  empty: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  hint: {
    color: '#888',
    fontSize: 12,
    padding: 12,
    lineHeight: 16,
  },
  error: {
    color: '#ff8888',
    fontSize: 12,
    padding: 12,
  },
});

export default SearchPopup;
