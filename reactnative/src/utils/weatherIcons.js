// Port of src/js/weather.js getIcon
export const getIcon = (symbol) => {
  if (!symbol) {
    return null;
  }

  const digits = symbol
    .toString()
    .split('')
    .map((d) => parseInt(d, 10));

  const sun = digits[0] || 0;
  const clouds = digits[1] || 0;
  const rain = digits[2] || 0;
  const snow = digits[3] || 0;
  const hail = digits[4] || 0;
  const specials = digits[5] || 0;

  const sunMoonMap = ['', 'sun', 'moon'];
  const specialsMap = ['', 'lightning', 'warning', 'fog', 'wind', 'flooding'];

  const tempParts = [];
  if (sun > 0) {
    tempParts.push(sunMoonMap[sun]);
  }
  if (clouds > 0) {
    tempParts.push(clouds + '-cloud');
  }
  if (rain > 0) {
    tempParts.push(rain + '-rain');
  }
  if (snow > 0) {
    tempParts.push(snow + '-snow');
  }
  if (hail > 0) {
    tempParts.push(hail + '-hail');
  }
  if (specials > 0) {
    tempParts.push(specialsMap[specials]);
  }

  let finalParts = tempParts;

  // Lightning Rule
  if (specials === 1 && (rain > 0 || snow > 0 || hail > 0)) {
    finalParts = tempParts.filter(
      (p) =>
        p.includes('sun') ||
        p.includes('moon') ||
        p.includes('cloud') ||
        p.includes('lightning'),
    );
  }
  // Sleet Rule
  else if (clouds > 0 && rain > 0 && snow > 0) {
    finalParts = tempParts.filter((p) => !p.includes('rain'));
  }

  let iconName = finalParts.join('+');
  if (iconName.substring(0, 1) === '+') {
    iconName = iconName.substring(1);
  }

  return [iconName];
};

// Port of src/js/weather.js getFeelslike
export const getFeelslike = (t, w) => {
  return parseInt(
    13.12 +
      0.615 * parseFloat(t) -
      11.37 * (parseFloat(w) * 3.6) ** 0.16 +
      0.3965 * parseFloat(t) * (parseFloat(w) * 3.6) ** 0.16,
    10,
  );
};

// Map OpenWeatherMap icon codes to simple descriptions for RN rendering
export const owmIconMap = {
  '01d': 'clear-day',
  '01n': 'clear-night',
  '02d': 'partly-cloudy-day',
  '02n': 'partly-cloudy-night',
  '03d': 'cloudy',
  '03n': 'cloudy',
  '04d': 'overcast',
  '04n': 'overcast',
  '09d': 'rain',
  '09n': 'rain',
  '10d': 'rain-day',
  '10n': 'rain-night',
  '11d': 'thunderstorm',
  '11n': 'thunderstorm',
  '13d': 'snow',
  '13n': 'snow',
  '50d': 'fog',
  '50n': 'fog',
};
