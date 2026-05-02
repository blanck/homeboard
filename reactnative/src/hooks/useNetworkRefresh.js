import {useEffect, useRef} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {AppState} from 'react-native';

const useNetworkRefresh = (onReconnect) => {
  const wasOnlineRef = useRef(true);
  const onReconnectRef = useRef(onReconnect);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    const netSub = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected && state.isInternetReachable !== false;
      if (isOnline && !wasOnlineRef.current) {
        try {
          onReconnectRef.current?.();
        } catch (e) {
          console.warn('reconnect handler error:', e);
        }
      }
      wasOnlineRef.current = isOnline;
    });

    const appSub = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        try {
          onReconnectRef.current?.();
        } catch (e) {
          console.warn('foreground handler error:', e);
        }
      }
    });

    return () => {
      netSub();
      appSub.remove();
    };
  }, []);
};

export default useNetworkRefresh;
