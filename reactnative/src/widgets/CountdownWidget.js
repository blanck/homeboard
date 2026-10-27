import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, ImageBackground} from 'react-native';
import Svg, {Defs, LinearGradient, Stop, Rect} from 'react-native-svg';
import useStore from '../store';
import {translate} from '../utils/translations';
import {fs, sp} from '../utils/scale';

const MINUTE = 60 * 1000;

// Local time; without a time it counts to midnight starting that day
const parseTarget = (date, time) => {
  const d = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(date || '');
  if (!d) return NaN;
  const t = /^(\d{1,2})[:.](\d{2})/.exec(time || '') || [0, 0, 0];
  return new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]).getTime();
};

const CountdownWidget = () => {
  const countdown = useStore((s) => s.config.countdown) || {};
  const lang = useStore((s) => s.config.language || 'en');
  const [now, setNow] = useState(Date.now());

  // Tick on the minute boundary rather than every 60s from mount
  useEffect(() => {
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, MINUTE - (Date.now() % MINUTE) + 50);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const target = parseTarget(countdown.date, countdown.time);
  const left = Math.max(0, target - now);
  const totalMinutes = Math.floor(left / MINUTE);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const arrived = !isNaN(target) && left === 0;

  return (
    <View style={styles.card}>
      <ImageBackground
        source={countdown.imageUrl ? {uri: countdown.imageUrl} : undefined}
        style={styles.image}
        resizeMode="cover">
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="countdownShade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000" stopOpacity="0.15" />
              <Stop offset="0.45" stopColor="#000" stopOpacity="0.05" />
              <Stop offset="1" stopColor="#000" stopOpacity="0.7" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#countdownShade)" />
        </Svg>

        <Text style={styles.title} numberOfLines={1}>
          {countdown.title || translate('countdown', lang)}
        </Text>

        {isNaN(target) ? (
          <Text style={styles.hint}>{translate('countdownNoDate', lang)}</Text>
        ) : arrived ? (
          <Text style={styles.days}>{translate('countdownToday', lang)}</Text>
        ) : (
          <View>
            <View style={styles.daysRow}>
              <Text style={styles.days}>{days}</Text>
              <Text style={styles.daysLabel}>
                {translate(days === 1 ? 'countdownDay' : 'countdownDays', lang)}
              </Text>
            </View>
            <View style={styles.smallRow}>
              <Text style={styles.small}>
                <Text style={styles.smallValue}>{hours}</Text>{' '}
                {translate('countdownHours', lang)}
              </Text>
              <Text style={styles.small}>
                <Text style={styles.smallValue}>{minutes}</Text>{' '}
                {translate('countdownMinutes', lang)}
              </Text>
            </View>
          </View>
        )}
      </ImageBackground>
    </View>
  );
};

const shadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.6)',
  textShadowOffset: {width: 0, height: 1},
  textShadowRadius: 6,
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(205, 215, 235, 0.8)',
  },
  image: {
    flex: 1,
    padding: sp(16),
    justifyContent: 'space-between',
  },
  title: {
    color: '#ffffff',
    fontSize: fs(16),
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    ...shadow,
  },
  hint: {
    color: '#ffffff',
    fontSize: fs(13),
    ...shadow,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sp(10),
  },
  days: {
    color: '#ffffff',
    fontSize: fs(84),
    fontWeight: '800',
    lineHeight: fs(90),
    ...shadow,
  },
  daysLabel: {
    color: '#ffffff',
    fontSize: fs(22),
    fontWeight: '600',
    ...shadow,
  },
  smallRow: {
    flexDirection: 'row',
    gap: sp(18),
  },
  small: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: fs(15),
    ...shadow,
  },
  smallValue: {
    color: '#ffffff',
    fontSize: fs(20),
    fontWeight: '700',
  },
});

export default CountdownWidget;
