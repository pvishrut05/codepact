import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, Animated, Easing,
  type LayoutChangeEvent,
} from 'react-native';
import { currentAnimal, nextAnimal, fillRatio } from '@/lib/animals';

type Props = {
  animalIndex: number;
  animalFill: number;
};

export function AnimalCompactCard({ animalIndex, animalFill }: Props) {
  const animal = currentAnimal(animalIndex);
  const next = nextAnimal(animalIndex);
  const ratio = fillRatio(animalFill, animal.requiredFill);
  const isDragon = animalIndex === 9;

  const [barWidth, setBarWidth] = useState(0);
  const animWidth = useRef(new Animated.Value(0)).current;
  const prevFill = useRef(animalFill);
  const prevIndex = useRef(animalIndex);

  // +1 float
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (barWidth === 0) return;
    Animated.timing(animWidth, {
      toValue: barWidth * ratio,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animalFill, animalIndex, barWidth]);

  useEffect(() => {
    if (animalFill > prevFill.current || animalIndex > prevIndex.current) {
      floatY.setValue(0);
      floatOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(floatY, { toValue: -20, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(floatOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }
    prevFill.current = animalFill;
    prevIndex.current = animalIndex;
  }, [animalFill, animalIndex]);

  const onBarLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (barWidth === 0) animWidth.setValue(w * ratio);
    setBarWidth(w);
  };

  const subLabel = isDragon
    ? 'Max rank'
    : next
    ? `→ ${next.emoji} ${next.name}`
    : '';

  return (
    <View
      style={{
        backgroundColor: '#0F172A',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
      accessibilityRole="none"
      accessibilityLabel={`${animal.name} progress: ${animalFill} of ${animal.requiredFill}`}
    >
      {/* Emoji */}
      <View style={{ position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 30 }} accessibilityElementsHidden>
          {animal.emoji}
        </Text>
        <Animated.Text
          style={{
            position: 'absolute',
            top: -8,
            right: -4,
            color: '#22C55E',
            fontFamily: 'PlusJakartaSans_700Bold',
            fontSize: 13,
            transform: [{ translateY: floatY }],
            opacity: floatOpacity,
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          +1
        </Animated.Text>
      </View>

      {/* Name + bar + count */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text
            style={{ color: '#F8FAFC', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 }}
            numberOfLines={1}
          >
            {animal.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {subLabel ? (
              <Text
                style={{ color: '#475569', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11 }}
                numberOfLines={1}
              >
                {subLabel}
              </Text>
            ) : null}
            <Text
              style={{ color: '#94A3B8', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 }}
            >
              {animalFill}/{animal.requiredFill}
            </Text>
          </View>
        </View>

        {/* Bar */}
        <View
          onLayout={onBarLayout}
          style={{
            height: 6,
            backgroundColor: '#1E293B',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              height: '100%',
              width: animWidth,
              backgroundColor: isDragon ? '#F59E0B' : '#22C55E',
              borderRadius: 3,
            }}
          />
        </View>
      </View>
    </View>
  );
}
