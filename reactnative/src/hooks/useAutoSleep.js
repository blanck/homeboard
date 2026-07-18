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

const WAKE_THROTTLE_MS = 10 * 1000;

const useAutoSleep = (autosleep, enabled = true) => {
  const lastActiveRef = useRef(Date.now());
  const lastWakeRef = useRef(0);

  const onActivity = useCallback(() => {
    lastActiveRef.current = Date.now();
    // X does not wake DPMS from touchscreen input, so wake explicitly on
    // every touch (throttled). A no-op when the panel is already on, and
    // immune to page reloads losing track of whether we put it to sleep
    if (Date.now() - lastWakeRef.current > WAKE_THROTTLE_MS) {
      lastWakeRef.current = Date.now();
      fetch('/system/wake', {method: 'POST'}).catch(() => {});
    }
  }, []);

  // react-native-web does not fire the onTouchStart view prop, so on web
  // listen at the window level (capture also covers modals/portals)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('touchstart', onActivity, true);
    window.addEventListener('mousedown', onActivity, true);
    return () => {
      window.removeEventListener('touchstart', onActivity, true);
      window.removeEventListener('mousedown', onActivity, true);
    };
  }, [onActivity]);

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
