import {useEffect, useRef, useCallback} from 'react';
import {AppState} from 'react-native';
import useStore from '../store';

// Port of the legacy home.vue auto-sleep: inside the configured window
// ("22-07") and after 30s without touches the store's `asleep` turns on, and
// on the kiosk the panel blanks via web/server.mjs /system/sleep (DPMS off,
// any touch wakes it). Android has no panel control but still sets `asleep`.
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

export const shouldSleep = (autosleep, now, lastActive) =>
  inSleepWindow(autosleep, new Date(now).getHours()) && now - lastActive > IDLE_MS;

const WAKE_THROTTLE_MS = 10 * 1000;

// controlsPanel: also POST sleep/wake to the kiosk server (web kiosk only)
const useAutoSleep = (autosleep, {enabled = true, controlsPanel = false} = {}) => {
  const setAsleep = useStore((s) => s.setAsleep);
  const lastActiveRef = useRef(Date.now());
  const lastWakeRef = useRef(0);
  const panelRef = useRef(controlsPanel);

  useEffect(() => {
    panelRef.current = controlsPanel;
  }, [controlsPanel]);

  const markActive = useCallback(() => {
    lastActiveRef.current = Date.now();
    setAsleep(false);
  }, [setAsleep]);

  const onActivity = useCallback(() => {
    markActive();
    // X does not wake DPMS from touchscreen input, so wake explicitly on
    // every touch (throttled). A no-op when the panel is already on
    if (panelRef.current && Date.now() - lastWakeRef.current > WAKE_THROTTLE_MS) {
      lastWakeRef.current = Date.now();
      fetch('/system/wake', {method: 'POST'}).catch(() => {});
    }
  }, [markActive]);

  // react-native-web does not fire the onTouchStart view prop, so on web
  // listen at the window level (capture also covers modals/portals)
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('touchstart', onActivity, true);
    window.addEventListener('mousedown', onActivity, true);
    return () => {
      window.removeEventListener('touchstart', onActivity, true);
      window.removeEventListener('mousedown', onActivity, true);
    };
  }, [onActivity, enabled]);

  // Android screen turned back on, or the kiosk tab became visible
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') onActivity();
    });
    return () => sub.remove();
  }, [onActivity, enabled]);

  useEffect(() => {
    if (!enabled || !autosleep) {
      setAsleep(false);
      return;
    }
    const stillIdle = () => shouldSleep(autosleep, Date.now(), lastActiveRef.current);
    const timer = setInterval(() => {
      if (!stillIdle()) {
        setAsleep(false);
        return;
      }
      if (!panelRef.current) {
        setAsleep(true);
        return;
      }
      fetch('/system/sleep', {method: 'POST'})
        .then((res) => res.json())
        .then((body) => {
          // The server saw a touch the page never got (Chromium can drop them)
          if (body?.skipped) markActive();
          else if (stillIdle()) setAsleep(true);
        })
        .catch(() => {
          if (stillIdle()) setAsleep(true);
        });
    }, CHECK_MS);
    return () => clearInterval(timer);
  }, [autosleep, enabled, setAsleep, markActive]);

  return onActivity;
};

export default useAutoSleep;
