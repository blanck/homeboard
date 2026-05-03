import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Dashboard from './Dashboard';
import useStore from './store';
import { loadSettings } from './components/SettingsModal';
import { exchangeCodeForTokens } from './services/tibberOAuthService';
import { exchangeCodeForTokens as exchangeSpotifyCode } from './services/spotifyOAuthService';

const App = () => {
  const setConfig = useStore(s => s.setConfig);
  const setKeepAwake = useStore(s => s.setKeepAwake);

  const setTibberDataApiConnected = useStore(s => s.setTibberDataApiConnected);
  const setSpotifyConnected = useStore(s => s.setSpotifyConnected);

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
      if (!url) return;
      try {
        const queryString = url.split('?')[1] || '';
        const params = new URLSearchParams(queryString);
        const code = params.get('code');
        const state = params.get('state');
        if (!code || !state) return;
        if (url.startsWith('homeboard://oauth/tibber')) {
          await exchangeCodeForTokens(code, state);
          setTibberDataApiConnected(true);
          console.warn('Tibber Data API: OAuth connected');
        } else if (url.startsWith('homeboard://oauth/spotify')) {
          await exchangeSpotifyCode(code, state);
          setSpotifyConnected(true);
          console.warn('Spotify: OAuth connected');
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
  }, [setTibberDataApiConnected, setSpotifyConnected]);

  return (
    <SafeAreaProvider>
      <Dashboard />
    </SafeAreaProvider>
  );
};

export default App;
