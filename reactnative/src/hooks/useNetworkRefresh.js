import {useEffect, useRef} from 'react';
import NetInfo from '@react-native-community/netinfo';

// Reconnect only: foreground catch-up lives in usePolling
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
    return () => netSub();
  }, []);
};

export default useNetworkRefresh;
