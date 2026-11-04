import React, {useEffect, useRef, useCallback, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useStore from '../store';
import * as sonosService from '../services/sonosService';
import {fs, sp} from '../utils/scale';
import {translate} from '../utils/translations';

const SONOS_UUID_KEY = 'sonos_known_uuid';
const QUEUE_RESET_INTERVAL_MS = 60000;

const SonosWidget = () => {
  const sonos = useStore((s) => s.sonos);
  const config = useStore((s) => s.config);
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
  const inFlightRef = useRef(false);
  const failuresRef = useRef(0);
  const rediscoveringRef = useRef(false);
  const persistedUuidRef = useRef(null);
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

  useEffect(() => {
    if (!sonosIp) {
      return;
    }
    coordinatorIpRef.current = null;

    const poll = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
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
            if (track?.grouped) coordinatorIpRef.current = null;
          }
        } else if (track) {
          coordinatorIpRef.current = null;
        }
        const allFailed = !track && !state && volume == null && !playMode;
        if (allFailed) {
          failuresRef.current += 1;
          coordinatorIpRef.current = null;
          if (failuresRef.current >= 3) {
            rediscover().catch((e) => console.warn('[poll rediscover]', e?.message || String(e)));
          }
          return;
        }
        const wasFailing = failuresRef.current > 0;
        failuresRef.current = 0;
        if (track && !track.grouped) setSonosTrack(track);
        if (state) setSonosState(state);
        // A poll that started mid-drag would snap the bar back
        if (volume != null && Date.now() - volumeTouchRef.current > 2500) setSonosVolume(volume);
        if (playMode) setSonosShuffle(playMode.includes('SHUFFLE'));
        // A Spotify Connect session that moved away can leave the transport on no
        // source at all; point it back at its own queue so play and enqueue work
        const controlIp = coordinatorIpRef.current || sonosIp;
        if (
          sonosService.isIdleTrack(track) &&
          state === 'stopped' &&
          Date.now() - lastQueueResetRef.current > QUEUE_RESET_INTERVAL_MS
        ) {
          lastQueueResetRef.current = Date.now();
          sonosService
            .getMediaInfo(controlIp)
            .then((info) => (info && !info.uri ? sonosService.selectQueue(controlIp) : null))
            .catch((e) => console.warn('[poll selectQueue]', e?.message || String(e)));
        }
        // Persist UUID for future rediscovery — runs once on first success or after recovery
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
      } finally {
        inFlightRef.current = false;
      }
    };

    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [sonosIp, setSonosTrack, setSonosState, setSonosVolume, setSonosShuffle, rediscover]);

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

  // Track position counter
  useEffect(() => {
    const timer = setInterval(() => {
      incrementSonosPosition();
    }, 1000);
    return () => clearInterval(timer);
  }, [incrementSonosPosition]);

  const playPause = useCallback(() => {
    if (sonosIp) {
      sonosService.togglePlayback(coordinatorIpRef.current || sonosIp);
    }
  }, [sonosIp]);

  const playNext = useCallback(() => {
    if (sonosIp) {
      sonosService.nextTrack(coordinatorIpRef.current || sonosIp);
    }
  }, [sonosIp]);

  const toggleShuffle = useCallback(async () => {
    if (!sonosIp) return;
    const previous = sonos.shuffle;
    const newMode = previous ? 'NORMAL' : 'SHUFFLE';
    setSonosShuffle(!previous);
    try {
      await sonosService.setPlayMode(coordinatorIpRef.current || sonosIp, newMode);
    } catch {
      setSonosShuffle(previous);
    }
  }, [sonosIp, sonos.shuffle, setSonosShuffle]);

  const stepVolume = useCallback(
    (delta) => {
      if (!sonosIp) return;
      volumeTouchRef.current = Date.now();
      setSonosVolume(Math.max(0, Math.min(100, useStore.getState().sonos.volume + delta)));
      sonosService.adjustGroupVolume(sonosIp, delta);
    },
    [sonosIp, setSonosVolume],
  );
  const volumeDown = useCallback(() => stepVolume(-2), [stepVolume]);
  const volumeUp = useCallback(() => stepVolume(2), [stepVolume]);

  const startVolumeRepeat = useCallback(
    (delta) => {
      volumeTimerRef.current = setInterval(() => stepVolume(delta), 300);
    },
    [stepVolume],
  );

  // Drag on the bar sets the group volume; a tap without moving opens the popup
  const dragRef = useRef(null);
  const sendDragVolume = useCallback(() => {
    const d = dragRef.current;
    if (!d || !d.base || d.target == null || d.sending) return;
    d.sending = true;
    const {ips, volumes} = d.base;
    const target = d.target;
    sonosService
      .setGroupVolumes(ips, sonosService.offsetVolumes(volumes, target - sonosService.averageVolume(volumes)))
      .finally(() => {
        d.sending = false;
        if (d.target !== target) setTimeout(sendDragVolume, 120);
      });
  }, []);

  const dragTo = useCallback(
    (pageX) => {
      const d = dragRef.current;
      if (!d || !d.geom || !d.geom.width) return;
      const target = Math.max(0, Math.min(100, Math.round(((pageX - d.geom.x) / d.geom.width) * 100)));
      d.target = target;
      volumeTouchRef.current = Date.now();
      setSonosVolume(target);
      sendDragVolume();
    },
    [setSonosVolume, sendDragVolume],
  );

  const onVolumeGrant = useCallback(
    (e) => {
      const pageX = e.nativeEvent.pageX;
      dragRef.current = {startX: pageX, moved: false, target: null, base: null, geom: null};
      const d = dragRef.current;
      volumeBarRef.current?.measureInWindow?.((x, y, width, height) => {
        d.geom = {x, y, width, height};
      });
      if (sonosIp) {
        sonosService.getGroupVolumes(sonosIp).then((base) => {
          d.base = base.ips.length ? base : null;
          sendDragVolume();
        });
      }
    },
    [sonosIp, sendDragVolume],
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

  const stopVolumeRepeat = useCallback(() => {
    if (volumeTimerRef.current) {
      clearInterval(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
  }, []);

  const stateIconName = sonos.state === 'playing' ? 'pause' : 'play-arrow';
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
                onPress={volumeDown}
                onLongPress={() => startVolumeRepeat(-1)}
                onPressOut={stopVolumeRepeat}>
                <Icon name="volume-down" size={22} color="#ffffff" />
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
                onPress={volumeUp}
                onLongPress={() => startVolumeRepeat(1)}
                onPressOut={stopVolumeRepeat}>
                <Icon name="volume-up" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Play controls */}
          <View style={styles.playCol}>
            <TouchableOpacity onPress={toggleShuffle}>
              <Icon name="shuffle" size={28} color={sonos.shuffle ? '#3e88c4' : '#666666'} />
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
