jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import usePolling, {msUntilDue, pollInterval} from '../src/hooks/usePolling';
import {shouldSleep} from '../src/hooks/useAutoSleep';
import {isQuotaStatus, nextUtcMidnight} from '../src/services/newsService';
import useStore from '../src/store';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

describe('poll schedule', () => {
  test('asleep swaps in the sleep interval, null pauses', () => {
    expect(pollInterval(10 * MIN, false, HOUR)).toBe(10 * MIN);
    expect(pollInterval(10 * MIN, true, HOUR)).toBe(HOUR);
    expect(pollInterval(10 * MIN, true, null)).toBeNull();
  });

  test('never run is due now, paused is never due', () => {
    expect(msUntilDue(0, 1000, MIN)).toBe(0);
    expect(msUntilDue(1000, 2000, null)).toBeNull();
  });

  test('fresh runs wait out the interval, stale ones are due now', () => {
    const t = Date.UTC(2026, 0, 1, 10, 5);
    expect(msUntilDue(t, t + 4 * MIN, 10 * MIN)).toBe(6 * MIN);
    expect(msUntilDue(t, t + 11 * MIN, 10 * MIN)).toBe(0);
  });

  test('aligned runs land just after the top of the hour', () => {
    const t = Date.UTC(2026, 0, 1, 10, 5);
    expect(msUntilDue(t, t, HOUR, true)).toBe(55 * MIN + 30 * 1000);
    // Waking at 00:05 after a 23:50 fetch: the day turned over, refetch
    const late = Date.UTC(2026, 0, 1, 23, 50);
    expect(msUntilDue(late, late + 15 * MIN, HOUR, true)).toBe(0);
  });
});

describe('sleep window', () => {
  const at = (h, m = 0) => new Date(2026, 0, 1, h, m).getTime();

  test('needs both the night window and an idle period', () => {
    expect(shouldSleep('22-07', at(23), at(22, 50))).toBe(true);
    expect(shouldSleep('22-07', at(23), at(23) - 5000)).toBe(false);
    expect(shouldSleep('22-07', at(12), at(8))).toBe(false);
    expect(shouldSleep('', at(23), at(20))).toBe(false);
  });
});

describe('news quota', () => {
  test('429 everywhere, 402 only where it means quota', () => {
    expect(isQuotaStatus('newsapiorg', 429)).toBe(true);
    expect(isQuotaStatus('thenewsapi', 402)).toBe(true);
    expect(isQuotaStatus('newsdata', 402)).toBe(false);
    expect(isQuotaStatus('newsdata', 500)).toBe(false);
  });

  test('cooldown ends at the next UTC midnight', () => {
    expect(nextUtcMidnight(Date.UTC(2026, 0, 31, 23, 59))).toBe(Date.UTC(2026, 1, 1));
  });
});

describe('usePolling', () => {
  let runNow;
  const Probe = ({cb, interval, opts}) => {
    runNow = usePolling(cb, interval, opts);
    return null;
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const mount = async (cb, interval, opts) => {
    let root;
    await act(async () => {
      root = ReactTestRenderer.create(<Probe cb={cb} interval={interval} opts={opts} />);
    });
    return {
      update: (next) =>
        act(async () => {
          root.update(<Probe cb={cb} interval={interval} opts={{...opts, ...next}} />);
        }),
      unmount: () => act(async () => root.unmount()),
    };
  };

  test('a slow run is never started twice', async () => {
    let resolve;
    const cb = jest.fn(() => new Promise((r) => (resolve = r)));
    const p = await mount(cb, MIN, {enabled: true});
    expect(cb).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(2 * MIN);
      runNow();
      runNow(true);
    });
    expect(cb).toHaveBeenCalledTimes(1);
    // Overdue by the time it settles, so the next one follows at once
    await act(async () => resolve());
    expect(cb).toHaveBeenCalledTimes(2);
    // A run that never settles stops blocking after the stuck limit
    await act(async () => jest.advanceTimersByTime(4 * MIN));
    expect(cb).toHaveBeenCalledTimes(3);
    await p.unmount();
  });

  test('paused while asleep, wake runs only what is overdue', async () => {
    const cb = jest.fn(() => Promise.resolve());
    const p = await mount(cb, 30 * MIN, {enabled: true, asleep: false, sleepIntervalMs: null});
    expect(cb).toHaveBeenCalledTimes(1);

    // Asleep 10 min after the run, woken 5 min later: still fresh
    await act(async () => jest.advanceTimersByTime(10 * MIN));
    await p.update({asleep: true});
    await act(async () => jest.advanceTimersByTime(5 * MIN));
    await p.update({asleep: false});
    expect(cb).toHaveBeenCalledTimes(1);

    // Asleep for hours: no runs, then one on wake
    await p.update({asleep: true});
    await act(async () => jest.advanceTimersByTime(5 * HOUR));
    expect(cb).toHaveBeenCalledTimes(1);
    runNow();
    expect(cb).toHaveBeenCalledTimes(1);
    await p.update({asleep: false});
    expect(cb).toHaveBeenCalledTimes(2);
    await p.unmount();
  });

  test('stretched while asleep', async () => {
    const cb = jest.fn(() => Promise.resolve());
    const p = await mount(cb, 10 * MIN, {enabled: true, asleep: true, sleepIntervalMs: HOUR});
    await act(async () => jest.advanceTimersByTime(59 * MIN));
    expect(cb).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(2 * MIN));
    expect(cb).toHaveBeenCalledTimes(2);
    await p.unmount();
  });
});

describe('store', () => {
  test('keyed refreshes merge until consumed, null means all', () => {
    useStore.setState({refreshKeys: []});
    useStore.getState().requestRefresh(['news']);
    useStore.getState().requestRefresh(['tibber']);
    expect(useStore.getState().refreshKeys).toEqual(['news', 'tibber']);
    useStore.getState().requestRefresh();
    useStore.getState().requestRefresh(['news']);
    expect(useStore.getState().refreshKeys).toBeNull();
  });

  test('setAsleep only notifies on change', () => {
    const listener = jest.fn();
    const unsub = useStore.subscribe(listener);
    useStore.getState().setAsleep(false);
    expect(listener).not.toHaveBeenCalled();
    useStore.getState().setAsleep(true);
    expect(listener).toHaveBeenCalledTimes(1);
    useStore.getState().setAsleep(false);
    unsub();
  });
});
