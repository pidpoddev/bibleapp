import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

type SaveConfirmationToastProps = {
  visibleKey: number;
  message?: string;
  tintColor?: string;
  borderColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function SaveConfirmationToast({
  visibleKey,
  message = 'Saved!',
  tintColor = '#C88C93',
  borderColor = '#E8DCD4',
  backgroundColor = '#FFFDF9',
  style,
}: SaveConfirmationToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRendered, setIsRendered] = useState(visibleKey > 0);

  useEffect(() => {
    if (visibleKey <= 0) {
      return;
    }

    setIsRendered(true);

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    opacity.stopAnimation();
    translateY.stopAnimation();
    scale.stopAnimation();

    opacity.setValue(0);
    translateY.setValue(10);
    scale.setValue(0.92);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 13,
          stiffness: 210,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(760),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -14,
          duration: 260,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    hideTimeoutRef.current = setTimeout(() => {
      setIsRendered(false);
      hideTimeoutRef.current = null;
    }, 1300);
  }, [opacity, scale, translateY, visibleKey]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  if (!isRendered) {
    return null;
  }

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={[
        styles.toast,
        {
          backgroundColor,
          borderColor,
          opacity,
          transform: [{ translateY }, { scale }],
        },
        style,
      ]}>
      <View style={[styles.iconShell, { backgroundColor: tintColor }]}>
        <Ionicons name="heart" size={12} color="#FFFDF9" />
        <View style={styles.checkDot}>
          <Ionicons name="checkmark" size={10} color={tintColor} />
        </View>
      </View>
      <Text style={styles.message}>{message}</Text>
      <View style={[styles.sparkle, styles.sparkleTop, { backgroundColor: '#EBCB77' }]} />
      <View style={[styles.sparkle, styles.sparkleBottom, { backgroundColor: '#F3D1DC' }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    minWidth: 128,
    maxWidth: 168,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.09,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
    zIndex: 200,
  },
  iconShell: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8DCD4',
  },
  message: {
    color: '#5B514D',
    fontSize: 14,
    fontWeight: '800',
  },
  sparkle: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  sparkleTop: {
    right: 13,
    top: 8,
  },
  sparkleBottom: {
    left: 16,
    bottom: 7,
  },
});
