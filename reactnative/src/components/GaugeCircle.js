import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {fs} from '../utils/scale';

const GaugeCircle = ({
  value = 0,
  valueText = '',
  valueTextColor = '#ffffff',
  borderColor = '#3fcf40',
  borderBgColor = '#333333',
  borderWidth = 7,
  size = 140,
  labelText = '',
  labelTextColor = '#888888',
  subText = '',
  subTextColor = '#888888',
}) => {
  const radius = (size - borderWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(value, 0), 1);
  const strokeDashoffset = circumference * (1 - clampedValue);
  const center = size / 2;

  return (
    <View style={[styles.container, {width: size, height: labelText ? size + 20 : size}]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={borderBgColor}
          strokeWidth={borderWidth}
          fill="transparent"
        />
        {/* Value circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={borderColor}
          strokeWidth={borderWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${center}, ${center})`}
        />
      </Svg>
      <View style={[styles.valueContainer, {width: size, height: size}]}>
        <Text
          style={[styles.valueText, {color: valueTextColor}]}
          numberOfLines={1}>
          {valueText}
        </Text>
        {subText ? (
          <Text
            style={[styles.subText, {color: subTextColor}]}
            numberOfLines={1}>
            {subText}
          </Text>
        ) : null}
      </View>
      {labelText ? (
        <Text
          style={[styles.labelText, {color: labelTextColor}]}
          numberOfLines={1}>
          {labelText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  valueContainer: {
    position: 'absolute',
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueText: {
    fontSize: fs(18),
    fontWeight: 'bold',
  },
  subText: {
    fontSize: fs(9),
    marginTop: 2,
    textAlign: 'center',
  },
  labelText: {
    fontSize: fs(11),
    marginTop: -16,
    textAlign: 'center',
  },
});

export default GaugeCircle;
