jest.mock('react-native-udp', () => ({createSocket: jest.fn()}));
import {isIdleTrack} from '../src/services/sonosService';

const empty = {title: '', artist: '', album: '', duration: 0, position: 0, grouped: false};

test('empty transport is idle', () => {
  expect(isIdleTrack(empty)).toBe(true);
});

test('real track, stream title, group member and missing data are not idle', () => {
  expect(isIdleTrack({...empty, title: 'Song', duration: 200})).toBe(false);
  expect(isIdleTrack({...empty, title: 'P1 Live'})).toBe(false);
  expect(isIdleTrack({...empty, grouped: true})).toBe(false);
  expect(isIdleTrack(null)).toBe(false);
});

describe('group volume', () => {
  const {offsetVolumes, averageVolume} = require('../src/services/sonosService');

  test('moves every speaker by the same step and keeps the balance', () => {
    expect(offsetVolumes([20, 40], 10)).toEqual([30, 50]);
  });

  test('clamps at 0 and 100 without moving the others further', () => {
    expect(offsetVolumes([5, 50, 98], -10)).toEqual([0, 40, 88]);
    expect(offsetVolumes([5, 50, 98], 10)).toEqual([15, 60, 100]);
  });

  test('average of the group', () => {
    expect(averageVolume([20, 40])).toBe(30);
    expect(averageVolume([])).toBe(0);
  });
});
