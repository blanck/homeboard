import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {fs} from '../utils/scale';

const WidgetCard = ({
  children,
  title,
  style,
  titleStyle,
  variant = 'default', // 'default' (dark), 'light' (middle row), 'bottom'
}) => {
  const containerStyle = [
    styles.container,
    variant === 'light' && styles.lightContainer,
    variant === 'bottom' && styles.bottomContainer,
    style,
  ];

  const textStyle = [
    styles.title,
    variant === 'light' && styles.lightTitle,
    titleStyle,
  ];

  return (
    <View style={containerStyle}>
      {title ? <Text style={textStyle}>{title}</Text> : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
  },
  lightContainer: {
    backgroundColor: 'rgba(205, 215, 235, 0.8)',
    borderRadius: 8,
    margin: 4,
  },
  bottomContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    margin: 4,
    padding: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: fs(12),
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  lightTitle: {
    color: '#555555',
  },
});

export default WidgetCard;
