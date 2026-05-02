import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {fs} from '../utils/scale';
import {formatWind} from '../utils/formatting';
import WindArrow from '../components/WindArrow';

// Map Met.no symbol_code to MaterialIcons name
const metnoIcon = (code) => {
  if (!code) return 'thermostat';
  const c = code.replace(/_day|_night|_polartwilight/g, '');
  const map = {
    clearsky: 'white-balance-sunny',
    fair: 'weather-partly-cloudy',
    partlycloudy: 'weather-partly-cloudy',
    cloudy: 'weather-cloudy',
    fog: 'weather-fog',
    rain: 'weather-rainy',
    lightrain: 'weather-partly-rainy',
    heavyrain: 'weather-pouring',
    rainshowers: 'weather-partly-rainy',
    lightrainshowers: 'weather-partly-rainy',
    heavyrainshowers: 'weather-pouring',
    sleet: 'weather-snowy-rainy',
    lightsleet: 'weather-snowy-rainy',
    heavysleet: 'weather-snowy-rainy',
    sleetshowers: 'weather-snowy-rainy',
    lightsleetshowers: 'weather-snowy-rainy',
    heavysleetshowers: 'weather-snowy-rainy',
    snow: 'weather-snowy',
    lightsnow: 'weather-snowy',
    heavysnow: 'weather-snowy-heavy',
    snowshowers: 'weather-snowy',
    lightsnowshowers: 'weather-snowy',
    heavysnowshowers: 'weather-snowy-heavy',
    rainandthunder: 'weather-lightning-rainy',
    lightrainandthunder: 'weather-lightning-rainy',
    heavyrainandthunder: 'weather-lightning-rainy',
    rainshowersandthunder: 'weather-lightning-rainy',
    lightrainshowersandthunder: 'weather-lightning-rainy',
    heavyrainshowersandthunder: 'weather-lightning-rainy',
    sleetandthunder: 'weather-lightning-rainy',
    snowandthunder: 'weather-lightning-rainy',
    sleetshowersandthunder: 'weather-lightning-rainy',
    snowshowersandthunder: 'weather-lightning-rainy',
  };
  return map[c] || 'thermometer';
};

// Map Netatmo numeric weather symbol to MaterialIcons name
const netatmoIcon = (symbol) => {
  if (!symbol) return 'wb-sunny';
  const s = String(symbol);
  if (s.length >= 3) {
    const rain = parseInt(s[2], 10) || 0;
    const snow = parseInt(s[3], 10) || 0;
    const specials = parseInt(s[5], 10) || 0;
    if (specials === 1) return 'weather-lightning-rainy';
    if (snow > 0) return 'weather-snowy';
    if (rain > 1) return 'weather-pouring';
    if (rain > 0) return 'weather-rainy';
    const clouds = parseInt(s[1], 10) || 0;
    if (clouds > 1) return 'weather-cloudy';
    if (clouds > 0) return 'weather-partly-cloudy';
  }
  return 'white-balance-sunny';
};

const WeatherIcon = ({name}) => (
  <Icon name={name} size={30} color="#ffffff" style={styles.weatherIcon} />
);

const ForecastWidget = () => {
  const forecast = useStore((s) => s.forecast);
  const config = useStore((s) => s.config);

  // Netatmo-style forecast (forecastDays array)
  if (forecast && forecast.forecastDays) {
    return (
      <View style={styles.container}>
        <View style={styles.daysRow}>
          {forecast.forecastDays.map((day, index) => (
            <View key={index} style={styles.dayCol}>
              <Text style={styles.dayName}>{day.day_locale}</Text>
              {day.weathersymbol ? (
                <WeatherIcon name={netatmoIcon(day.weathersymbol)} />
              ) : null}
              <Text style={styles.dayTemp}>
                {day.min_temp} – {day.max_temp}°
              </Text>
              <View style={styles.windRow}>
                <WindArrow deg={day.winddirection} size={32} />
                <Text style={styles.dayWind}>
                  {' '}{formatWind(day.windgust)} m/s
                  {day.rain > 1 ? ` ${formatWind(day.rain)} mm` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Met.no forecast (timeseries array)
  if (forecast && Array.isArray(forecast) && forecast.length > 0) {
    return (
      <View style={styles.container}>
        <View style={styles.daysRow}>
          {forecast.slice(0, 3).map((entry, index) => {
            const data = entry.data;
            const instant = data?.instant?.details;
            const next6 = data?.next_6_hours;
            const symbolCode = next6?.summary?.symbol_code;
            return (
              <View key={index} style={styles.dayCol}>
                <Text style={styles.dayName}>
                  {new Date(entry.time).toLocaleDateString(config.language, {
                    weekday: 'short',
                  })}
                </Text>
                {symbolCode ? (
                  <WeatherIcon name={metnoIcon(symbolCode)} />
                ) : null}
                <Text style={styles.dayTemp}>
                  {next6?.details?.air_temperature_min?.toFixed(0) || '--'} –{' '}
                  {next6?.details?.air_temperature_max?.toFixed(0) || '--'}°
                </Text>
                {instant?.wind_speed ? (
                  <View style={styles.windRow}>
                    <WindArrow deg={instant.wind_from_direction} size={32} />
                    <Text style={styles.dayWind}>
                      {' '}{instant.wind_speed.toFixed(0)} m/s
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.loading}>--</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayCol: {
    alignItems: 'center',
    flex: 1,
  },
  dayName: {
    fontSize: fs(16),
    fontWeight: '400',
    color: '#ffffff',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  weatherIcon: {
    marginBottom: 4,
  },
  dayTemp: {
    fontSize: fs(24),
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  windRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  dayWind: {
    fontSize: fs(14),
    color: '#ffffff',
  },
  loading: {
    fontSize: fs(20),
    color: '#ffffff',
    textAlign: 'center',
  },
});

export default ForecastWidget;
