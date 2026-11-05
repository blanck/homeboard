import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';

// Aligned runs land this long after the boundary, clear of clock skew
const ALIGN_OFFSET_MS = 30 * 1000;
// A run that never settles must not stall the poller forever
const STUCK_MS = 3 * 60 * 1000;

// The interval in effect; null means paused
export const pollInterval = (intervalMs, asleep, sleepIntervalMs = null) =>
  asleep ? sleepIntervalMs : intervalMs;

// ms until the next run is due (0 = now); null when paused. align puts runs
// on wall-clock multiples of the interval (e.g. the top of the hour)
export const msUntilDue = (lastRun, now, intervalMs, align = false) => {
  if (intervalMs == null) return null;
  if (!lastRun) return 0;
  const due = align
    ? (Math.floor((lastRun - ALIGN_OFFSET_MS) / intervalMs) + 1) * intervalMs + ALIGN_OFFSET_MS
    : lastRun + intervalMs;
  return Math.max(0, due - now);
};

const settleWithin = (promise, ms) => {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
  ]).finally(() => clearTimeout(timer));
};

// Asleep swaps in sleepIntervalMs (null pauses); waking runs only what is overdue.
// runNow(force): force also runs while paused and re-runs after a stale in-flight run
const usePolling = (callback, intervalMs, options = {}) => {
  const opts = typeof options === 'boolean' ? {enabled: options} : options;
  const {enabled = true, asleep = false, sleepIntervalMs = null, align = false} = opts;
  const interval = pollInterval(intervalMs, asleep, sleepIntervalMs);

  const savedCallback = useRef(callback);
  const api = useRef(null);
  if (!api.current) {
    const st = {
      lastRun: 0,
      inFlight: false,
      runningCb: null,
      again: false,
      timer: null,
      dead: false,
      cfg: {enabled: false, interval: null, align: false},
    };
    const schedule = () => {
      clearTimeout(st.timer);
      st.timer = null;
      if (st.dead || st.inFlight || !st.cfg.enabled) return;
      const wait = msUntilDue(st.lastRun, Date.now(), st.cfg.interval, st.cfg.align);
      if (wait == null) return;
      if (wait === 0) run();
      else st.timer = setTimeout(run, wait);
    };
    const run = async () => {
      if (st.dead || !st.cfg.enabled) return;
      if (st.inFlight) {
        if (st.runningCb !== savedCallback.current) st.again = true;
        return;
      }
      clearTimeout(st.timer);
      st.inFlight = true;
      st.lastRun = Date.now();
      st.runningCb = savedCallback.current;
      try {
        await settleWithin(st.runningCb(), STUCK_MS);
      } catch (e) {
        console.warn('poll error:', e);
      }
      st.inFlight = false;
      st.runningCb = null;
      if (st.again) {
        st.again = false;
        run();
      } else {
        schedule();
      }
    };
    const runNow = (force = false) => {
      if (!st.cfg.enabled) return;
      if (st.cfg.interval == null && !force) {
        // Paused: mark overdue so the resume runs it
        st.lastRun = 0;
        return;
      }
      run();
    };
    api.current = {st, schedule, runNow};
  }
  const {st, schedule, runNow} = api.current;

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    st.dead = false;
    return () => {
      st.dead = true;
      clearTimeout(st.timer);
    };
  }, [st]);

  useEffect(() => {
    st.cfg = {enabled, interval, align};
    schedule();
  }, [st, schedule, enabled, interval, align]);

  // Timers can stall in the background; run whatever came due meanwhile
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') schedule();
    });
    return () => sub.remove();
  }, [schedule]);

  return runNow;
};

export default usePolling;
