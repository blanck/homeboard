// The dashboard grid is fixed: each slot picks from the widgets that fit its row
const NONE = 'none';

export const SLOT_ROWS = [
  {
    title: 'layoutTop',
    slots: ['topLeft', 'topCenter', 'topRight'],
    widgets: ['weather', 'clock', 'forecast', 'countdown'],
  },
  {
    title: 'layoutMiddle',
    slots: ['midLeft', 'midCenter', 'midRight'],
    widgets: ['news', 'calendar', 'stocks', 'energy', 'todo', 'headlines', 'chores', 'countdown', 'meals'],
  },
  {
    title: 'layoutBottom',
    slots: ['bottomLeft', 'bottomCenter'],
    widgets: ['sonos', 'playlists', 'countdown'],
  },
];

const DEFAULT_SLOTS = {
  topLeft: 'weather',
  topCenter: 'clock',
  topRight: 'forecast',
  midLeft: 'news',
  midCenter: 'calendar',
  bottomLeft: 'sonos',
  bottomCenter: 'playlists',
};

// midRight stays in config.rightModule, which LAN sync and older saves use
export const resolveSlots = (config) => ({
  ...DEFAULT_SLOTS,
  ...config.layout?.slots,
  midRight: config.rightModule || 'auto',
});

export const formSlots = (form) =>
  resolveSlots({rightModule: form.rightModule, layout: {slots: form.layoutSlots}});

export const slotOptions = (slot) => {
  const row = SLOT_ROWS.find((r) => r.slots.includes(slot));
  return [...(slot === 'midRight' ? ['auto'] : []), ...row.widgets, NONE];
};

// A widget lives in one slot: picking it elsewhere swaps the two, or empties
// the old slot when the displaced widget does not fit there
export const moveWidget = (slots, slot, widget) => {
  const next = {...slots, [slot]: widget};
  const from = Object.keys(slots).find((s) => s !== slot && slots[s] === widget);
  if (widget !== NONE && from) {
    next[from] = slotOptions(from).includes(slots[slot]) ? slots[slot] : NONE;
  }
  return next;
};
