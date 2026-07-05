import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import useStore from '../store';
import {formatCalendarTime, formatCalendarClass} from '../utils/formatting';
import {calendarColors} from '../utils/colors';
import {translate} from '../utils/translations';
import {fs} from '../utils/scale';
import WidgetCard from '../components/WidgetCard';

const CalendarWidget = () => {
  const events = useStore((s) => s.events);
  const config = useStore((s) => s.config);
  const lang = config.language || 'en';

  return (
    <WidgetCard variant="light" style={styles.card}>
      <Text style={styles.title}>{translate('calendar', lang)}</Text>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {events
          ? events.map((event, index) => {
              const cls = formatCalendarClass(event.start);
              const colors = calendarColors[cls] || calendarColors.default;
              return (
                <View
                  key={index}
                  style={[
                    styles.row,
                    {
                      backgroundColor: colors.bg,
                      borderLeftColor: colors.border,
                    },
                  ]}>
                  <Text style={styles.time} numberOfLines={1}>
                    {formatCalendarTime(event.start, lang)}
                  </Text>
                  <Text style={styles.event} numberOfLines={1}>
                    {event.summary}
                  </Text>
                </View>
              );
            })
          : null}
      </ScrollView>
    </WidgetCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
  },
  title: {
    fontSize: fs(12),
    fontWeight: '500',
    color: '#555555',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    borderRadius: 4,
    borderLeftWidth: 5,
    marginVertical: 3,
    padding: 10,
    lineHeight: fs(16),
  },
  time: {
    fontSize: fs(13),
    fontWeight: '400',
    color: '#333333',
    minWidth: '30%',
    flexShrink: 0,
    marginRight: 8,
  },
  event: {
    fontSize: fs(15),
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
  },
});

export default CalendarWidget;
