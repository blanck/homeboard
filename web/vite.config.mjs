import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const rnSrc = path.resolve(root, '../reactnative/src');
const shim = (name) => path.resolve(root, 'src/shims', name);

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    __DEV__: 'false',
  },
  resolve: {
    extensions: ['.web.js', '.web.jsx', '.js', '.jsx', '.json'],
    alias: [
      {find: /^react-native$/, replacement: shim('react-native.js')},
      {
        find: /^react-native-svg$/,
        replacement: 'react-native-svg/lib/module/ReactNativeSVG.web.js',
      },
      {find: 'react-native-udp', replacement: shim('udp.js')},
      {find: 'react-native-encrypted-storage', replacement: shim('encrypted-storage.js')},
      {find: '@react-native-async-storage/async-storage', replacement: shim('async-storage.js')},
      {find: '@react-native-community/netinfo', replacement: shim('netinfo.js')},
      {find: '@react-native-community/geolocation', replacement: shim('geolocation.js')},
      {find: 'react-native-safe-area-context', replacement: shim('safe-area-context.js')},
      {find: 'lottie-react-native', replacement: shim('lottie.js')},
      {find: 'react-native-get-random-values', replacement: shim('empty.js')},
      {
        find: 'react-native-vector-icons/MaterialCommunityIcons',
        replacement: shim('icons-material-community.js'),
      },
      {find: 'react-native-vector-icons/MaterialIcons', replacement: shim('icons-material.js')},
      {find: '@homeboard/rn', replacement: rnSrc},
    ],
  },
  esbuild: {
    include: [/\.jsx?$/],
    exclude: [],
    loader: 'jsx',
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {'.js': 'jsx'},
    },
  },
  server: {
    fs: {allow: [root, rnSrc]},
    proxy: {
      '/proxy': 'http://localhost:8080',
      '/udp-bridge': {target: 'ws://localhost:8080', ws: true},
    },
  },
  // chrome78: the Pi kiosk runs Raspbian Buster's Chromium 78, which cannot
  // parse optional chaining / nullish coalescing
  build: {outDir: 'dist', target: 'chrome78'},
});
