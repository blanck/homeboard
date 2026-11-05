import React, {useEffect, useRef, useCallback, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import * as sonosService from '../services/sonosService';
import {fs, sp} from '../utils/scale';
import {translate} from '../utils/translations';

const SONOS_UUID_KEY = 'sonos_known_uuid';
// Re-checks an idle transport for a missing source; first check runs on entering idle
const QUEUE_RESET_INTERVAL_MS = 10 * 60000;
// A button press within this long of the last one reuses its group volume snapshot
const STEP_SESSION_MS = 3000;
// Sonos reports TRANSITIONING briefly after Play; keep the optimistic icon meanwhile
const COMMAND_SETTLE_MS = 3000;
// Min topology age before a grouping mismatch forces a refetch (stereo satellites never agree)
const TOPOLOGY_RECHECK_MS = 15000;

const SonosWidget = () => {
  const sonos = useStore((s) => s.sonos);
  const config = useStore((s) => s.config);
  const asleep = useStore((s) => s.asleep);
  const setSonosTrack = useStore((s) => s.setSonosTrack);
  const setSonosState = useStore((s) => s.setSonosState);
  const setSonosVolume = useStore((s) => s.setSonosVolume);
  const setSonosShuffle = useStore((s) => s.setSonosShuffle);
  const incrementSonosPosition = useStore((s) => s.incrementSonosPosition);
  const showGroupVolume = useStore((s) => s.showGroupVolume);
  const lang = useStore((s) => s.config.language || 'en');
  const [roomName, setRoomName] = useState(null);

  const volumeTimerRef = useRef(null);
  const lastQueueResetRef = useRef(0);
  const volumeBarRef = useRef(null);
  const volumeTouchRef = useRef(0);
  const failuresRef = useRef(0);
  const rediscoveringRef = useRef(false);
  const lastRediscoverRef = useRef(0);
  const persistedUuidRef = useRef(null);
  const pollNowRef = useRef(null);
  // seq changes whenever a command starts or ends; polls spanning a change are stale
  const commandRef = useRef({seq: 0, pending: 0, settleUntil: 0});
  // When the configured speaker is grouped, playback lives on the group
  // coordinator; volume stays on the configured device
  const coordinatorIpRef = useRef(null);
  const updateConfig = useStore((s) => s.updateConfig);
  const sonosIp = config.sonos?.ip;
  const sonosName = config.sonos?.name;
  const sonosGroup = config.sonos?.group;

  const rediscover = useCallback(async () => {
    if (rediscoveringRef.current) return;
    rediscoveringRef.current = true;
    lastRediscoverRef.current = Date.now();
    try {
      const devices = await sonosService.discoverSonosDevices(4000);
      if (!devices || devices.length === 0) return;

      const storedUuid = await AsyncStorage.getItem(SONOS_UUID_KEY);
      let match = null;

      if (storedUuid) {
        for (const d of devices) {
          const uuid = await sonosService.getDeviceUUID(d.ip);
          if (uuid && uuid === storedUuid) {match = d; break;}
        }
      }

      if (!match && (sonosName || sonosGroup)) {
        for (const d of devices) {
          const details = await sonosService.getDeviceDetails(d.ip);
          if (!details) continue;
          if (sonosName && details.name === sonosName) {match = d; break;}
          if (sonosGroup && details.room === sonosGroup) {match = d; break;}
        }
      }

      // Only fall back to devices[0] if there's a single Sonos on the network
      const next = match || (devices.length === 1 ? devices[0] : null);
      if (next && next.ip && next.ip !== sonosIp) {
        updateConfig({sonos: {...config.sonos, ip: next.ip}});
        failuresRef.current = 0;
      }
    } finally {
      rediscoveringRef.current = false;
    }
  }, [sonosIp, sonosName, sonosGroup, config.sonos, updateConfig]);
  const rediscoverRef = useRef(rediscover);
  rediscoverRef.current = rediscover;

  useEffect(() => {
    failuresRef.current = 0;
  }, [sonosIp]);

  useEffect(() => {
    if (!sonosIp || asleep) {
      return;
    }
    coordinatorIpRef.current = null;
    let stopped = false;
    let timer = null;
    let inFlight = false;
    let rerun = false;

    const poll = async () => {
      const seq = commandRef.current.seq;
      // Always poll the configured device first: it tells us whether it is
      // (still) a group member. Following a cached coordinator blindly left
      // the widget stuck on another room after the group dissolved
      let [track, state, volume, playMode] = await Promise.all([
        sonosService.getCurrentTrack(sonosIp),
        sonosService.getTransportState(sonosIp),
        sonosService
          .getGroupVolumes(sonosIp)
          .then((g) => (g.volumes.length ? Math.round(sonosService.averageVolume(g.volumes)) : null)),
        sonosService.getPlayMode(sonosIp),
      ]);
      if (track?.grouped) {
        const cIp =
          coordinatorIpRef.current || (await sonosService.getCoordinatorIp(sonosIp));
        if (cIp && cIp !== sonosIp) {
          coordinatorIpRef.current = cIp;
          [track, state, playMode] = await Promise.all([
            sonosService.getCurrentTrack(cIp),
            sonosService.getTransportState(cIp),
            sonosService.getPlayMode(cIp),
          ]);
          // Cached coordinator no longer leads this group; re-resolve next poll
          if (track?.grouped) {
            coordinatorIpRef.current = null;
            sonosService.invalidateGroupCache(TOPOLOGY_RECHECK_MS);
          }
        } else {
          // Device says grouped but the cached topology does not; refetch soon
          sonosService.invalidateGroupCache(TOPOLOGY_RECHECK_MS);
        }
      } else if (track) {
        coordinatorIpRef.current = null;
      }
      if (stopped) return;
      const allFailed = !track && !state && volume == null && !playMode;
      if (allFailed) {
        failuresRef.current += 1;
        coordinatorIpRef.current = null;
        if (sonosService.shouldRediscover(failuresRef.current, lastRediscoverRef.current, Date.now())) {
          rediscoverRef.current().catch((e) => console.warn('[poll rediscover]', e?.message || String(e)));
        }
        return;
      }
      const wasFailing = failuresRef.current > 0;
      failuresRef.current = 0;
      const cmd = commandRef.current;
      const fresh = cmd.pending === 0 && cmd.seq === seq;
      if (track && !track.grouped) setSonosTrack(track);
      if (state && fresh && !(state === 'transitioning' && Date.now() < cmd.settleUntil)) {
        setSonosState(state);
      }
      // A poll that started mid-drag would snap the bar back
      if (volume != null && Date.now() - volumeTouchRef.current > 2500) setSonosVolume(volume);
      if (playMode && fresh) setSonosShuffle(playMode.includes('SHUFFLE'));
      // A Spotify Connect session that moved away can leave the transport on no
      // source at all; point it back at its own queue so play and enqueue work
      const controlIp = coordinatorIpRef.current || sonosIp;
      const idle = sonosService.isIdleTrack(track);
      if (!idle) lastQueueResetRef.current = 0;
      if (
        idle &&
        state === 'stopped' &&
        Date.now() - lastQueueResetRef.current > QUEUE_RESET_INTERVAL_MS
      ) {
        lastQueueResetRef.current = Date.now();
        sonosService
          .getMediaInfo(controlIp)
          .then((info) => (info && !info.uri ? sonosService.selectQueue(controlIp) : null))
          .catch((e) => console.warn('[poll selectQueue]', e?.message || String(e)));
      }
      // Persist UUID for future rediscovery: once on first success or after recovery
      if (!persistedUuidRef.current || wasFailing) {
        sonosService.getDeviceUUID(sonosIp)
          .then((uuid) => {
            if (uuid) {
              persistedUuidRef.current = uuid;
              AsyncStorage.setItem(SONOS_UUID_KEY, uuid).catch(() => {});
            }
          })
          .catch((e) => console.warn('[poll getDeviceUUID]', e?.message || String(e)));
      }
    };

    const run = async () => {
      if (stopped) return;
      if (inFlight) {
        rerun = true;
        return;
      }
      clearTimeout(timer);
      inFlight = true;
      try {
        await poll();
      } catch (e) {
        console.warn('[sonos poll]', e?.message || String(e));
      } finally {
        inFlight = false;
      }
      if (stopped) return;
      if (rerun) {
        rerun = false;
        run();
        return;
      }
      timer = setTimeout(
        run,
        sonosService.nextPollDelay(useStore.getState().sonos.state, failuresRef.current),
      );
    };

    pollNowRef.current = run;
    run();
    return () => {
      stopped = true;
      clearTimeout(timer);
      if (pollNowRef.current === run) pollNowRef.current = null;
    };
  }, [sonosIp, asleep, setSonosTrack, setSonosState, setSonosVolume, setSonosShuffle]);

  useEffect(() => {
    setRoomName(null);
    if (!sonosIp) return;
    let cancelled = false;
    sonosService.getDeviceDetails(sonosIp).then((d) => {
      if (!cancelled && d?.room) setRoomName(d.room);
    });
    return () => {
      cancelled = true;
    };
  }, [sonosIp]);

  const isPlaying = sonos.state === 'playing';
  useEffect(() => {
    if (!sonosIp || !isPlaying || asleep) return;
    const timer = setInterval(incrementSonosPosition, 1000);
    return () => clearInterval(timer);
  }, [sonosIp, isPlaying, asleep, incrementSonosPosition]);

  // Polls right after the command so the UI settles without waiting a full interval
  const runCommand = useCallback(async (fn) => {
    const cmd = commandRef.current;
    cmd.seq += 1;
    cmd.pending += 1;
    try {
      await fn();
    } catch (e) {
      console.warn('[sonos command]', e?.message || String(e));
    } finally {
      cmd.pending -= 1;
      cmd.seq += 1;
      cmd.settleUntil = Date.now() + COMMAND_SETTLE_MS;
      pollNowRef.current?.();
    }
  }, []);

  const playPause = useCallback(() => {
    if (!sonosIp) return;
    const known = useStore.getState().sonos.state;
    setSonosState(known === 'playing' ? 'paused' : 'playing');
    runCommand(() => sonosService.togglePlayback(coordinatorIpRef.current || sonosIp, known));
  }, [sonosIp, setSonosState, runCommand]);

  const playNext = useCallback(() => {
    if (!sonosIp) return;
    runCommand(() => sonosService.nextTrack(coordinatorIpRef.current || sonosIp));
  }, [sonosIp, runCommand]);

  const toggleShuffle = useCallback(() => {
    if (!sonosIp) return;
    const previous = sonos.shuffle;
    setSonosShuffle(!previous);
    runCommand(() =>
      sonosService
        .setPlayMode(coordinatorIpRef.current || sonosIp, previous ? 'NORMAL' : 'SHUFFLE')
        .catch((e) => {
          setSonosShuffle(previous);
          throw e;
        }),
    );
  }, [sonosIp, sonos.shuffle, setSonosShuffle, runCommand]);

  // One send in flight per gesture; offsets apply to the snapshot taken at its start
  const sendGroupVolume = useCallback((d) => {
    if (!d || !d.base || d.target == null || d.sending) return;
    d.sending = true;
    const {ips, volumes} = d.base;
    const target = d.target;
    sonosService
      .setGroupVolumes(ips, sonosService.offsetVolumes(volumes, target - sonosService.averageVolume(volumes)))
      .finally(() => {
        d.sending = false;
        if (d.target !== target) setTimeout(() => sendGroupVolume(d), 120);
      });
  }, []);

  const loadGroupBase = useCallback(
    (d) => {
      if (!sonosIp) return;
      sonosService
        .getGroupVolumes(sonosIp)
        .then((base) => {
          d.base = base.ips.length ? base : null;
        })
        .catch(() => {})
        .finally(() => {
          d.loaded = true;
          sendGroupVolume(d);
        });
    },
    [sonosIp, sendGroupVolume],
  );

  const stepRef = useRef(null);
  const beginVolumeStep = useCallback(() => {
    const s = stepRef.current;
    if (s && (!s.loaded || s.base) && Date.now() - s.lastAt < STEP_SESSION_MS) {
      s.lastAt = Date.now();
      return;
    }
    stepRef.current = {target: null, base: null, loaded: false, sending: false, lastAt: Date.now()};
    loadGroupBase(stepRef.current);
  }, [loadGroupBase]);

  const stepVolume = useCallback(
    (delta) => {
      if (!sonosIp) return;
      beginVolumeStep();
      const s = stepRef.current;
      const from = s.target ?? useStore.getState().sonos.volume;
      s.target = Math.max(0, Math.min(100, from + delta));
      s.lastAt = Date.now();
      volumeTouchRef.current = Date.now();
      setSonosVolume(s.target);
      sendGroupVolume(s);
    },
    [sonosIp, setSonosVolume, sendGroupVolume, beginVolumeStep],
  );
  const volumeDown = useCallback(() => stepVolume(-2), [stepVolume]);
  const volumeUp = useCallback(() => stepVolume(2), [stepVolume]);

  const stopVolumeRepeat = useCallback(() => {
    if (volumeTimerRef.current) {
      clearInterval(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
    if (stepRef.current) stepRef.current.lastAt = Date.now();
  }, []);

  const startVolumeRepeat = useCallback(
    (delta) => {
      stopVolumeRepeat();
      volumeTimerRef.current = setInterval(() => stepVolume(delta), 300);
    },
    [stepVolume, stopVolumeRepeat],
  );

  useEffect(() => stopVolumeRepeat, [stopVolumeRepeat]);

  // Drag on the bar sets the group volume; a tap without moving opens the popup
  const dragRef = useRef(null);
  const dragTo = useCallback(
    (pageX) => {
      const d = dragRef.current;
      if (!d || !d.geom || !d.geom.width) return;
      const target = Math.max(0, Math.min(100, Math.round(((pageX - d.geom.x) / d.geom.width) * 100)));
      d.target = target;
      volumeTouchRef.current = Date.now();
      setSonosVolume(target);
      sendGroupVolume(d);
    },
    [setSonosVolume, sendGroupVolume],
  );

  const onVolumeGrant = useCallback(
    (e) => {
      const pageX = e.nativeEvent.pageX;
      dragRef.current = {startX: pageX, moved: false, target: null, base: null, geom: null};
      const d = dragRef.current;
      volumeBarRef.current?.measureInWindow?.((x, y, width, height) => {
        d.geom = {x, y, width, height};
      });
      loadGroupBase(d);
    },
    [loadGroupBase],
  );

  const onVolumeMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d) return;
      const pageX = e.nativeEvent.pageX;
      if (!d.moved && Math.abs(pageX - d.startX) < 6) return;
      d.moved = true;
      dragTo(pageX);
    },
    [dragTo],
  );

  const onVolumeRelease = useCallback(() => {
    const d = dragRef.current;
    if (d && !d.moved) {
      if (d.geom) showGroupVolume(d.geom);
      else if (volumeBarRef.current?.measureInWindow) {
        volumeBarRef.current.measureInWindow((x, y, width, height) =>
          showGroupVolume({x, y, width, height}),
        );
      } else showGroupVolume(null);
    }
  }, [showGroupVolume]);

  const stateIconName = isPlaying ? 'pause' : 'play';
  const albumArt = sonos.track?.albumArtURL || sonos.track?.albumArtURI || null;
  const progress =
    sonos.track && sonos.track.duration > 0
      ? (sonos.position / sonos.track.duration) * 100
      : 0;

  if (sonosService.isIdleTrack(sonos.track) && sonos.state !== 'playing') {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          <View style={[styles.albumArt, styles.idleArt]}>
            <Icon name="speaker" size={sp(44)} color="#666666" />
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {translate('nothingPlaying', lang)}
            </Text>
            {roomName || sonosGroup ? (
              <Text style={styles.artist} numberOfLines={1}>
                {roomName || sonosGroup}
              </Text>
            ) : null}
            <Text style={[styles.album, styles.idleHint]} numberOfLines={2}>
              {translate('nothingPlayingHint', lang)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {sonos.track ? (
        <View style={styles.row}>
          {/* Album art */}
          <View style={styles.artCol}>
            {albumArt ? (
              <Image source={{uri: albumArt}} style={styles.albumArt} />
            ) : (
              <View style={[styles.albumArt, styles.placeholder]} />
            )}
          </View>

          {/* Track info + controls */}
          <View style={styles.infoCol}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {sonos.track.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {sonos.track.artist}
            </Text>
            <Text style={styles.album} numberOfLines={1}>
              {sonos.track.album}
            </Text>

            {/* Progress bar */}
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, {width: `${Math.min(progress, 100)}%`}]} />
            </View>

            {/* Volume controls */}
            <View style={styles.controls}>
              <TouchableOpacity
                hitSlop={VOLUME_DOWN_SLOP}
                onPressIn={beginVolumeStep}
                onPress={volumeDown}
                onLongPress={() => startVolumeRepeat(-1)}
                onPressOut={stopVolumeRepeat}>
                <Icon name="volume-medium" size={22} color="#ffffff" />
              </TouchableOpacity>
              <View
                ref={volumeBarRef}
                style={styles.volumeTouch}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                onResponderGrant={onVolumeGrant}
                onResponderMove={onVolumeMove}
                onResponderRelease={onVolumeRelease}>
                <View style={styles.volumeBar}>
                  <View
                    style={[
                      styles.volumeFill,
                      {width: `${Math.min(sonos.volume, 100)}%`},
                    ]}
                  />
                </View>
              </View>
              <TouchableOpacity
                hitSlop={VOLUME_UP_SLOP}
                onPressIn={beginVolumeStep}
                onPress={volumeUp}
                onLongPress={() => startVolumeRepeat(1)}
                onPressOut={stopVolumeRepeat}>
                <Icon name="volume-high" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Play controls */}
          <View style={styles.playCol}>
            <TouchableOpacity onPress={toggleShuffle}>
              <Icon name="shuffle-variant" size={28} color={sonos.shuffle ? '#3e88c4' : '#666666'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={playPause}>
              <Icon name={stateIconName} size={36} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={playNext}>
              <Icon name="skip-next" size={36} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={[styles.albumArt, styles.placeholder]} />
          <View style={styles.infoCol}>
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, {width: '60%'}]} />
          </View>
          <TouchableOpacity onPress={playPause}>
            <Icon name={stateIconName} size={36} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// About 44 dp around the 22 px icons; the inner side stops at the bar's 8 px margin
const VOLUME_DOWN_SLOP = {top: 11, bottom: 11, left: 11, right: 8};
const VOLUME_UP_SLOP = {top: 11, bottom: 11, left: 8, right: 11};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    margin: 4,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  artCol: {
    marginRight: 16,
  },
  albumArt: {
    width: sp(96),
    height: sp(96),
    borderRadius: 4,
  },
  placeholder: {
    backgroundColor: '#333333',
  },
  idleArt: {
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  idleHint: {
    color: '#999999',
  },
  infoCol: {
    flex: 1,
  },
  trackTitle: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#ffffff',
  },
  artist: {
    fontSize: fs(13),
    color: '#ffffff',
    marginTop: sp(6),
  },
  album: {
    fontSize: fs(13),
    color: '#ffffff',
    fontWeight: '300',
    marginTop: sp(6),
  },
  progressBg: {
    height: 3,
    backgroundColor: 'rgba(11, 119, 239, 0.3)',
    borderRadius: 2,
    marginTop: sp(10),
  },
  progressFill: {
    height: 3,
    backgroundColor: '#0B77EF',
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sp(10),
  },
  // Tall finger target around the thin bar; touchAction stops the browser panning mid-drag
  volumeTouch: {
    flex: 1,
    height: sp(32),
    marginHorizontal: 8,
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? {touchAction: 'none'} : null),
  },
  volumeBar: {
    height: 3,
    backgroundColor: '#444444',
    borderRadius: 2,
    justifyContent: 'center',
  },
  volumeFill: {
    height: 3,
    backgroundColor: '#888888',
    borderRadius: 2,
  },
  playCol: {
    alignItems: 'center',
    marginLeft: 12,
    gap: sp(16),
  },
  skeletonLine: {
    height: 14,
    backgroundColor: '#333333',
    borderRadius: 4,
    marginVertical: 4,
    width: '80%',
  },
});

export default SonosWidget;
