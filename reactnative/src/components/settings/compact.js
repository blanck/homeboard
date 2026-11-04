import {createContext, useContext} from 'react';

// True when Settings runs in its phone layout: side-by-side blocks must stack
export const CompactContext = createContext(false);
export const useCompact = () => useContext(CompactContext);
