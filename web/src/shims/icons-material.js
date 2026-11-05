import glyphMap from 'react-native-vector-icons/glyphmaps/MaterialIcons.json';
import font from 'react-native-vector-icons/Fonts/MaterialIcons.ttf';
import makeIconSet from './make-icon-set';

// Loaded here instead of main.jsx, so the 350 KB font only ships if something imports this set
const face = new FontFace('MaterialIcons', `url(${font})`);
document.fonts.add(face);
face.load().catch(() => {});

export default makeIconSet(glyphMap, 'MaterialIcons');
