import React from 'react';
import {View} from 'react-native-web';

const ZERO = {top: 0, right: 0, bottom: 0, left: 0};

export const SafeAreaProvider = ({children, style}) => (
  <View style={[{flex: 1}, style]}>{children}</View>
);

export const SafeAreaView = View;

export const useSafeAreaInsets = () => ZERO;

export const useSafeAreaFrame = () => ({
  x: 0,
  y: 0,
  width: window.innerWidth,
  height: window.innerHeight,
});
