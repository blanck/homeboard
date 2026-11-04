// Converts measures inside recipe text for display. Spoons stay as written, and
// weight never crosses to volume: that would need each ingredient's density.
const VULGAR = {
  '½': 1 / 2,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};
const V = Object.keys(VULGAR).join('');
const AMOUNT = `\\d+\\s+\\d+/\\d+|\\d+\\s*[${V}]|\\d+/\\d+|\\d+(?:[.,]\\d+)?|[${V}]`;
const NOT_LETTER = '(?![A-Za-zÀ-ÿ])';

// base is grams or millilitres
const UNITS = [
  {pattern: 'fl\\.?\\s*oz|fluid\\s+ounces?', kind: 'volume', base: 29.57, system: 'imperial'},
  {pattern: 'cups?', kind: 'volume', base: 236.6, system: 'imperial'},
  {pattern: 'pints?', kind: 'volume', base: 473.2, system: 'imperial'},
  {pattern: 'quarts?|qts?', kind: 'volume', base: 946.4, system: 'imperial'},
  {pattern: 'gallons?', kind: 'volume', base: 3785, system: 'imperial'},
  {pattern: 'lbs?|pounds?', kind: 'mass', base: 453.6, system: 'imperial'},
  {pattern: 'oz|ounces?', kind: 'mass', base: 28.35, system: 'imperial'},
  {pattern: 'kg|kilos?|kilogram(?:me)?s?|kilogramm', kind: 'mass', base: 1000, system: 'metric'},
  {pattern: 'g|gr|gram(?:me)?s?|gramm|gramos', kind: 'mass', base: 1, system: 'metric'},
  {pattern: 'ml|millilit(?:er|re)s?', kind: 'volume', base: 1, system: 'metric'},
  {pattern: 'cl', kind: 'volume', base: 10, system: 'metric'},
  {pattern: 'dl', kind: 'volume', base: 100, system: 'metric'},
  {pattern: 'l|lit(?:er|re)s?|litros?', kind: 'volume', base: 1000, system: 'metric'},
].map((u) => ({...u, exact: new RegExp(`^(?:${u.pattern})$`, 'i')}));

const measureRegex = (target) => {
  const units = UNITS.filter((u) => u.system !== target)
    .map((u) => u.pattern)
    .join('|');
  return new RegExp(
    `(?<![\\d.,/])(${AMOUNT})(?:\\s*(?:-|–|to|till)\\s*(${AMOUNT}))?[\\s-]*(${units})${NOT_LETTER}`,
    'gi',
  );
};
const MEASURE = {metric: measureRegex('metric'), imperial: measureRegex('imperial')};

const TEMPERATURE = new RegExp(
  `(?<![\\d.,])(\\d{2,3})(?:\\s*[-–]\\s*(\\d{2,3}))?\\s*(?:°|degrees\\s+|deg\\s+)?\\s*` +
    `(C|F|Celsius|Fahrenheit|grader|Grad|grados|degrés)${NOT_LETTER}`,
  'g',
);

const parseAmount = (text) => {
  const t = text.trim();
  const vulgar = VULGAR[t.slice(-1)];
  if (vulgar != null) return (parseFloat(t) || 0) + vulgar;
  const fraction = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(t);
  if (fraction) return (+fraction[1] || 0) + fraction[2] / fraction[3];
  if (/^\d{1,3},\d{3}$/.test(t)) return +t.replace(',', '');
  return parseFloat(t.replace(',', '.'));
};

const nearest = (v, step) => Math.round(v / step) * step;
const decimal = (v) => String(+v.toFixed(1));
const coarse = (v) => String(nearest(v, v < 10 ? 1 : v < 100 ? 5 : 10));
const halves = (v) => (v < 1 ? decimal(v) : String(nearest(v, 0.5)));

const FRACTIONS = [
  [0, ''],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [1, ''],
];
const fractional = (v) => {
  const amount = Math.max(v, 1 / 4);
  const whole = Math.floor(amount);
  const part = amount - whole;
  const [value, mark] = FRACTIONS.reduce((best, f) =>
    Math.abs(f[0] - part) < Math.abs(best[0] - part) ? f : best,
  );
  return `${whole + (value === 1 ? 1 : 0) || ''}${mark}`;
};

// Picks one unit from the largest amount so both ends of a range share it
const OUTPUT = {
  metric: {
    mass: (max) => (max >= 1000 ? [1000, 'kg', decimal] : [1, 'g', coarse]),
    volume: (max) => (max >= 1000 ? [1000, 'l', decimal] : [1, 'ml', coarse]),
  },
  imperial: {
    mass: (max) => (max >= 453.6 ? [453.6, 'lb', decimal] : [28.35, 'oz', halves]),
    volume: (max) => {
      if (max < 15) return [4.93, 'tsp', fractional];
      if (max < 59) return [14.79, 'tbsp', fractional];
      if (max < 1900) {
        const single = /^(?:1|[¼⅓½⅔¾])$/.test(fractional(max / 236.6));
        return [236.6, single ? 'cup' : 'cups', fractional];
      }
      return [946.4, 'qt', decimal];
    },
  },
};

// "100g/3½oz" and "2 cups (480 ml)" already carry both systems
const PAIRED_AFTER = new RegExp(`^\\s*[/(]\\s*(?:~|ca\\.?\\s*|about\\s*)?[\\d${V}]`);
const PAIRED_BEFORE = new RegExp(`[\\d${V}]\\s*[a-zA-Z.]+\\s*[/(]\\s*$`);

const convertMeasures = (text, target) =>
  text.replace(MEASURE[target], (match, from, to, name, offset) => {
    const before = text.slice(0, offset);
    const after = text.slice(offset + match.length);
    if (PAIRED_AFTER.test(after) || PAIRED_BEFORE.test(before)) return match;
    const unit = UNITS.find((u) => u.exact.test(name.replace(/\s+/g, ' ')));
    if (!unit) return match;
    const low = parseAmount(from) * unit.base;
    const high = to ? parseAmount(to) * unit.base : null;
    const [scale, label, format] = OUTPUT[target][unit.kind](high ?? low);
    const amount = high == null ? format(low / scale) : `${format(low / scale)}-${format(high / scale)}`;
    return `${amount} ${label}`;
  });

const convertTemperatures = (text, target) => {
  const letter = target === 'imperial' ? 'F' : 'C';
  if (new RegExp(`\\d\\s*°?\\s*${letter}${NOT_LETTER}`).test(text)) return text;
  const convert =
    target === 'imperial'
      ? (c) => {
          const f = (c * 9) / 5 + 32;
          return nearest(f, f < 250 ? 5 : 25);
        }
      : (f) => {
          const c = ((f - 32) * 5) / 9;
          return nearest(c, c < 100 ? 1 : 10);
        };
  return text.replace(TEMPERATURE, (match, from, to, scale) => {
    const fahrenheit = /^F/.test(scale);
    if (fahrenheit === (target === 'imperial')) return match;
    const amount = to ? `${convert(+from)}-${convert(+to)}` : convert(+from);
    return `${amount}°${letter}`;
  });
};

export const convertUnits = (text, target) =>
  MEASURE[target] ? convertTemperatures(convertMeasures(text, target), target) : text;

export const deviceUnits = () => {
  try {
    const {locale, timeZone} = new Intl.DateTimeFormat().resolvedOptions();
    const american = /[-_]US(?:[-_]|$)/i.test(locale);
    // Cheap tablets ship as en-US wherever they end up, so the zone must agree
    return american && !/^(Europe|Africa|Asia|Australia)\//.test(timeZone) ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
};

export const resolveUnits = (setting) =>
  setting === 'metric' || setting === 'imperial' ? setting : deviceUnits();
