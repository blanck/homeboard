import {useEffect, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';

const useIsOnline = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
    });
    NetInfo.fetch().then((state) => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return () => sub();
  }, []);

  return isOnline;
};

export default useIsOnline;
