// Phone view: Settings only, no dashboard (a scaled-down wall layout looked
// broken on a phone and polled every service for nothing). Saves go to the
// shared server store, so editing here configures the Pi.
import React, {useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '@homeboard/rn/store';
import SettingsModal, {loadSettings} from '@homeboard/rn/components/SettingsModal';
import useOAuthCallback from '@homeboard/rn/hooks/useOAuthCallback';
import {translate} from '@homeboard/rn/utils/translations';

const PhoneSettings = () => {
  const settingsVisible = useStore((s) => s.settingsVisible);
  const setSettingsVisible = useStore((s) => s.setSettingsVisible);
  const setConfig = useStore((s) => s.setConfig);
  const setIsKioskDisplay = useStore((s) => s.setIsKioskDisplay);
  const lang = useStore((s) => s.config.language || 'en');

  useEffect(() => {
    // Not the wall display: it must never sleep or wake the Pi's panel
    setIsKioskDisplay(false);
    loadSettings().then((saved) => {
      setConfig(saved);
      setSettingsVisible(true);
    });
  }, [setConfig, setSettingsVisible, setIsKioskDisplay]);

  useOAuthCallback();

  return (
    <View style={styles.root}>
      {settingsVisible ? null : (
        <View style={styles.done}>
          <Icon name="check-circle" size={56} color="#3fcf40" />
          <Text style={styles.doneTitle}>{translate('phoneSaved', lang)}</Text>
          <Text style={styles.doneText}>{translate('phoneSavedHint', lang)}</Text>
          <TouchableOpacity style={styles.button} onPress={() => setSettingsVisible(true)}>
            <Icon name="cog-outline" size={20} color="#ffffff" />
            <Text style={styles.buttonText}>{translate('settings', lang)}</Text>
          </TouchableOpacity>
        </View>
      )}
      <SettingsModal />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#1a1a1a'},
  done: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14},
  doneTitle: {color: '#ffffff', fontSize: 22, fontWeight: '700'},
  doneText: {color: '#aaaaaa', fontSize: 15, textAlign: 'center', lineHeight: 21},
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: '#1B4781',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: {color: '#ffffff', fontSize: 16, fontWeight: '600'},
});

export default PhoneSettings;
