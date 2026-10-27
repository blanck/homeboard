import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Dashboard from './Dashboard';
import useStore from './store';
import { loadSettings } from './components/SettingsModal';
import useOAuthCallback from './hooks/useOAuthCallback';

const App = () => {
  const setConfig = useStore(s => s.setConfig);
  const setKeepAwake = useStore(s => s.setKeepAwake);

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

  useOAuthCallback();

  return (
    <SafeAreaProvider>
      <Dashboard />
    </SafeAreaProvider>
  );
};

export default App;
