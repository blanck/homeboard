import React from 'react';
import {Switch, Text, TouchableOpacity} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import useStore from '../src/store';
import LaMarzoccoPopup from '../src/components/LaMarzoccoPopup';
import * as service from '../src/services/lamarzoccoService';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../src/services/lamarzoccoService', () => ({
  fetchLaMarzoccoStatus: jest.fn(() => Promise.resolve(null)),
  setLaMarzoccoCoffeeTemperature: jest.fn(() => Promise.resolve(true)),
  setLaMarzoccoSteam: jest.fn(() => Promise.resolve(true)),
  setLaMarzoccoSteamLevel: jest.fn(() => Promise.resolve(true)),
  startLaMarzoccoBackflush: jest.fn(() => Promise.resolve(true)),
}));

const SERIAL = 'LM0001';
const machine = {
  connected: true,
  status: 'PoweredOn',
  coffeeBoiler: {temperature: 94, min: 80, max: 100},
  steamBoiler: {enabled: false, canToggle: true, level: 'Level2'},
  backflush: {status: 'Off', lastCleaned: null},
};

const render = async (overrides = {}) => {
  useStore.setState({
    lamarzocco: {...machine, ...overrides},
    lamarzoccoPopupVisible: true,
    config: {language: 'en', smartDevices: {lamarzocco: {serialNumber: SERIAL}}},
  });
  let tree;
  await act(async () => {
    tree = ReactTestRenderer.create(<LaMarzoccoPopup />);
  });
  return tree;
};

const texts = tree =>
  tree.root.findAllByType(Text).map(t => [t.props.children].flat().join(''));

const button = (tree, label) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find(b =>
      b.findAllByType(Text).some(t => t.props.children === label),
    );

const press = async node => {
  await act(async () => {
    node.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('refreshes the machine state when it opens', async () => {
  await render();
  expect(service.fetchLaMarzoccoStatus).toHaveBeenCalledWith(SERIAL);
});

test('backflush asks first and only fires on the second tap', async () => {
  const tree = await render();

  await press(button(tree, 'Start'));
  expect(service.startLaMarzoccoBackflush).not.toHaveBeenCalled();
  expect(texts(tree).join(' ')).toContain('15 seconds');

  await press(button(tree, 'Start'));
  expect(service.startLaMarzoccoBackflush).toHaveBeenCalledTimes(1);
  expect(service.startLaMarzoccoBackflush).toHaveBeenCalledWith(SERIAL);
  expect(texts(tree).join(' ')).toContain('Turn the paddle now');
});

test('cancelling never starts a backflush', async () => {
  const tree = await render();
  await press(button(tree, 'Start'));
  await press(button(tree, 'Cancel'));
  expect(service.startLaMarzoccoBackflush).not.toHaveBeenCalled();
});

test('backflush is blocked while the machine is off', async () => {
  const tree = await render({status: 'StandBy'});
  expect(button(tree, 'Start').props.disabled).toBe(true);
  expect(texts(tree)).toContain('Turn the machine on first');
});

test('backflush is blocked while one is already running', async () => {
  const tree = await render({backflush: {status: 'Cleaning'}});
  expect(button(tree, 'Start').props.disabled).toBe(true);
  expect(texts(tree)).toContain('Backflush is running');
});

test('a few temperature taps send one command', async () => {
  const tree = await render();
  const plus = tree.root.findByProps({accessibilityLabel: '+'});

  await press(plus);
  await press(plus);
  await press(plus);
  expect(service.setLaMarzoccoCoffeeTemperature).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(800);
  });
  expect(service.setLaMarzoccoCoffeeTemperature).toHaveBeenCalledTimes(1);
  expect(service.setLaMarzoccoCoffeeTemperature).toHaveBeenCalledWith(SERIAL, 95.5);
});

test('the temperature stays inside the range the machine reports', async () => {
  const tree = await render({coffeeBoiler: {temperature: 100, min: 80, max: 100}});
  await press(tree.root.findByProps({accessibilityLabel: '+'}));
  await act(async () => {
    jest.advanceTimersByTime(800);
  });
  expect(service.setLaMarzoccoCoffeeTemperature).toHaveBeenCalledWith(SERIAL, 100);
});

test('steam follows the switch and shows a failure', async () => {
  const tree = await render();
  service.setLaMarzoccoSteam.mockResolvedValueOnce(false);

  await act(async () => {
    tree.root.findByType(Switch).props.onValueChange(true);
  });
  expect(service.setLaMarzoccoSteam).toHaveBeenCalledWith(SERIAL, true);
  expect(useStore.getState().lamarzocco.steamBoiler.enabled).toBe(false);
  expect(texts(tree).join(' ')).toContain('did not take that command');
});

test('steam level updates once accepted', async () => {
  const tree = await render();
  await press(button(tree, 3));
  expect(service.setLaMarzoccoSteamLevel).toHaveBeenCalledWith(SERIAL, 'Level3');
  expect(useStore.getState().lamarzocco.steamBoiler.level).toBe('Level3');
});
