import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { translate } from '../../utils/translations';
import GeneralTab from './GeneralTab';

// The kiosk's first settings page. The server already serves settings to
// phones (main.jsx opens them on a small screen) and saves into the shared
// store, so the code only points the phone there; below it sit the few
// settings that belong at the wall. Phone edits land within one /store-rev poll.
const PhoneSetupTab = props => {
  const { lang, Section } = props;
  const [url, setUrl] = useState(null);
  const [phase, setPhase] = useState('starting');

  const lookup = useCallback(async () => {
    setPhase('starting');
    try {
      const res = await fetch('/lan-address');
      const { addresses, port } = await res.json();
      if (!addresses?.length) {
        setPhase('noWifi');
        return;
      }
      setUrl(`http://${addresses[0].ip}:${port}/?settings`);
      setPhase('ready');
    } catch {
      setPhase('failed');
    }
  }, []);

  useEffect(() => {
    lookup();
  }, [lookup]);

  return (
    <View>
      <Section title={translate('phoneSetup', lang)}>
        <View style={styles.row}>
          <View style={styles.qrCol}>
            {phase === 'ready' && url ? (
              <>
                <View style={styles.qrBox}>
                  <QRCode value={url} size={220} />
                </View>
                <Text style={styles.url} selectable>
                  {url}
                </Text>
              </>
            ) : phase === 'starting' ? (
              <ActivityIndicator
                size="large"
                color="#cccccc"
                style={styles.spinner}
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.problem}>
                  {translate(
                    phase === 'noWifi'
                      ? 'phoneSetupNoWifi'
                      : 'phoneSetupFailed',
                    lang,
                  )}
                </Text>
                <TouchableOpacity style={styles.button} onPress={lookup}>
                  <Icon name="qrcode" size={18} color="#fff" />
                  <Text style={styles.buttonText}>
                    {translate('phoneSetupNewCode', lang)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.infoCol}>
            <Text style={styles.step}>
              1. {translate('phoneSetupStep1', lang)}
            </Text>
            <Text style={styles.step}>
              2. {translate('phoneSetupStep2', lang)}
            </Text>
            <Text style={styles.step}>
              3. {translate('phoneSetupStep3Kiosk', lang)}
            </Text>
          </View>
        </View>
      </Section>
      <Section title={translate('thisScreen', lang)}>
        <GeneralTab {...props} part="screen" />
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 28, alignItems: 'flex-start' },
  qrCol: { width: 260, alignItems: 'center' },
  qrBox: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12 },
  url: { color: '#888', fontSize: 11, marginTop: 8, textAlign: 'center' },
  spinner: { marginTop: 100 },
  qrPlaceholder: {
    width: 252,
    height: 252,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 14,
  },
  problem: { color: '#cccccc', fontSize: 14, textAlign: 'center' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  infoCol: { flex: 1 },
  step: { color: '#dddddd', fontSize: 16, marginBottom: 10, lineHeight: 22 },
});

export default PhoneSetupTab;
