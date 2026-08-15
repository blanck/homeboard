// Chore scheduling and scoring. Definitions live in config (synced with the
// other settings), completions live in AsyncStorage keyed by chore + period
// so a recurring chore resets itself when its period rolls over.

export const MEMBER_COLORS = [
  '#3e88c4',
  '#4caf50',
  '#f57441',
  '#9c6ade',
  '#e0568a',
  '#00acc1',
  '#d4b509',
  '#7cb342',
];

export const CHORE_ICONS = [
  'broom',
  'silverware-fork-knife',
  'trash-can-outline',
  'washing-machine',
  'dishwasher',
  'bed',
  'dog',
  'cat',
  'flower',
  'leaf',
  'school',
  'tooth-outline',
  'shopping',
  'car-wash',
  'water-outline',
  'checkbox-marked-circle-outline',
];

export const DEFAULT_ICON = 'checkbox-marked-circle-outline';

const MS_DAY = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

export const dayKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Local-midnight ordinal, used for rotation and week math
const dayOrdinal = (date) =>
  Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_DAY,
  );

// Monday-based week start
export const weekStartMs = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7;
  return d.getTime() - shift * MS_DAY;
};

export const dayStartMs = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const daysInMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

export const isDue = (chore, date) => {
  switch (chore.recurrence) {
    case 'weekly': {
      const days = chore.days && chore.days.length ? chore.days : [1];
      return days.includes(date.getDay());
    }
    case 'monthly': {
      const wanted = Math.min(chore.dayOfMonth || 1, daysInMonth(date));
      return date.getDate() === wanted;
    }
    case 'once':
      return true;
    case 'daily':
    default:
      return true;
  }
};

// One completion slot per occurrence
export const periodKey = (chore, date) => {
  switch (chore.recurrence) {
    case 'monthly':
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    case 'once':
      return 'once';
    default:
      return dayKey(date);
  }
};

export const completionKey = (chore, date) =>
  `${chore.id}:${periodKey(chore, date)}`;

// Which occurrence this is, so rotation advances one step per period
const periodOrdinal = (chore, date) => {
  switch (chore.recurrence) {
    case 'monthly':
      return date.getFullYear() * 12 + date.getMonth();
    case 'once':
      return 0;
    default:
      return dayOrdinal(date);
  }
};

// '' = anyone (ask), a member id = fixed, 'rotate' = round-robin over members
export const resolveAssignee = (chore, members, date) => {
  if (!members.length) {
    return null;
  }
  if (chore.assignee === 'rotate') {
    const pool = chore.rotateMembers && chore.rotateMembers.length
      ? members.filter((m) => chore.rotateMembers.includes(m.id))
      : members;
    if (!pool.length) {
      return null;
    }
    const i = ((periodOrdinal(chore, date) % pool.length) + pool.length) % pool.length;
    return pool[i].id;
  }
  if (chore.assignee && members.some((m) => m.id === chore.assignee)) {
    return chore.assignee;
  }
  if (members.length === 1) {
    return members[0].id;
  }
  return null;
};

export const memberColor = (members, id) => {
  const m = members.find((x) => x.id === id);
  return (m && m.color) || '#888888';
};

export const memberName = (members, id) => {
  const m = members.find((x) => x.id === id);
  return (m && m.name) || '';
};

// Avatar labels that stay distinct: one letter when it is unique, otherwise
// word initials, then longer prefixes. Two Ms in the family must not look alike
export const uniqueLabels = (members) => {
  const used = new Set();
  const out = {};
  members.forEach((m, idx) => {
    const clean = (m.name || '?').trim();
    const words = clean.split(/\s+/);
    const candidates = [clean.slice(0, 1)];
    if (words.length > 1) {
      candidates.push(words[0].charAt(0) + words[1].charAt(0));
    }
    candidates.push(clean.slice(0, 2), clean.slice(0, 3), `${clean.slice(0, 1)}${idx + 1}`);
    const label =
      candidates
        .map((c) => c.toUpperCase())
        .find((c) => c && !used.has(c)) || String(idx + 1);
    used.add(label);
    out[m.id] = label;
  });
  return out;
};

// Chores to show for `date`: everything due, minus one-off chores that were
// ticked off on an earlier day
export const choresForDate = (items, log, date) => {
  const dayStart = dayStartMs(date);
  return items.filter((chore) => {
    if (!chore.name) {
      return false;
    }
    if (!isDue(chore, date)) {
      return false;
    }
    if (chore.recurrence === 'once') {
      const done = log[completionKey(chore, date)];
      return !done || done.at >= dayStart;
    }
    return true;
  });
};

export const pointsSince = (log, memberId, sinceMs) =>
  Object.values(log).reduce(
    (sum, entry) =>
      entry && entry.by === memberId && entry.at >= sinceMs
        ? sum + (entry.points || 0)
        : sum,
    0,
  );

// Drop completions older than the retention window, keeping open one-off
// chores (their entries carry their own timestamp anyway)
export const pruneLog = (log, nowMs, keepDays = 60) => {
  const cutoff = nowMs - keepDays * MS_DAY;
  const next = {};
  let changed = false;
  for (const [key, entry] of Object.entries(log)) {
    if (entry && entry.at >= cutoff) {
      next[key] = entry;
    } else {
      changed = true;
    }
  }
  return changed ? next : log;
};

export const newId = (prefix) =>
  `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

// Build a chore from a quick-add preset. Weekly presets spread across the week
// so everything does not land on the same day
export const choreFromPreset = (preset, lang, index = 0) => ({
  id: newId('c'),
  libKey: preset.key,
  name: lang === 'sv' ? preset.sv : preset.en,
  icon: preset.icon,
  points: preset.points,
  assignee: '',
  rotateMembers: [],
  recurrence: preset.recurrence,
  days: preset.recurrence === 'weekly' ? [(index % 5) + 1] : [],
  dayOfMonth: 1,
});
