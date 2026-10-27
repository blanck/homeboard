// Phone/tablet/desktop view: the full app, but opened straight into Settings.
//
// Closing settings reveals the dashboard as a live preview, so you can check a
// change from your desk instead of walking to the wall display; the cog reopens
// settings. Saves go to the shared server store, so editing here configures the
// Pi. Settings are written when the modal closes, hence the confirmation.
import React, {useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import useStore from '@homeboard/rn/store';
import App from '@homeboard/rn/App';

const SAVED_BANNER_MS = 2500;

const PhoneSettings = () => {
  const settingsVisible = useStore((s) => s.settingsVisible);
  const setSettingsVisible = useStore((s) => s.setSettingsVisible);
  const setIsKioskDisplay = useStore((s) => s.setIsKioskDisplay);
  const [saved, setSaved] = useState(false);
  const wasOpen = useRef(false);
  const bannerTimer = useRef(null);

  useEffect(() => {
    setSettingsVisible(true);
    // This is a preview, not the wall display: it must never sleep or wake the
    // Pi's panel, or a phone left open blanks the screen someone is looking at
    setIsKioskDisplay(false);
  }, [setSettingsVisible, setIsKioskDisplay]);

  // Confirm only on a real open -> close transition, not the initial mount
  useEffect(() => {
    if (settingsVisible) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    setSaved(true);
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setSaved(false), SAVED_BANNER_MS);
  }, [settingsVisible]);

  useEffect(() => () => clearTimeout(bannerTimer.current), []);

  return (
    <View style={styles.root}>
      <App />
      {saved ? (
        <View style={styles.banner} pointerEvents="none">
          <Text style={styles.bannerText}>Saved · showing preview</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2a5a2a',
    paddingVertical: 14,
    alignItems: 'center',
    zIndex: 1000,
  },
  bannerText: {color: '#ffffff', fontSize: 15, fontWeight: '600'},
});

export default PhoneSettings;
