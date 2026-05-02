import React from 'react';
import LottieView from 'lottie-react-native';

const lottieMap = {
  '01d': require('../assets/weather-icons/01d.json'),
  '01n': require('../assets/weather-icons/01n.json'),
  '02d': require('../assets/weather-icons/02d.json'),
  '02n': require('../assets/weather-icons/02n.json'),
  '03d': require('../assets/weather-icons/03d.json'),
  '03n': require('../assets/weather-icons/03n.json'),
  '04d': require('../assets/weather-icons/04d.json'),
  '04n': require('../assets/weather-icons/04n.json'),
  '09d': require('../assets/weather-icons/09d.json'),
  '09n': require('../assets/weather-icons/09n.json'),
  '10d': require('../assets/weather-icons/10d.json'),
  '10n': require('../assets/weather-icons/10n.json'),
  '11d': require('../assets/weather-icons/11d.json'),
  '11n': require('../assets/weather-icons/11n.json'),
  '13d': require('../assets/weather-icons/13d.json'),
  '13n': require('../assets/weather-icons/13n.json'),
  '50d': require('../assets/weather-icons/50d.json'),
  '50n': require('../assets/weather-icons/50n.json'),
};

const WeatherIcon = ({icon, size = 50}) => {
  const source = lottieMap[icon];
  if (!source) return null;
  return (
    <LottieView
      source={source}
      autoPlay
      loop
      style={{width: size, height: size}}
    />
  );
};

export default WeatherIcon;
