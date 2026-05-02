import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';

const usePolling = (callback, intervalMs, enabled = true) => {
  const savedCallback = useRef(callback);
  const timerRef = useRef(null);
  const lastRunRef = useRef(0);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const run = () => {
      lastRunRef.current = Date.now();
      try {
        savedCallback.current();
      } catch (e) {
        console.warn('poll error:', e);
      }
    };

    run();

    timerRef.current = setInterval(run, intervalMs);

    const appSub = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      const sinceLast = Date.now() - lastRunRef.current;
      if (sinceLast > 30 * 1000) run();
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      appSub.remove();
    };
  }, [intervalMs, enabled]);
};

export default usePolling;
