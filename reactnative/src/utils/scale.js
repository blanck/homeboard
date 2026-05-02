import {Dimensions} from 'react-native';

// Design base: emulator 2560x1600 @ 320dpi = 800dp wide
const BASE_WIDTH = 800;
const {width} = Dimensions.get('window');
// Dampen: only apply 30% of the extra scale (1.5x → 1.15x)
const ratio = 1 + (width / BASE_WIDTH - 1) * 0.3;

// Scale font size relative to design base
export const fs = (size) => Math.round(size * ratio);

// Scale spacing/dimensions relative to design base
export const sp = (size) => Math.round(size * ratio);
