import React, {useMemo} from 'react';
import {View, Text, StyleSheet, Linking, TouchableOpacity} from 'react-native';
import {translate} from '../../utils/translations';
import DropdownPicker from './DropdownPicker';

const extractStationId = (urlOrMac) => {
  if (!urlOrMac) return null;
  try {
    const url = new URL(urlOrMac);
    const id = url.searchParams.get('stationid');
    if (id) return id;
  } catch {
    // Not a URL
  }
  if (/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(urlOrMac.trim())) {
    return urlOrMac.trim();
  }
  return urlOrMac.trim() || null;
};

const WeatherTab = ({form, updateField, lang, Section, Field, Row}) => {
  const modeOptions = [
    {label: translate('publicStation', lang), value: 'public'},
    {label: translate('myStation', lang), value: 'my'},
  ];

  const mode = form.netatmoMode || 'public';

  const extractedId = useMemo(
    () => extractStationId(form.netatmoPublicUrl),
    [form.netatmoPublicUrl],
  );

  return (
    <View>
      <Section title={translate('owmApiKey', lang)}>
        <Field
          value={form.owmKey}
          onChangeText={(v) => updateField('owmKey', v)}
          secureTextEntry
          placeholder="83032a45..."
        />
        <TouchableOpacity
          onPress={() => Linking.openURL('https://home.openweathermap.org/api_keys')}>
          <Text style={styles.link}>{translate('owmApiKeyHint', lang)}</Text>
        </TouchableOpacity>
      </Section>

      <Section title={translate('netatmoOptional', lang)}>
        <DropdownPicker
          label={translate('netatmoMode', lang)}
          value={mode}
          options={modeOptions}
          onValueChange={(v) => updateField('netatmoMode', v)}
        />

        {mode === 'public' ? (
          <View>
            <Field
              label={translate('sharingUrl', lang)}
              value={form.netatmoPublicUrl}
              onChangeText={(v) => updateField('netatmoPublicUrl', v)}
              placeholder="https://weathermap.netatmo.com/?stationid=70:ee:50:22:c8:c4"
            />
            <Text style={styles.hint}>{translate('sharingUrlHint', lang)}</Text>
            {extractedId ? (
              <Text style={styles.stationId}>
                {translate('extractedStationId', lang)}: {extractedId}
              </Text>
            ) : null}
          </View>
        ) : (
          <View>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://weathermap.netatmo.com/')}>
              <Text style={styles.link}>{translate('netatmoHint', lang)}</Text>
            </TouchableOpacity>
            <Row>
              <Field
                label={translate('clientId', lang)}
                value={form.netatmoClientId}
                onChangeText={(v) => updateField('netatmoClientId', v)}
                half
              />
              <Field
                label={translate('clientSecret', lang)}
                value={form.netatmoClientSecret}
                onChangeText={(v) => updateField('netatmoClientSecret', v)}
                half
                secureTextEntry
              />
            </Row>
            <Row>
              <Field
                label={translate('deviceId', lang)}
                value={form.netatmoDeviceId}
                onChangeText={(v) => updateField('netatmoDeviceId', v)}
                placeholder="70:ee:50:28:b7:a2"
                half
              />
              <Field
                label={translate('forecastDeviceId', lang)}
                value={form.netatmoForecastDeviceId}
                onChangeText={(v) => updateField('netatmoForecastDeviceId', v)}
                placeholder="70:ee:50:28:b7:a2"
                half
              />
            </Row>
            <Row>
              <Field
                label={translate('forecastModuleId', lang)}
                value={form.netatmoForecastModuleId}
                onChangeText={(v) => updateField('netatmoForecastModuleId', v)}
                placeholder="05:00:00:06:b1:30"
                half
              />
              <Field
                label={translate('forecastBearer', lang)}
                value={form.netatmoForecastBearer}
                onChangeText={(v) => updateField('netatmoForecastBearer', v)}
                secureTextEntry
                half
              />
            </Row>
          </View>
        )}
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
  link: {
    color: '#3e88c4',
    fontSize: 11,
    marginBottom: 8,
    fontStyle: 'italic',
    textDecorationLine: 'underline',
  },
  stationId: {
    color: '#4caf50',
    fontSize: 12,
    marginBottom: 8,
  },
});

export default WeatherTab;
