import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import calendar from 'dayjs/plugin/calendar';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/sv';

dayjs.extend(relativeTime);
dayjs.extend(calendar);
dayjs.extend(utc);
dayjs.extend(timezone);

// Time formatting — port of updateTime from home.vue:1302-1323
// Falls back to device local time when no timezone is configured
export const formatTime = (tz) => {
  if (tz) {
    return dayjs().tz(tz).format('HH:mm');
  }
  return dayjs().format('HH:mm');
};
export const formatDay = (tz, lang) => {
  const d = tz ? dayjs().tz(tz) : dayjs();
  return d.locale(lang || 'en').format('ddd D MMMM');
};
export const formatRemoteTime = (tz) => {
  if (!tz) {
    return '';
  }
  return dayjs().tz(tz).format('HH:mm');
};
export const formatRemoteAbbr = (tz) => {
  if (!tz) {
    return '';
  }
  return dayjs().tz(tz).format('z');
};

// Weather formatting — port from home.vue
export const formatWind = (windkph) => {
  if (windkph) {
    return (windkph / 3.6).toFixed(0);
  }
  return '- ';
};

export const formatWindDirection = (angle) => angle - 180;

export const formatCondition = (desc) => {
  if (!desc) {
    return '';
  }
  return desc.charAt(0).toUpperCase() + desc.slice(1);
};

export const formatPressure = (pre) => {
  if (pre == null) {
    return '-';
  }
  return pre.toFixed(0);
};

export const formatPressureIcon = (trend) => {
  if (trend === 'up') {
    return 'arrow-up-right';
  }
  if (trend === 'down') {
    return 'arrow-down-right';
  }
  return 'arrow-right';
};

export const formatCO2 = (co) => (co ? co.toFixed(0) : null);

export const formatFromNow = (datetime) => dayjs(datetime * 1000).fromNow();

// Stock formatting — port from home.vue
export const formatPercent = (perc) => {
  if (isNaN(perc)) {
    return '-';
  }
  let output = perc * 100;
  output =
    Math.abs(output).toFixed(1).length > 3 ? output.toFixed(0) : output.toFixed(1);
  output = output + '%';
  if (perc > 0) {
    return '+' + output;
  }
  return output;
};

export const formatStockPrice = (price) => (price ? price.toFixed(0) : '-');

export const formatStockSymbol = (symbol) => symbol.replace('^', '');

// News formatting — port from home.vue
export const formatHeadline = (headline) => {
  if (!headline) {
    return '';
  }
  if (headline.length > 150) {
    return headline.substring(0, 150) + '...';
  }
  return headline;
};

export const formatPublishedTime = (datetime) => {
  const d = dayjs(datetime);
  if (d.isSame(dayjs(), 'day')) {
    return d.format('HH:mm');
  }
  return d.format('MMM D');
};

export const formatArticleContent = (text) =>
  text ? text.replace(/\n/g, '\n') : '';

// Calendar formatting — port from home.vue
export const formatCalendarTime = (datetime, lang) => {
  const d = dayjs(datetime);
  const now = dayjs();
  const diffDays = d.startOf('day').diff(now.startOf('day'), 'day');

  if (diffDays === 0) {
    const formats = lang === 'sv' ? 'Idag' : 'Today at';
    return formats + ' ' + d.format('HH:mm');
  }
  if (diffDays === 1) {
    const formats = lang === 'sv' ? 'Imorgon' : 'Tomorrow at';
    return formats + ' ' + d.format('HH:mm');
  }
  if (diffDays > 1 && diffDays <= 7) {
    return d.locale(lang || 'en').format('dddd HH:mm');
  }
  return d.locale(lang || 'en').format('MMM D HH:mm');
};

export const formatCalendarClass = (datetime) => {
  const d = dayjs(datetime);
  const now = dayjs();
  const diffDays = d.startOf('day').diff(now.startOf('day'), 'day');

  if (diffDays === 0) {
    return 'sameday';
  }
  if (diffDays === 1) {
    return 'nextday';
  }
  if (diffDays > 1 && diffDays <= 7) {
    return 'nextweek';
  }
  return 'default';
};

// Energy formatting — port from home.vue
export const formatEnergyPrice = (price) => {
  if (price < 1) {
    return (price * 100).toFixed(1) + ' öre';
  }
  return (price * 100).toFixed(0) + ' öre';
};

export const formatEnergyDate = (datetime) => dayjs.utc(datetime).fromNow();

export const formatPowerValue = (power, maxPower, powerProduction) => {
  if (power > 0) {
    return parseFloat(power / maxPower);
  }
  if (powerProduction > 0) {
    return parseFloat(powerProduction / maxPower);
  }
  return 0;
};

export const formatPowerText = (watt, powerProduction) => {
  if (watt > 0 && watt < 10000) {
    return watt + ' W';
  }
  if (watt > 0) {
    return (watt / 1000).toFixed(1) + ' kW';
  }
  return '-' + parseFloat(powerProduction || 0) + ' W';
};

export const formatBatteryText = (text) => {
  if (!text) {
    return ['', ''];
  }
  const parts = text.replace('(', '\n').replace(')', '').split('\n');
  return parts;
};

// Last updated formatting
export const formatLastUpdated = (datetime, lang) => {
  if (!datetime) {
    return '';
  }
  const d = dayjs(datetime);
  const now = dayjs();
  const diffDays = d.startOf('day').diff(now.startOf('day'), 'day');

  if (diffDays === 0) {
    const prefix = lang === 'sv' ? 'Idag' : 'Today at';
    return prefix + ' ' + d.format('HH:mm');
  }
  return d.locale(lang || 'en').format('MMM D HH:mm');
};
