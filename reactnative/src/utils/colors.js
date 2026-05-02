// Energy price level colors — port from home.vue formatEnergyColor
export const energyColor = (level) => {
  switch (level) {
    case 'VERY_CHEAP':
      return '#3fcf40';
    case 'CHEAP':
      return '#4c9f50';
    case 'NORMAL':
      return '#ffb477';
    case 'EXPENSIVE':
      return '#f57441';
    case 'VERY_EXPENSIVE':
      return '#f83e30';
    default:
      return '#888888';
  }
};

// Solar production color — port from home.vue formatSolarColor
export const solarColor = (percent) => {
  if (percent > 80) {
    return '#3fcf40';
  }
  if (percent > 60) {
    return '#4c9f50';
  }
  if (percent > 40) {
    return '#ffb477';
  }
  if (percent > 20) {
    return '#f57441';
  }
  if (percent > 0) {
    return '#f83e30';
  }
  return '#888888';
};

// Power consumption color — port from home.vue formatPowerColor
export const powerColor = (watt, max) => {
  if (watt > max * 0.9) {
    return '#f83e30';
  }
  if (watt > max * 0.7) {
    return '#f57441';
  }
  if (watt > max * 0.5) {
    return '#ffb477';
  }
  if (watt > max * 0.3) {
    return '#4c9f50';
  }
  return '#3fcf40';
};

// Stock change color
export const stockColor = (perc) => {
  if (perc > 0) {
    return '#4caf50';
  }
  if (perc < 0) {
    return '#f44336';
  }
  return '#888888';
};

// Stock type border colors
export const stockTypeBorder = (quoteType) => {
  switch (quoteType) {
    case 'INDEX':
      return 'rgba(72, 197, 0, 0.692)';
    case 'ETF':
      return 'rgba(212, 181, 9, 0.616)';
    case 'EQUITY':
      return 'rgba(8, 89, 196, 0.726)';
    case 'FUTURE':
      return 'rgba(8, 189, 196, 0.726)';
    default:
      return 'rgba(100, 100, 100, 0.5)';
  }
};

// Calendar proximity colors
export const calendarColors = {
  sameday: {bg: 'rgba(255, 100, 100, 0.3)', border: 'rgba(255, 100, 100, 0.5)'},
  nextday: {bg: 'rgba(243, 173, 43, 0.3)', border: 'rgba(255, 166, 33, 0.5)'},
  nextweek: {bg: 'rgba(100, 255, 100, 0.3)', border: 'rgba(100, 255, 100, 0.5)'},
  default: {bg: 'rgba(200, 200, 200, 0.3)', border: 'rgba(100, 100, 100, 0.5)'},
};

// Dark theme constants from app.css
export const theme = {
  background: '#000000',
  cardBg: 'rgba(0, 0, 0, 0.6)',
  middleCardBg: 'rgba(205, 215, 235, 0.8)',
  middleCardText: '#333333',
  middleTitleText: '#555555',
  textPrimary: '#ffffff',
  textSecondary: '#888888',
  textMuted: '#666666',
  accent: '#3e88c4',
  newsRowBg: 'rgba(255, 255, 255, 0.3)',
  newsRowBorder: 'rgba(255, 255, 255, 0.2)',
  stockRowBg: 'rgba(230, 230, 230, 0.2)',
};
