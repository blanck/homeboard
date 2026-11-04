import {moveWidget, resolveSlots, slotOptions} from '../src/utils/layout';

test('a saved right column survives with no layout saved', () => {
  expect(resolveSlots({rightModule: 'chores'})).toMatchObject({
    topLeft: 'weather',
    midRight: 'chores',
    bottomCenter: 'playlists',
  });
});

test('picking a widget used elsewhere swaps the two', () => {
  const next = moveWidget(resolveSlots({}), 'midLeft', 'calendar');
  expect(next.midLeft).toBe('calendar');
  expect(next.midCenter).toBe('news');
});

test('a displaced widget that does not fit leaves the old slot empty', () => {
  const slots = {...resolveSlots({}), topLeft: 'countdown'};
  const next = moveWidget(slots, 'bottomLeft', 'countdown');
  expect(next.bottomLeft).toBe('countdown');
  expect(next.topLeft).toBe('none');
});

test('any number of slots can be empty', () => {
  const once = moveWidget(resolveSlots({}), 'topLeft', 'none');
  const twice = moveWidget(once, 'topRight', 'none');
  expect([twice.topLeft, twice.topRight]).toEqual(['none', 'none']);
  expect(twice.topCenter).toBe('clock');
});

test('auto is only offered in the right column', () => {
  expect(slotOptions('midRight')).toContain('auto');
  expect(slotOptions('midLeft')).not.toContain('auto');
});
