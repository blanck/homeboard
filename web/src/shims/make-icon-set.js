import React from 'react';
import {Text} from 'react-native-web';

// Minimal web replacement for react-native-vector-icons: render the glyph
// from the icon ttf (loaded as a FontFace in main.jsx) inside a Text.
const makeIconSet = (glyphMap, fontFamily) => {
  const Icon = ({name, size = 12, color, style, ...rest}) => {
    const code = glyphMap[name];
    const glyph = code ? String.fromCodePoint(code) : '□';
    return (
      <Text
        selectable={false}
        {...rest}
        style={[
          {
            fontFamily,
            fontSize: size,
            lineHeight: size,
            color,
          },
          style,
        ]}>
        {glyph}
      </Text>
    );
  };
  Icon.displayName = `Icon(${fontFamily})`;
  return Icon;
};

export default makeIconSet;
