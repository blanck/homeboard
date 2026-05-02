import React, {useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import useStore from '../store';
import {fs} from '../utils/scale';
import {formatTime, formatDay, formatRemoteTime, formatRemoteAbbr} from '../utils/formatting';

const ClockWidget = () => {
  const config = useStore((s) => s.config);
  const currentTime = useStore((s) => s.currentTime);
  const currentDay = useStore((s) => s.currentDay);
  const remoteTime = useStore((s) => s.remoteTime);
  const remoteAbbr = useStore((s) => s.remoteAbbr);
  const setTime = useStore((s) => s.setTime);

  useEffect(() => {
    const update = () => {
      if (config.time) {
        setTime({
          currentTime: formatTime(config.time.localzone),
          currentDay: formatDay(config.time.localzone, config.language),
          remoteTime: formatRemoteTime(config.time.remotezone),
          remoteAbbr: formatRemoteAbbr(config.time.remotezone),
        });
      }
    };

    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [config.time, config.language, setTime]);

  return (
    <View style={styles.container}>
      <Text style={styles.time}>{currentTime}</Text>
      <Text style={styles.day}>{currentDay}</Text>
      {remoteTime ? (
        <Text style={styles.remote}>
          {remoteAbbr} {remoteTime}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontSize: fs(52),
    fontWeight: 'bold',
    color: '#ffffff',
  },
  day: {
    fontSize: fs(28),
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: -8,
  },
  remote: {
    fontSize: fs(32),
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
  },
});

export default ClockWidget;
