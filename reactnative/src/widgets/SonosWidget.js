import React, {useEffect, useRef, useCallback} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useStore from '../store';
import * as sonosService from '../services/sonosService';
import {fs, sp} from '../utils/scale';

const SONOS_UUID_KEY = 'sonos_known_uuid';

const SonosWidget = () => {
  const sonos = useStore((s) => s.sonos);
  const config = useStore((s) => s.config);
  const setSonosTrack = useStore((s) => s.setSonosTrack);
  const setSonosState = useStore((s) => s.setSonosState);
  const setSonosVolume = useStore((s) => s.setSonosVolume);
  const setSonosShuffle = useStore((s) => s.setSonosShuffle);
  const incrementSonosPosition = useStore((s) => s.incrementSonosPosition);

  const volumeTimerRef = useRef(null);
  const inFlightRef = useRef(false);
  const failuresRef = useRef(0);
  const rediscoveringRef = useRef(false);
  const persistedUuidRef = useRef(null);
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

    const poll = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const [track, state, volume, playMode] = await Promise.all([
          sonosService.getCurrentTrack(sonosIp),
          sonosService.getTransportState(sonosIp),
          sonosService.getVolume(sonosIp),
          sonosService.getPlayMode(sonosIp),
        ]);
        const allFailed = !track && !state && volume == null && !playMode;
        if (allFailed) {
          failuresRef.current += 1;
          if (failuresRef.current >= 3) {
            rediscover();
          }
          return;
        }
        const wasFailing = failuresRef.current > 0;
        failuresRef.current = 0;
        if (track) setSonosTrack(track);
        if (state) setSonosState(state);
        if (volume != null) setSonosVolume(volume);
        if (playMode) setSonosShuffle(playMode.includes('SHUFFLE'));
        // Persist UUID for future rediscovery — runs once on first success or after recovery
        if (!persistedUuidRef.current || wasFailing) {
          sonosService.getDeviceUUID(sonosIp).then((uuid) => {
            if (uuid) {
              persistedUuidRef.current = uuid;
              AsyncStorage.setItem(SONOS_UUID_KEY, uuid).catch(() => {});
            }
          });
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [sonosIp, setSonosTrack, setSonosState, setSonosVolume, setSonosShuffle, rediscover]);

  // Track position counter
  useEffect(() => {
    const timer = setInterval(() => {
      incrementSonosPosition();
    }, 1000);
    return () => clearInterval(timer);
  }, [incrementSonosPosition]);

  const playPause = useCallback(() => {
    if (sonosIp) {
      sonosService.togglePlayback(sonosIp);
    }
  }, [sonosIp]);

  const playNext = useCallback(() => {
    if (sonosIp) {
      sonosService.nextTrack(sonosIp);
    }
  }, [sonosIp]);

  const toggleShuffle = useCallback(async () => {
    if (!sonosIp) return;
    const previous = sonos.shuffle;
    const newMode = previous ? 'NORMAL' : 'SHUFFLE';
    setSonosShuffle(!previous);
    try {
      await sonosService.setPlayMode(sonosIp, newMode);
    } catch {
      setSonosShuffle(previous);
    }
  }, [sonosIp, sonos.shuffle, setSonosShuffle]);

  const volumeDown = useCallback(() => {
    if (sonosIp) {
      sonosService.adjustVolume(sonosIp, -2);
    }
  }, [sonosIp]);

  const volumeUp = useCallback(() => {
    if (sonosIp) {
      sonosService.adjustVolume(sonosIp, 2);
    }
  }, [sonosIp]);

  const startVolumeRepeat = useCallback(
    (delta) => {
      volumeTimerRef.current = setInterval(() => {
        if (sonosIp) {
          sonosService.adjustVolume(sonosIp, delta);
        }
      }, 300);
    },
    [sonosIp],
  );

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
              <View style={styles.volumeBar}>
                <View
                  style={[
                    styles.volumeFill,
                    {width: `${Math.min(sonos.volume, 100)}%`},
                  ]}
                />
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
  volumeBar: {
    flex: 1,
    height: 3,
    backgroundColor: '#444444',
    borderRadius: 2,
    marginHorizontal: 8,
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
