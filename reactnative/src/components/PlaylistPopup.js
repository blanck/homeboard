import React, {useCallback, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import useStore from '../store';
import * as sonosService from '../services/sonosService';
import {translate} from '../utils/translations';

const PlaylistPopup = () => {
  const visible = useStore((s) => s.playlistPopupVisible);
  const playlist = useStore((s) => s.currentPlaylist);
  const hidePlaylist = useStore((s) => s.hidePlaylist);
  const quickPickVisible = useStore((s) => s.quickPickPopupVisible);
  const quickPick = useStore((s) => s.currentQuickPick);
  const hideQuickPick = useStore((s) => s.hideQuickPick);
  const anchor = useStore((s) => s.popupAnchor);
  const config = useStore((s) => s.config);
  const showToast = useStore((s) => s.showToast);
  const sonosIp = config.sonos?.ip;
  const lang = config.language || 'en';

  const reportResult = useCallback(
    (result) => {
      if (!result?.ok) showToast(translate('couldNotPlay', lang));
    },
    [showToast, lang],
  );

  const isQuickPick = quickPickVisible && quickPick;
  const isPlaylist = visible && playlist;
  const isVisible = isQuickPick || isPlaylist;

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
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
    }
  }, [isVisible, slideAnim, fadeAnim]);

  const onSelectItem = useCallback(
    async (listItem) => {
      if (!sonosIp) return;
      hidePlaylist();
      if (playlist.type === 'spotify') {
        reportResult(await sonosService.playSpotifyURI(sonosIp, listItem[0], config.sonos?.region));
      } else if (playlist.type === 'radio') {
        reportResult(await sonosService.playRadio(sonosIp, listItem[0], listItem[1]));
      }
    },
    [sonosIp, playlist, config.sonos?.region, hidePlaylist, reportResult],
  );

  const onSelectQuickPickItem = useCallback(
    async (item) => {
      if (!sonosIp) return;
      hideQuickPick();
      reportResult(await sonosService.playFavorite(sonosIp, item));
    },
    [sonosIp, hideQuickPick, reportResult],
  );

  if (!isVisible) return null;

  const hide = isQuickPick ? hideQuickPick : hidePlaylist;
  const title = isQuickPick ? quickPick.name : playlist?.title;
  const rawData = isQuickPick ? quickPick.items : playlist?.list;
  const data = Array.isArray(rawData) ? rawData : Object.values(rawData || {});
  const onSelect = isQuickPick ? onSelectQuickPickItem : onSelectItem;
  const renderLabel = isQuickPick
    ? (item) => item.title
    : (item) => (Array.isArray(item) ? item[1] : String(item));

  const window = Dimensions.get('window');

  // Calculate panel position: anchored above the button, expanding upward
  const PANEL_MIN_WIDTH = 250;
  let panelStyle = {};
  if (anchor) {
    const panelWidth = Math.max(PANEL_MIN_WIDTH, anchor.width);
    const left = Math.max(8, Math.min(
      anchor.x,
      window.width - panelWidth - 8,
    ));
    const panelBottom = window.height - anchor.y;
    panelStyle = {
      position: 'absolute',
      bottom: panelBottom,
      left,
      minWidth: panelWidth,
    };
  }

  const panelAnimStyle = {
    opacity: slideAnim,
    transform: [{
      translateY: slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [30, 0],
      }),
    }],
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
            anchor ? panelStyle : styles.panelCentered,
            panelAnimStyle,
          ]}>
          {data.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.item}
              onPress={() => onSelect(item)}>
              <Text style={styles.itemText}>{renderLabel(item)}</Text>
            </TouchableOpacity>
          ))}
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
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  panelCentered: {
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
    minWidth: 200,
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    opacity: 0.6,
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  itemText: {
    color: '#ffffff',
    fontSize: 22,
  },
});

export default PlaylistPopup;
