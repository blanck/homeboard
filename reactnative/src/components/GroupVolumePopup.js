import React, {useEffect, useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import * as sonosService from '../services/sonosService';
import {translate} from '../utils/translations';
import {fs, sp} from '../utils/scale';

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
const SEND_THROTTLE_MS = 150;
const VOLUME_POLL_MS = 3000;
// Group membership changes rarely; GetZoneGroupState is the heaviest Sonos reply
const TOPOLOGY_REFRESH_MS = 15000;

const snapshot = (speakers) => ({
  vols: Object.fromEntries(speakers.map((s) => [s.ip, s.volume])),
  avg: speakers.reduce((sum, s) => sum + s.volume, 0) / (speakers.length || 1),
});

// Per-speaker volume control for the current Sonos group, like the group
// volume view in the Sonos app: a master row, a draggable slider per
// speaker, and rows to add/remove speakers from the group
const GroupVolumePopup = () => {
  const visible = useStore((s) => s.groupVolumeVisible);
  const hide = useStore((s) => s.hideGroupVolume);
  const anchor = useStore((s) => s.popupAnchor);
  const config = useStore((s) => s.config);
  const asleep = useStore((s) => s.asleep);
  const sonosIp = config.sonos?.ip;
  const lang = config.language || 'en';

  const [speakers, setSpeakers] = useState([]);
  const [available, setAvailable] = useState([]);
  const [coordinatorIp, setCoordinatorIp] = useState(null);
  const lastTouchRef = useRef(0);
  const topologyRef = useRef(null);
  const barGeomRef = useRef({});
  const barRefs = useRef({});
  const sendPendingRef = useRef({});
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
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
  }, [visible, slideAnim, fadeAnim]);

  const load = useCallback(async (refreshTopology = true) => {
    if (!sonosIp) return;
    let topo = topologyRef.current;
    if (refreshTopology || !topo || Date.now() - topo.at > TOPOLOGY_REFRESH_MS) {
      const groups = await sonosService.getZoneGroups(sonosIp);
      const mine = groups.find((g) => g.members.some((m) => m.ip === sonosIp));
      topo = {
        members: mine ? mine.members : [{name: '', ip: sonosIp}],
        others: groups.filter((g) => g !== mine).flatMap((g) => g.members),
        coordinatorIp: mine ? mine.coordinatorIp : sonosIp,
        at: Date.now(),
      };
      topologyRef.current = topo;
    }
    const {members, others} = topo;
    const volumes = await Promise.all(
      members.map((m) => sonosService.getVolume(m.ip)),
    );
    // Don't clobber optimistic values while the user is adjusting
    if (Date.now() - lastTouchRef.current < 2500) return;
    setCoordinatorIp(topo.coordinatorIp);
    setSpeakers(members.map((m, i) => ({...m, volume: volumes[i] ?? 0})));
    setAvailable(others);
  }, [sonosIp]);

  useEffect(() => {
    if (!visible) {
      topologyRef.current = null;
      setSpeakers([]);
      setAvailable([]);
      return;
    }
    if (asleep) return;
    load();
    const timer = setInterval(() => load(false), VOLUME_POLL_MS);
    return () => clearInterval(timer);
  }, [visible, asleep, load]);

  // Local state updates on every move; network sends are throttled per ip
  const setSpeakerVolume = useCallback((ip, volume) => {
    const vol = clamp(volume);
    lastTouchRef.current = Date.now();
    setSpeakers((prev) =>
      prev.map((s) => (s.ip === ip ? {...s, volume: vol} : s)),
    );
    const pending = sendPendingRef.current;
    if (pending[ip] !== undefined) {
      pending[ip] = vol;
      return;
    }
    pending[ip] = vol;
    setTimeout(() => {
      const latest = pending[ip];
      delete pending[ip];
      sonosService.setVolume(ip, latest);
    }, SEND_THROTTLE_MS);
  }, []);

  // Volumes when the group drag began: offsets from that snapshot, not from the
  // last move, so clamping one speaker at 0 or 100 does not drift the others
  const groupBaseRef = useRef(null);
  const [groupShown, setGroupShown] = useState(null);

  const setGroupVolume = useCallback(
    (target) => {
      const base =
        groupBaseRef.current ||
        snapshot(speakers);
      const delta = clamp(target) - base.avg;
      speakers.forEach((s) => setSpeakerVolume(s.ip, (base.vols[s.ip] ?? s.volume) + delta));
      if (groupBaseRef.current) setGroupShown(clamp(target));
    },
    [speakers, setSpeakerVolume],
  );

  const applyFromPageX = useCallback((key, pageX, apply) => {
    const bar = barGeomRef.current[key];
    if (bar && bar.width > 0 && pageX != null) {
      apply(((pageX - bar.x) / bar.width) * 100);
    }
  }, []);

  const beginDrag = useCallback(
    (key, e, apply) => {
      const pageX = e.nativeEvent.pageX;
      if (key === 'group') groupBaseRef.current = snapshot(speakers);
      const ref = barRefs.current[key];
      if (ref?.measureInWindow) {
        ref.measureInWindow((x, y, width) => {
          barGeomRef.current[key] = {x, width};
          applyFromPageX(key, pageX, apply);
        });
      }
    },
    [applyFromPageX, speakers],
  );

  const endDrag = useCallback((key) => {
    if (key !== 'group') return;
    groupBaseRef.current = null;
    setGroupShown(null);
  }, []);

  const addSpeaker = useCallback(
    async (ip) => {
      if (!coordinatorIp) return;
      setAvailable((prev) => prev.filter((s) => s.ip !== ip));
      await sonosService.joinGroup(ip, coordinatorIp);
      lastTouchRef.current = 0;
      setTimeout(load, 1000);
    },
    [coordinatorIp, load],
  );

  const removeSpeaker = useCallback(
    async (ip) => {
      setSpeakers((prev) => prev.filter((s) => s.ip !== ip));
      await sonosService.leaveGroup(ip);
      lastTouchRef.current = 0;
      setTimeout(load, 1000);
    },
    [load],
  );

  if (!visible) return null;

  // Anchored above the volume bar, centered over it, clamped to the screen
  const window = Dimensions.get('window');
  const PANEL_WIDTH = Math.min(sp(360), window.width - 16);
  let panelStyle = styles.panelCentered;
  if (anchor) {
    const left = Math.max(
      8,
      Math.min(
        anchor.x + anchor.width / 2 - PANEL_WIDTH / 2,
        window.width - PANEL_WIDTH - 8,
      ),
    );
    panelStyle = {
      position: 'absolute',
      bottom: window.height - anchor.y + 10,
      left,
      width: PANEL_WIDTH,
    };
  }

  const panelAnimStyle = {
    opacity: slideAnim,
    transform: [
      {
        translateY: slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [30, 0],
        }),
      },
    ],
  };

  const average =
    speakers.length > 0
      ? speakers.reduce((sum, s) => sum + s.volume, 0) / speakers.length
      : 0;

  const renderBar = (key, value, apply) => (
    <View
      ref={(r) => {
        barRefs.current[key] = r;
      }}
      style={styles.bar}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => beginDrag(key, e, apply)}
      onResponderMove={(e) => applyFromPageX(key, e.nativeEvent.pageX, apply)}
      onResponderRelease={() => endDrag(key)}
      onResponderTerminate={() => endDrag(key)}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, {width: `${clamp(value)}%`}]} />
      </View>
      <View style={[styles.thumb, {left: `${clamp(value)}%`}]} />
    </View>
  );

  const renderRow = (key, label, value, apply, removable) => (
    <View key={key} style={styles.speakerBlock}>
      <View style={styles.labelRow}>
        <Text style={styles.speakerName} numberOfLines={1}>
          {label}
        </Text>
        {removable ? (
          <TouchableOpacity
            style={styles.removeButton}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            onPress={() => removeSpeaker(key)}>
            <Icon name="close" size={18} color="#666666" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.volumeText}>{clamp(value)}</Text>
      </View>
      <View style={styles.controlRow}>
        <TouchableOpacity
          style={styles.stepButton}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          onPress={() => apply(value - 2)}>
          <Icon name="volume-medium" size={26} color="#ffffff" />
        </TouchableOpacity>
        {renderBar(key, value, apply)}
        <TouchableOpacity
          style={styles.stepButton}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          onPress={() => apply(value + 2)}>
          <Icon name="volume-high" size={26} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );

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
        <Animated.View style={[styles.panel, panelStyle, panelAnimStyle]}>
          {speakers.length > 1
            ? renderRow('group', translate('groupVolume', lang), groupShown ?? average, setGroupVolume)
            : null}
          {speakers.map((s) =>
            renderRow(
              s.ip,
              s.name || 'Sonos',
              s.volume,
              (v) => setSpeakerVolume(s.ip, v),
              speakers.length > 1 && s.ip !== coordinatorIp,
            ),
          )}
          {available.length > 0 ? <View style={styles.divider} /> : null}
          {available.map((s) => (
            <TouchableOpacity
              key={s.ip}
              style={styles.addRow}
              onPress={() => addSpeaker(s.ip)}>
              <Icon name="plus-circle-outline" size={22} color="#888888" />
              <Text style={styles.addName} numberOfLines={1}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
          {speakers.length === 0 ? (
            <Text style={styles.loading}>...</Text>
          ) : null}
        </Animated.View>
      </Animated.View>
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
  },
  panelCentered: {
    alignSelf: 'center',
    width: sp(360),
    maxWidth: '90%',
  },
  speakerBlock: {
    paddingVertical: sp(2),
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: sp(8),
  },
  speakerName: {
    color: '#ffffff',
    fontSize: fs(14),
    fontWeight: '600',
    flex: 1,
  },
  volumeText: {
    color: '#888888',
    fontSize: fs(13),
    fontVariant: ['tabular-nums'],
    minWidth: 24,
    textAlign: 'right',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(4),
  },
  // Real padding, since react-native-web ignores hitSlop
  stepButton: {
    padding: sp(8),
  },
  removeButton: {
    padding: sp(6),
  },
  // Tall touch target wrapping a thin visual track + thumb
  bar: {
    flex: 1,
    height: sp(52),
    justifyContent: 'center',
    // Without this the browser takes the touch as a pan and cancels the drag
    ...(Platform.OS === 'web' ? {touchAction: 'none'} : null),
  },
  barTrack: {
    height: 6,
    backgroundColor: '#444444',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: '#0B77EF',
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: sp(22),
    height: sp(22),
    borderRadius: sp(11),
    backgroundColor: '#ffffff',
    marginLeft: -sp(11),
    marginTop: -sp(11),
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: sp(8),
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(10),
    paddingVertical: sp(9),
  },
  addName: {
    color: '#cccccc',
    fontSize: fs(14),
    flex: 1,
  },
  loading: {
    color: '#888888',
    fontSize: fs(14),
    textAlign: 'center',
    paddingVertical: 12,
  },
});

export default GroupVolumePopup;
