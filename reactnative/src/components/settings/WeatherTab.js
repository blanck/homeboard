import React, {useMemo, useState} from 'react';
import {View, Text, StyleSheet, Linking, TouchableOpacity} from 'react-native';
import {translate} from '../../utils/translations';
import DropdownPicker from './DropdownPicker';
import {verifyNetatmoPublicStation} from '../../services/weatherService';

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
  // Netatmo's forecast endpoint only serves stations owned by the signed-in
  // account: every public station id returns "Device not found", including
  // ones its own weathermap lists. So public mode is gone and the forecast
  // comes from met.no, which needs no key.
  const modeOptions = [{label: translate('myStation', lang), value: 'my'}];

  const mode = 'my';

  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  const checkStation = async () => {
    setChecking(true);
    setCheckResult(null);
    setCheckResult(await verifyNetatmoPublicStation(form.netatmoPublicUrl, lang));
    setChecking(false);
  };

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
            {extractedId ? (
              <TouchableOpacity
                style={styles.testBtn}
                disabled={checking}
                onPress={checkStation}>
                <Text style={styles.testBtnText}>
                  {checking ? translate('testing', lang) : translate('testStation', lang)}
                </Text>
              </TouchableOpacity>
            ) : null}
            {checkResult ? (
              <Text style={checkResult.ok ? styles.testOk : styles.testFail}>
                {checkResult.ok
                  ? `${translate('stationWorks', lang)} (${checkResult.days})`
                  : `${translate('stationFailed', lang)}: ${checkResult.error}`}
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
  testBtn: {
    backgroundColor: '#3a3a3a',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  testBtnText: {color: '#ffffff', fontSize: 13, fontWeight: '600'},
  testOk: {color: '#3fcf40', fontSize: 12, marginTop: 8},
  testFail: {color: '#ff6666', fontSize: 12, marginTop: 8},
  stationId: {
    color: '#4caf50',
    fontSize: 12,
    marginBottom: 8,
  },
});

export default WeatherTab;
