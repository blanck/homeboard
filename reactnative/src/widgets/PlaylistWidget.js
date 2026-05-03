import React, {useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {translate} from '../utils/translations';
import {fs, sp} from '../utils/scale';

const MAX_QUICK_PICKS = 5;

const PlaylistWidget = () => {
  const config = useStore((s) => s.config);
  const showPlaylist = useStore((s) => s.showPlaylist);
  const showQuickPick = useStore((s) => s.showQuickPick);
  const showSearch = useStore((s) => s.showSearch);
  const lang = config.language || 'en';
  const refs = useRef({});

  const playlists = config.playlist ? Object.entries(config.playlist) : [];
  const quickPicks = config.quickPicks || [];

  const measureAndShow = (refKey, callback) => {
    const ref = refs.current[refKey];
    if (ref) {
      ref.measureInWindow((x, y, width, height) => {
        callback({x, y, width, height});
      });
    } else {
      callback(null);
    }
  };

  const cappedQuickPicks = quickPicks.slice(0, MAX_QUICK_PICKS);
  const remainingSlots = MAX_QUICK_PICKS - cappedQuickPicks.length;
  const cappedPlaylists = playlists.slice(0, remainingSlots);

  const dataButtons = [
    ...cappedQuickPicks.map((category, index) => ({
      key: `qp-${index}`,
      label: category.name,
      icon: 'music',
      onPress: (anchor) => showQuickPick(category, anchor),
    })),
    ...cappedPlaylists.map(([key, item]) => ({
      key,
      label: item.title,
      icon: 'music',
      onPress: (anchor) => showPlaylist({key, ...item}, anchor),
    })),
  ];

  const searchButton = {
    key: 'search',
    label: translate('search', lang),
    icon: 'magnify',
    onPress: (anchor) => showSearch(anchor),
  };

  const allButtons = [...dataButtons, searchButton];

  const ROW_COUNT = 3;
  const left = allButtons.slice(0, ROW_COUNT);
  const right = allButtons.slice(ROW_COUNT, ROW_COUNT * 2);

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <View style={styles.column}>
          {left.map((btn) => (
            <TouchableOpacity
              key={btn.key}
              ref={(r) => { refs.current[btn.key] = r; }}
              style={styles.button}
              onPress={() => measureAndShow(btn.key, btn.onPress)}>
              <Icon name={btn.icon} size={sp(18)} color="#ffffff" style={styles.icon} />
              <Text style={styles.buttonText} numberOfLines={1}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.column}>
          {right.map((btn) => (
            <TouchableOpacity
              key={btn.key}
              ref={(r) => { refs.current[btn.key] = r; }}
              style={styles.button}
              onPress={() => measureAndShow(btn.key, btn.onPress)}>
              <Icon name={btn.icon} size={sp(18)} color="#ffffff" style={styles.icon} />
              <Text style={styles.buttonText} numberOfLines={1}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    margin: 4,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  column: {
    width: '48%',
    gap: 8,
  },
  button: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: fs(12),
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});

export default PlaylistWidget;
