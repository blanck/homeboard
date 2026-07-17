import {useEffect, useRef, useCallback} from 'react';

// Port of the legacy home.vue auto-sleep: inside the configured window
// ("22-07") and after 30s without touches, blank the kiosk screen via the
// web server's /system/sleep (pure DPMS off, so any touch wakes it again;
// the same idle check then re-blanks). The relative fetch fails silently
// on Android where there is no kiosk server.
const IDLE_MS = 30 * 1000;
const CHECK_MS = 60 * 1000;

export const inSleepWindow = (autosleep, hour) => {
  const parts = (autosleep || '').split('-');
  if (parts.length !== 2) return false;
  const start = parseInt(parts[0], 10);
  const end = parseInt(parts[1], 10);
  if (isNaN(start) || isNaN(end) || start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
};

const useAutoSleep = (autosleep, enabled = true) => {
  const lastActiveRef = useRef(Date.now());

  const onActivity = useCallback(() => {
    lastActiveRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!enabled || !autosleep) return;
    const timer = setInterval(() => {
      if (
        inSleepWindow(autosleep, new Date().getHours()) &&
        Date.now() - lastActiveRef.current > IDLE_MS
      ) {
        fetch('/system/sleep', {method: 'POST'}).catch(() => {});
      }
    }, CHECK_MS);
    return () => clearInterval(timer);
  }, [autosleep, enabled]);

  return onActivity;
};

export default useAutoSleep;
