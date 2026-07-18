import React, {useEffect, useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useStore from '../store';
import * as sonosService from '../services/sonosService';
import {translate} from '../utils/translations';
import {fs, sp} from '../utils/scale';

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

// Per-speaker volume control for the current Sonos group, like the group
// volume view in the Sonos app: one master row plus a row per speaker
const GroupVolumePopup = () => {
  const visible = useStore((s) => s.groupVolumeVisible);
  const hide = useStore((s) => s.hideGroupVolume);
  const config = useStore((s) => s.config);
  const sonosIp = config.sonos?.ip;
  const lang = config.language || 'en';

  const [speakers, setSpeakers] = useState([]);
  const lastTouchRef = useRef(0);
  const barWidthsRef = useRef({});

  useEffect(() => {
    if (!visible || !sonosIp) {
      setSpeakers([]);
      return;
    }
    let alive = true;
    const load = async () => {
      const members = await sonosService.getGroupMembers(sonosIp);
      const volumes = await Promise.all(
        members.map((m) => sonosService.getVolume(m.ip)),
      );
      if (!alive) return;
      // Don't clobber optimistic values while the user is adjusting
      if (Date.now() - lastTouchRef.current < 2500) return;
      setSpeakers(
        members.map((m, i) => ({...m, volume: volumes[i] ?? 0})),
      );
    };
    load();
    const timer = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [visible, sonosIp]);

  const setSpeakerVolume = useCallback((ip, volume) => {
    const vol = clamp(volume);
    lastTouchRef.current = Date.now();
    setSpeakers((prev) =>
      prev.map((s) => (s.ip === ip ? {...s, volume: vol} : s)),
    );
    sonosService.setVolume(ip, vol);
  }, []);

  const adjustAll = useCallback(
    (delta) => {
      speakers.forEach((s) => setSpeakerVolume(s.ip, s.volume + delta));
    },
    [speakers, setSpeakerVolume],
  );

  const onBarPress = useCallback(
    (key, e, apply) => {
      const width = barWidthsRef.current[key];
      const x = e?.nativeEvent?.locationX;
      if (width > 0 && x != null) {
        apply((x / width) * 100);
      }
    },
    [],
  );

  if (!visible) return null;

  const average =
    speakers.length > 0
      ? speakers.reduce((sum, s) => sum + s.volume, 0) / speakers.length
      : 0;

  const renderBar = (key, value, apply) => (
    <Pressable
      style={styles.bar}
      hitSlop={{top: 14, bottom: 14}}
      onLayout={(e) => {
        barWidthsRef.current[key] = e.nativeEvent.layout.width;
      }}
      onPress={(e) => onBarPress(key, e, apply)}>
      <View style={[styles.barFill, {width: `${clamp(value)}%`}]} />
    </Pressable>
  );

  const renderRow = (key, label, value, apply) => (
    <View key={key} style={styles.speakerBlock}>
      <View style={styles.labelRow}>
        <Text style={styles.speakerName} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.volumeText}>{clamp(value)}</Text>
      </View>
      <View style={styles.controlRow}>
        <TouchableOpacity
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          onPress={() => apply(value - 2)}>
          <Icon name="volume-down" size={26} color="#ffffff" />
        </TouchableOpacity>
        {renderBar(key, value, apply)}
        <TouchableOpacity
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          onPress={() => apply(value + 2)}>
          <Icon name="volume-up" size={26} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={true}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={hide}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={hide} />
        <View style={styles.panel}>
          {speakers.length > 1
            ? renderRow('group', translate('groupVolume', lang), average, (v) =>
                adjustAll(v - average),
              )
            : null}
          {speakers.map((s) =>
            renderRow(s.ip, s.name || 'Sonos', s.volume, (v) =>
              setSpeakerVolume(s.ip, v),
            ),
          )}
          {speakers.length === 0 ? (
            <Text style={styles.loading}>...</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
  },
  panel: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 10,
    paddingVertical: sp(12),
    paddingHorizontal: sp(16),
    alignSelf: 'center',
    width: sp(360),
    maxWidth: '90%',
  },
  speakerBlock: {
    paddingVertical: sp(8),
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp(4),
  },
  speakerName: {
    color: '#ffffff',
    fontSize: fs(14),
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  volumeText: {
    color: '#888888',
    fontSize: fs(13),
    fontVariant: ['tabular-nums'],
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(10),
  },
  bar: {
    flex: 1,
    height: 5,
    backgroundColor: '#444444',
    borderRadius: 3,
    justifyContent: 'center',
  },
  barFill: {
    height: 5,
    backgroundColor: '#0B77EF',
    borderRadius: 3,
  },
  loading: {
    color: '#888888',
    fontSize: fs(14),
    textAlign: 'center',
    paddingVertical: 12,
  },
});

export default GroupVolumePopup;
