import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {
  formatWind,
  formatWindDirection,
  formatCondition,
  formatPressure,
  formatCO2,
  formatFromNow,
} from '../utils/formatting';
import {getFeelslike} from '../utils/weatherIcons';
import {translate} from '../utils/translations';
import {fs} from '../utils/scale';
import WindArrow from '../components/WindArrow';
import WeatherIcon from '../components/WeatherIcon';

const WeatherWidget = ({onPressWeather}) => {
  const weather = useStore((s) => s.weather);
  const condition = useStore((s) => s.currentCondition);
  const forecast = useStore((s) => s.forecast);
  const config = useStore((s) => s.config);

  if (!weather || !weather.outdoor) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>--°</Text>
      </View>
    );
  }

  const outdoor = weather.outdoor;
  const indoor = weather.indoor;
  const lang = config.language || 'en';

  const feelsLike =
    outdoor.wind_speed
      ? getFeelslike(outdoor.Temperature, outdoor.wind_speed / 3.6)
      : null;

  return (
    <View style={styles.container}>
      {/* Temperature */}
      <View style={styles.tempRow}>
        {condition && condition.icon ? (
          <WeatherIcon icon={condition.icon} size={75} />
        ) : null}
        <Text style={styles.temp}>{outdoor.Temperature}°</Text>
      </View>

      {/* Condition description */}
      {condition ? (
        <Text style={styles.condition}>
          {formatCondition(condition.description)}
        </Text>
      ) : null}

      {/* Details */}
      <TouchableOpacity onPress={onPressWeather}>
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Icon name="arrow-collapse-down" size={16} color="#ffffff" />
            <Text style={styles.detailText}> {outdoor.min_temp}°{'   '}</Text>
            <Icon name="arrow-collapse-up" size={16} color="#ffffff" />
            <Text style={styles.detailText}> {outdoor.max_temp}°</Text>
            {feelsLike != null ? (
              <>
                <Text style={styles.detailText}>{'   '}</Text>
                <Icon name="hand-wave-outline" size={16} color="#ffffff" />
                <Text style={styles.detailText}> {feelsLike}°</Text>
              </>
            ) : null}
            <Text style={styles.detailText}>{'   '}</Text>
            <Icon name="water-outline" size={16} color="#ffffff" />
            <Text style={styles.detailText}> {outdoor.Humidity}%</Text>
          </View>
          <View style={styles.windRow}>
            {outdoor.wind_speed && outdoor.wind_deg ? (
              <>
                <WindArrow deg={outdoor.wind_deg} size={24} />
                <Text style={styles.detailText}>
                  {' '}{formatWind(outdoor.wind_speed * 3.6)} m/s{'   '}
                </Text>
              </>
            ) : null}
            {indoor && indoor.Pressure ? (
              <>
                <Icon name="speedometer" size={16} color="#ffffff" />
                <Text style={styles.detailText}>
                  {' '}{formatPressure(indoor.Pressure)}{'   '}
                </Text>
              </>
            ) : null}
            {indoor && indoor.CO2 ? (
              <>
                <Icon name="creation" size={16} color="#ffffff" />
                <Text style={styles.detailText}>
                  {' '}{formatCO2(indoor.CO2)} ppm
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      <Text style={styles.updated}>
        {translate('updated', lang)} {formatFromNow(outdoor.time_utc)}
      </Text>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    fontSize: fs(52),
    fontWeight: 'bold',
    color: '#ffffff',
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  temp: {
    fontSize: fs(52),
    fontWeight: 'bold',
    color: '#ffffff',
  },
  condition: {
    fontSize: fs(28),
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: -4,
  },
  details: {
    marginTop: 8,
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  windRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  detailText: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 2,
  },
  updated: {
    fontSize: fs(8),
    color: '#ffffff',
    fontWeight: '300',
    marginTop: 4,
    opacity: 0.8,
  },
});

export default WeatherWidget;
