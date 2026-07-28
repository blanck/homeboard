import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, Pressable} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {fs} from '../utils/scale';

const VISIBLE_MS = 5000;

const Toast = () => {
  const toast = useStore((s) => s.toast);
  const hideToast = useStore((s) => s.hideToast);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return undefined;
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(({finished}) => {
        if (finished) hideToast();
      });
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
    // seq, not the object, so an identical repeat restarts the timer
  }, [toast?.seq, toast, fadeAnim, hideToast]);

  if (!toast) return null;

  return (
    <Animated.View style={[styles.wrap, {opacity: fadeAnim}]} pointerEvents="box-none">
      <Pressable style={styles.toast} onPress={hideToast}>
        <Icon name="alert-circle-outline" size={fs(16)} color="#ffb74d" />
        <Text style={styles.text}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '60%',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,183,77,0.35)',
  },
  text: {
    color: '#ffffff',
    fontSize: fs(13),
    flexShrink: 1,
  },
});

export default Toast;
