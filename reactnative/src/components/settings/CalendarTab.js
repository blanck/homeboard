import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {translate} from '../../utils/translations';

const CalendarTab = ({form, updateField, lang, Section, Field}) => {
  return (
    <View>
      <Section title={translate('sharedCalendarUrl', lang)}>
        <Field
          value={form.calSharedUrl}
          onChangeText={(v) => updateField('calSharedUrl', v)}
          placeholder="https://p42-caldav.icloud.com/published/..."
        />
        <Text style={styles.hint}>{translate('calendarHint', lang)}</Text>
      </Section>

      <Section title={translate('holidayCalendarUrl', lang)}>
        <Field
          value={form.calHolidayUrl}
          onChangeText={(v) => updateField('calHolidayUrl', v)}
          placeholder="https://www.officeholidays.com/ics-local-name/sweden"
        />
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  hint: {
    color: '#666',
    fontSize: 11,
    marginBottom: 8,
    fontStyle: 'italic',
  },
});

export default CalendarTab;
