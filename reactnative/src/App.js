import React, { useEffect } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Dashboard from './Dashboard';
import useStore from './store';
import { loadSettings } from './components/SettingsModal';
import { exchangeCodeForTokens } from './services/tibberOAuthService';

const App = () => {
  const setConfig = useStore(s => s.setConfig);
  const setKeepAwake = useStore(s => s.setKeepAwake);

  const setTibberDataApiConnected = useStore(s => s.setTibberDataApiConnected);

  // Load saved settings on startup
  useEffect(() => {
    const init = async () => {
      const savedConfig = await loadSettings();
      setConfig(savedConfig);
      if (savedConfig.keepAwake !== undefined) {
        setKeepAwake(savedConfig.keepAwake);
      }
    };
    init();
  }, [setConfig, setKeepAwake]);

  // Handle OAuth deep links
  useEffect(() => {
    const handleUrl = async (url) => {
      if (!url || !url.startsWith('homeboard://oauth/tibber')) return;
      try {
        const queryString = url.split('?')[1] || '';
        const params = new URLSearchParams(queryString);
        const code = params.get('code');
        const state = params.get('state');
        if (code && state) {
          await exchangeCodeForTokens(code, state);
          setTibberDataApiConnected(true);
          console.warn('Tibber Data API: OAuth connected');
        }
      } catch (err) {
        console.warn('OAuth callback error:', err);
      }
    };

    // Cold start
    Linking.getInitialURL().then(handleUrl);

    // Warm start
    const sub = Linking.addEventListener('url', ({url}) => handleUrl(url));
    return () => sub.remove();
  }, [setTibberDataApiConnected]);

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.container}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <Dashboard />
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

export default App;
