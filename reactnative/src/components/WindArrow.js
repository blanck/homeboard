import React from 'react';
import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

const WindArrow = ({deg, size = 16, color = '#ffffff'}) => {
  // Rotate arrow so it points in wind direction (from → to)
  const rotation = (deg - 180) % 360;

  return (
    <View style={{transform: [{rotate: `${rotation}deg`}], width: size, height: size}}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 2 L8 14 L12 11 L16 14 Z"
          fill={color}
        />
      </Svg>
    </View>
  );
};

export default WindArrow;
