import React from 'react';
import LottieView from 'lottie-react-native';

import anim01d from '../assets/weather-icons/01d.json';
import anim01n from '../assets/weather-icons/01n.json';
import anim02d from '../assets/weather-icons/02d.json';
import anim02n from '../assets/weather-icons/02n.json';
import anim03d from '../assets/weather-icons/03d.json';
import anim03n from '../assets/weather-icons/03n.json';
import anim04d from '../assets/weather-icons/04d.json';
import anim04n from '../assets/weather-icons/04n.json';
import anim09d from '../assets/weather-icons/09d.json';
import anim09n from '../assets/weather-icons/09n.json';
import anim10d from '../assets/weather-icons/10d.json';
import anim10n from '../assets/weather-icons/10n.json';
import anim11d from '../assets/weather-icons/11d.json';
import anim11n from '../assets/weather-icons/11n.json';
import anim13d from '../assets/weather-icons/13d.json';
import anim13n from '../assets/weather-icons/13n.json';
import anim50d from '../assets/weather-icons/50d.json';
import anim50n from '../assets/weather-icons/50n.json';

const lottieMap = {
  '01d': anim01d,
  '01n': anim01n,
  '02d': anim02d,
  '02n': anim02n,
  '03d': anim03d,
  '03n': anim03n,
  '04d': anim04d,
  '04n': anim04n,
  '09d': anim09d,
  '09n': anim09n,
  '10d': anim10d,
  '10n': anim10n,
  '11d': anim11d,
  '11n': anim11n,
  '13d': anim13d,
  '13n': anim13n,
  '50d': anim50d,
  '50n': anim50n,
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
