import './runtime';
import {AppRegistry} from 'react-native-web';
import App from '@homeboard/rn/App';
import {importLegacyConfigIfFresh} from './legacy-import';
import mciFont from 'react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf';
import miFont from 'react-native-vector-icons/Fonts/MaterialIcons.ttf';

const loadFont = (family, url) => {
  const face = new FontFace(family, `url(${url})`);
  document.fonts.add(face);
  return face.load();
};

Promise.allSettled([
  loadFont('MaterialCommunityIcons', mciFont),
  loadFont('MaterialIcons', miFont),
  importLegacyConfigIfFresh(),
]).then(() => {
  AppRegistry.registerComponent('Homeboard', () => App);
  AppRegistry.runApplication('Homeboard', {
    rootTag: document.getElementById('root'),
  });
});
