import React, {useState, useEffect} from 'react';
import {View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, ScrollView, Alert, Linking, Platform} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../../store';
import {translate} from '../../utils/translations';
import SonosScanner from './SonosScanner';
import DropdownPicker from './DropdownPicker';
import {getZoneGroups, getCoordinatorIp, getSonosFavorites, getSonosPlaylists, getMediaInfo} from '../../services/sonosService';
import {startOAuthFlow as startSpotifyOAuth, isSpotifyConnected, clearTokens as clearSpotifyTokens, CLIENT_ID as SPOTIFY_CLIENT_ID} from '../../services/spotifyOAuthService';

const MusicTab = ({form, updateField, lang, Section, Field}) => {
  const [groupOptions, setGroupOptions] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [fetchingFavorites, setFetchingFavorites] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [favFilter, setFavFilter] = useState('');
  const [nowPlaying, setNowPlaying] = useState(null);
  const [addingCurrent, setAddingCurrent] = useState(false);
  const [spotifyConnected, setSpotifyConnectedLocal] = useState(false);
  const spotifyConnectedStore = useStore((s) => s.spotifyConnected);
  const setSpotifyConnectedStore = useStore((s) => s.setSpotifyConnected);

  useEffect(() => {
    isSpotifyConnected().then(setSpotifyConnectedLocal);
  }, [spotifyConnectedStore]);

  const handleSpotifyConnect = async () => {
    try {
      const url = await startSpotifyOAuth();
      if (Platform.OS === 'web') {
        // Same-tab navigation so the OAuth redirect returns into the app
        window.location.assign(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      Alert.alert('Spotify', err.message || 'Could not start Spotify login');
    }
  };

  const handleSpotifyDisconnect = async () => {
    await clearSpotifyTokens();
    setSpotifyConnectedStore(false);
    setSpotifyConnectedLocal(false);
  };

  const quickPicks = form.quickPicks || [];

  const fetchGroups = async (ip) => {
    if (!ip) return;
    setLoadingGroups(true);
    try {
      const groups = await getZoneGroups(ip);
      setGroupOptions(groups);
    } catch {
      setGroupOptions([]);
    }
    setLoadingGroups(false);
  };

  const fetchLibrary = async (ip) => {
    if (!ip) return;
    setFetchingFavorites(true);
    try {
      const [favs, pls] = await Promise.all([
        getSonosFavorites(ip),
        getSonosPlaylists(ip),
      ]);
      setFavorites(favs);
      setPlaylists(pls);
    } catch {
      setFavorites([]);
      setPlaylists([]);
    }
    setFetchingFavorites(false);
  };

  useEffect(() => {
    if (form.sonosIp) {
      fetchGroups(form.sonosIp);
      fetchLibrary(form.sonosIp);
    }
  }, []);

  const MAX_CATEGORIES = 5;

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name || quickPicks.length >= MAX_CATEGORIES) return;
    const updated = [...quickPicks, {name, items: []}];
    updateField('quickPicks', updated);
    setNewCategoryName('');
    setShowNewCategory(false);
    setSelectedCategory(updated.length - 1);
  };

  const deleteCategory = (index) => {
    const name = quickPicks[index]?.name || '';
    Alert.alert(
      translate('deleteCategory', lang),
      `${name}?`,
      [
        {text: translate('cancel', lang), style: 'cancel'},
        {
          text: translate('delete', lang),
          style: 'destructive',
          onPress: () => {
            const updated = quickPicks.filter((_, i) => i !== index);
            updateField('quickPicks', updated);
            if (selectedCategory === index) setSelectedCategory(null);
            else if (selectedCategory > index) setSelectedCategory(selectedCategory - 1);
          },
        },
      ],
    );
  };

  const renameCategory = (index, name) => {
    const updated = quickPicks.map((cat, i) =>
      i === index ? {...cat, name} : cat,
    );
    updateField('quickPicks', updated);
  };

  const addFavoriteToCategory = (favorite) => {
    if (selectedCategory === null) return;
    const updated = quickPicks.map((cat, i) => {
      if (i !== selectedCategory) return cat;
      if (cat.items.some((item) => item.uri === favorite.uri)) return cat;
      return {...cat, items: [...cat.items, favorite]};
    });
    updateField('quickPicks', updated);
  };

  const removeFavoriteFromCategory = (categoryIndex, uri) => {
    const updated = quickPicks.map((cat, i) => {
      if (i !== categoryIndex) return cat;
      return {...cat, items: cat.items.filter((item) => item.uri !== uri)};
    });
    updateField('quickPicks', updated);
  };

  const addCurrentlyPlaying = async () => {
    if (selectedCategory === null || !form.sonosIp) return;
    setAddingCurrent(true);
    try {
      const media = await getMediaInfo(form.sonosIp);
      if (!media || !media.uri) {
        Alert.alert('Nothing playing', 'No media is currently playing on Sonos.');
        return;
      }
      const item = {title: media.title || 'Unknown', uri: media.uri};
      // Check if already in category
      if (quickPicks[selectedCategory]?.items.some((i) => i.uri === item.uri)) {
        Alert.alert('Already added', `"${item.title}" is already in this category.`);
        return;
      }
      const updated = quickPicks.map((cat, i) => {
        if (i !== selectedCategory) return cat;
        return {...cat, items: [...cat.items, item]};
      });
      updateField('quickPicks', updated);
    } catch {
      Alert.alert('Error', 'Could not get current playback info.');
    } finally {
      setAddingCurrent(false);
    }
  };

  const isFavoriteInSelected = (uri) => {
    if (selectedCategory === null) return false;
    return quickPicks[selectedCategory]?.items.some((item) => item.uri === uri) || false;
  };

  const allItems = [...favorites, ...playlists];
  const displayItems = favFilter.trim()
    ? allItems.filter((f) => f.title.toLowerCase().includes(favFilter.toLowerCase()))
    : allItems;

  return (
    <View style={styles.root}>
      <Section title="Sonos">
        <View style={styles.sonosRow}>
          <View style={styles.sonosLeft}>
            {loadingGroups ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#cccccc" />
                <Text style={styles.loadingText}>{translate('loadingGroups', lang)}</Text>
              </View>
            ) : groupOptions.length > 0 ? (
              <DropdownPicker
                label={translate('sonosGroup', lang)}
                value={form.sonosGroup}
                options={groupOptions}
                onValueChange={(v) => {
                  updateField('sonosGroup', v);
                  const group = groupOptions.find((g) => g.value === v);
                  if (group && group.coordinatorIp) {
                    updateField('sonosIp', group.coordinatorIp);
                  }
                }}
                placeholder="Select group..."
              />
            ) : (
              <Field
                label={translate('sonosGroup', lang)}
                value={form.sonosGroup}
                onChangeText={(v) => updateField('sonosGroup', v)}
                placeholder="Kitchen"
              />
            )}

            <View style={styles.scannerSpotifyRow}>
              <View style={styles.scannerCol}>
                {form.sonosName ? (
                  <Text style={styles.selectedDevice}>
                    {translate('selectedDevice', lang)}: {form.sonosName}
                  </Text>
                ) : null}

                <SonosScanner
                  onSelectDevice={async (ip, name, room) => {
                    updateField('sonosName', room || name || '');
                    const coordinatorIp = await getCoordinatorIp(ip);
                    updateField('sonosIp', coordinatorIp);
                    fetchGroups(coordinatorIp);
                    fetchLibrary(coordinatorIp);
                  }}
                  lang={lang}
                />
              </View>

              <View style={styles.spotifyInline}>
                <Text style={styles.spotifyLabel}>{translate('spotifySearch', lang)}</Text>
                {!SPOTIFY_CLIENT_ID ? (
                  <Text style={styles.howto}>{translate('spotifyClientIdMissing', lang)}</Text>
                ) : spotifyConnected ? (
                  <View style={styles.spotifyRow}>
                    <Icon name="check-circle" size={16} color="#4caf50" />
                    <Text style={styles.spotifyConnected} numberOfLines={1}>
                      {translate('spotifyConnected', lang)}
                    </Text>
                    <TouchableOpacity onPress={handleSpotifyDisconnect} style={styles.spotifyDisconnect}>
                      <Text style={styles.spotifyDisconnectText}>{translate('disconnect', lang)}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.spotifyConnectBtn} onPress={handleSpotifyConnect}>
                    <Icon name="link" size={16} color="#ffffff" />
                    <Text style={styles.spotifyConnectText}>{translate('connectSpotify', lang)}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <View style={styles.sonosRight}>
            <Field
              label={translate('sonosIp', lang)}
              value={form.sonosIp}
              onChangeText={(v) => updateField('sonosIp', v)}
              placeholder="192.168.1.100"
            />
            <Field
              label={translate('sonosRegion', lang)}
              value={form.sonosRegion}
              onChangeText={(v) => updateField('sonosRegion', v)}
              placeholder="2311 (EU)"
            />
          </View>
        </View>
      </Section>

      <Section title={translate('quickPicks', lang)} style={{flex: 1}}>
        <View style={styles.panelRow}>
          {/* Left: Categories */}
          <View style={styles.categoriesPanel}>
            <Text style={styles.panelTitle}>{translate('categories', lang)}</Text>
            <ScrollView style={styles.categoriesScroll} nestedScrollEnabled>
              {quickPicks.map((category, catIndex) => (
                <TouchableOpacity
                  key={catIndex}
                  style={[
                    styles.categoryCard,
                    selectedCategory === catIndex && styles.categoryCardSelected,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedCategory(selectedCategory === catIndex ? null : catIndex);
                    if (editingCategory !== catIndex) setEditingCategory(null);
                  }}>
                  <View style={styles.categoryHeader}>
                    {editingCategory === catIndex ? (
                      <TextInput
                        style={styles.categoryNameInput}
                        value={category.name}
                        onChangeText={(v) => renameCategory(catIndex, v)}
                        autoFocus
                        onBlur={() => setEditingCategory(null)}
                        onSubmitEditing={() => setEditingCategory(null)}
                        placeholderTextColor="#666"
                      />
                    ) : (
                      <Text style={styles.categoryNameText}>{category.name}</Text>
                    )}
                    <TouchableOpacity
                      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                      onPress={() => setEditingCategory(
                        editingCategory === catIndex ? null : catIndex,
                      )}>
                      <Icon name="pencil-outline" size={14} color="#888" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                      onPress={() => deleteCategory(catIndex)}>
                      <Icon name="delete-outline" size={16} color="#ff5555" />
                    </TouchableOpacity>
                  </View>

                  {category.items.length > 0 && (
                    <View style={styles.itemsWrap}>
                      {category.items.map((item, itemIndex) => (
                        <View key={itemIndex} style={styles.itemChip}>
                          <Text style={styles.itemText} numberOfLines={1}>{item.title}</Text>
                          <TouchableOpacity
                            onPress={() => removeFavoriteFromCategory(catIndex, item.uri)}
                            hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}>
                            <Icon name="close-circle" size={14} color="#666" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {category.items.length === 0 && (
                    <Text style={styles.emptyHint}>
                      {selectedCategory === catIndex
                        ? translate('tapToAdd', lang)
                        : translate('noItems', lang)}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}

              {/* Add new category */}
              {showNewCategory ? (
                <View style={styles.newCategoryRow}>
                  <TextInput
                    style={styles.newCategoryInput}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    placeholder={translate('categoryName', lang)}
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={addCategory}
                  />
                  <TouchableOpacity onPress={addCategory}>
                    <Icon name="check" size={18} color="#4caf50" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowNewCategory(false); setNewCategoryName(''); }}>
                    <Icon name="close" size={18} color="#888" />
                  </TouchableOpacity>
                </View>
              ) : quickPicks.length < MAX_CATEGORIES ? (
                <TouchableOpacity
                  style={styles.addCategoryBtn}
                  onPress={() => setShowNewCategory(true)}>
                  <Icon name="plus" size={16} color="#cccccc" />
                  <Text style={styles.addCategoryText}>{translate('addCategory', lang)} ({quickPicks.length}/{MAX_CATEGORIES})</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>

          {/* Right: Favorites & Playlists */}
          <View style={styles.favoritesPanel}>
            <View style={styles.favHeader}>
              <Text style={styles.panelTitle}>{translate('library', lang)}</Text>
              {selectedCategory !== null && form.sonosIp ? (
                <TouchableOpacity
                  style={styles.addCurrentBtn}
                  disabled={addingCurrent}
                  onPress={addCurrentlyPlaying}>
                  <Icon name="playlist-plus" size={16} color="#cccccc" />
                  <Text style={styles.addCurrentText}>
                    {addingCurrent ? '...' : translate('addNowPlaying', lang)}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {!fetchingFavorites && form.sonosIp && (
                <TouchableOpacity
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  onPress={() => fetchLibrary(form.sonosIp)}>
                  <Icon name="refresh" size={16} color="#888" />
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={styles.filterInput}
              value={favFilter}
              onChangeText={setFavFilter}
              placeholder={translate('filter', lang)}
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <ScrollView style={styles.favScroll} nestedScrollEnabled>
              {fetchingFavorites ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#cccccc" />
                </View>
              ) : displayItems.length === 0 ? (
                <Text style={styles.emptyText}>
                  {allItems.length === 0
                    ? translate('noFavorites', lang)
                    : translate('noResults', lang)}
                </Text>
              ) : (
                displayItems.map((fav, i) => {
                  const inSelected = isFavoriteInSelected(fav.uri);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.favItem, inSelected && styles.favItemAdded]}
                      disabled={selectedCategory === null}
                      onPress={() => {
                        if (inSelected) {
                          removeFavoriteFromCategory(selectedCategory, fav.uri);
                        } else {
                          addFavoriteToCategory(fav);
                        }
                      }}>
                      <Icon
                        name={inSelected ? 'check-circle' : 'plus-circle-outline'}
                        size={16}
                        color={selectedCategory === null ? '#444' : inSelected ? '#4caf50' : '#cccccc'}
                      />
                      <View style={styles.favItemContent}>
                        <Text
                          style={[
                            styles.favText,
                            selectedCategory === null && styles.favTextDisabled,
                          ]}
                          numberOfLines={1}>
                          {fav.title}
                        </Text>
                        {fav.source && (
                          <Text style={styles.favSource}>{fav.source}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <Text style={styles.howto}>{translate('favoritesHint', lang)}</Text>
            <Text style={styles.howto}>{translate('quickPicksHint', lang)}</Text>
          </View>
        </View>
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  sonosRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sonosLeft: {
    flex: 1,
  },
  sonosRight: {
    width: 160,
  },
  selectedDevice: {
    color: '#aaaaaa',
    fontSize: 12,
    marginBottom: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 8,
  },
  loadingText: {
    color: '#888',
    fontSize: 12,
  },
  root: {
    flex: 1,
  },
  addCurrentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addCurrentText: {
    color: '#cccccc',
    fontSize: 11,
  },
  panelRow: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
  },
  categoriesPanel: {
    flex: 1,
  },
  favoritesPanel: {
    flex: 1,
  },
  panelTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  categoriesScroll: {
    flex: 1,
  },
  categoryCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  categoryCardSelected: {
    borderColor: '#cccccc',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryNameText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryNameInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  itemsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 3,
    paddingLeft: 8,
    paddingRight: 4,
    gap: 3,
  },
  itemText: {
    color: '#cccccc',
    fontSize: 11,
    maxWidth: 120,
  },
  emptyHint: {
    color: '#555',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  addCategoryText: {
    color: '#cccccc',
    fontSize: 12,
  },
  newCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  newCategoryInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#ffffff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  favHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  filterInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#ffffff',
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 6,
  },
  favScroll: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  favItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  favItemAdded: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  favItemContent: {
    flex: 1,
  },
  favText: {
    color: '#cccccc',
    fontSize: 12,
  },
  favSource: {
    color: '#666',
    fontSize: 10,
  },
  favTextDisabled: {
    color: '#555',
  },
  howto: {
    color: '#666',
    fontSize: 10,
    marginTop: 6,
    lineHeight: 14,
  },
  emptyText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    padding: 12,
    textAlign: 'center',
  },
  scannerSpotifyRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  scannerCol: {
    flexShrink: 0,
  },
  spotifyInline: {
    flex: 1,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#2a2a2a',
  },
  spotifyLabel: {
    color: '#aaaaaa',
    fontSize: 12,
    marginBottom: 6,
  },
  spotifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spotifyConnected: {
    color: '#cccccc',
    fontSize: 13,
    flex: 1,
  },
  spotifyDisconnect: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
  },
  spotifyDisconnectText: {
    color: '#cccccc',
    fontSize: 12,
  },
  spotifyConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1DB954',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  spotifyConnectText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default MusicTab;
