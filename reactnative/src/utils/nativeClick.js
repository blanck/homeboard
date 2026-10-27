import {useEffect} from 'react';
import {Platform} from 'react-native';

// react-native-web fires onPress from its own responder system, once the native
// event has finished dispatching. Mobile browsers only treat window.open as
// user-initiated inside that native event, so an OAuth popup opened from
// onPress is blocked on a phone (desktop browsers are more permissive, which is
// why the same tap works there). Binding a real DOM click listener keeps the
// call inside the gesture. No-op off web.
export const useNativeClick = (ref, handler) => {
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = ref.current;
    if (!node || typeof node.addEventListener !== 'function') return undefined;
    node.addEventListener('click', handler);
    return () => node.removeEventListener('click', handler);
  }, [ref, handler]);
};

// Pair with the hook: onPress must not also fire on web, or the flow runs twice
export const nativeOnlyPress = (handler) => (Platform.OS === 'web' ? undefined : handler);
