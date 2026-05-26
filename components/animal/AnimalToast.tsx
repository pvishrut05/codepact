import React, { useRef, useEffect } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import type { AnimalToastEvent } from '@/lib/animals';

type Props = {
  event: AnimalToastEvent | null;
  onDismiss: () => void;
  bottomOffset?: number;
};

export function AnimalToast({ event, onDismiss, bottomOffset = 100 }: Props) {
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!event) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Slide in
    translateY.setValue(80);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after 3.5s
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 80,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }, 3500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [event]);

  if (!event) return null;

  const isUnlock = event.type === 'unlock';

  const title = isUnlock
    ? `${event.animal.name} complete!`
    : `${event.animal.name} filled +1`;

  const subtitle = isUnlock && event.nextAnimal
    ? `${event.nextAnimal.emoji} ${event.nextAnimal.name} unlocked`
    : `${event.fill} / ${event.required}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 16,
        right: 16,
        transform: [{ translateY }],
        opacity,
        zIndex: 999,
      }}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View
        style={{
          backgroundColor: '#0F172A',
          borderRadius: 16,
          borderLeftWidth: 4,
          borderLeftColor: isUnlock ? '#F59E0B' : '#22C55E',
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: 32, lineHeight: 40 }} accessibilityElementsHidden>
          {isUnlock && event.nextAnimal ? event.nextAnimal.emoji : event.animal.emoji}
        </Text>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: '#F8FAFC',
              fontFamily: 'PlusJakartaSans_700Bold',
              fontSize: 14,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={{
              color: '#94A3B8',
              fontFamily: 'PlusJakartaSans_400Regular',
              fontSize: 13,
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: isUnlock ? '#F59E0B' : '#22C55E',
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    </Animated.View>
  );
}
