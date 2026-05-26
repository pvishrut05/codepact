import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, Animated, Easing,
  type LayoutChangeEvent,
} from 'react-native';
import { currentAnimal, nextAnimal, fillRatio } from '@/lib/animals';

type Props = {
  animalIndex: number;
  animalFill: number;
  totalApproved: number;
};

export function AnimalProgressCard({ animalIndex, animalFill, totalApproved }: Props) {
  const animal = currentAnimal(animalIndex);
  const next = nextAnimal(animalIndex);
  const ratio = fillRatio(animalFill, animal.requiredFill);
  const moreNeeded = Math.max(0, animal.requiredFill - animalFill);
  const isDragon = animalIndex === 9;

  const [barWidth, setBarWidth] = useState(0);
  const animWidth = useRef(new Animated.Value(0)).current;

  // +1 float
  const floatY = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const prevFill = useRef(animalFill);

  // Completion pulse
  const emojiScale = useRef(new Animated.Value(1)).current;
  const prevIndex = useRef(animalIndex);

  // Bar animation
  useEffect(() => {
    if (barWidth === 0) return;
    Animated.timing(animWidth, {
      toValue: barWidth * ratio,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animalFill, animalIndex, barWidth]);

  // +1 float animation on fill increase
  useEffect(() => {
    if (animalFill > prevFill.current) {
      floatY.setValue(0);
      floatOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(floatY, {
          toValue: -36,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatOpacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevFill.current = animalFill;
  }, [animalFill]);

  // Emoji scale pulse on animal advance
  useEffect(() => {
    if (animalIndex > prevIndex.current) {
      Animated.sequence([
        Animated.timing(emojiScale, {
          toValue: 1.3,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(emojiScale, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevIndex.current = animalIndex;
  }, [animalIndex]);

  const onBarLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (barWidth === 0) animWidth.setValue(w * ratio);
    setBarWidth(w);
  };

  const helperText = isDragon
    ? 'Maximum rank achieved'
    : moreNeeded === 0 && next
    ? `${next.emoji} ${next.name} unlocked!`
    : next
    ? `${moreNeeded} more to unlock ${next.emoji} ${next.name}`
    : '';

  return (
    <View
      style={{
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
      }}
      accessibilityRole="none"
      accessibilityLabel={`${animal.name}, ${animalFill} of ${animal.requiredFill} filled. ${helperText}`}
    >
      {/* Animal + fill */}
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <View style={{ alignItems: 'center' }}>
          <Animated.Text
            style={{ fontSize: 56, transform: [{ scale: emojiScale }] }}
            accessibilityElementsHidden
          >
            {animal.emoji}
          </Animated.Text>
          <Animated.Text
            style={{
              position: 'absolute',
              top: -4,
              color: '#22C55E',
              fontFamily: 'PlusJakartaSans_700Bold',
              fontSize: 18,
              transform: [{ translateY: floatY }],
              opacity: floatOpacity,
            }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            +1
          </Animated.Text>
        </View>

        <Text
          style={{
            color: '#F8FAFC',
            fontFamily: 'PlusJakartaSans_700Bold',
            fontSize: 22,
            marginTop: 10,
          }}
        >
          {animal.name}
        </Text>
        <Text
          style={{
            color: '#94A3B8',
            fontFamily: 'PlusJakartaSans_500Medium',
            fontSize: 14,
            marginTop: 3,
          }}
        >
          {animalFill} / {animal.requiredFill} filled
        </Text>
      </View>

      {/* Progress bar */}
      <View
        onLayout={onBarLayout}
        style={{
          height: 10,
          backgroundColor: '#1E293B',
          borderRadius: 5,
          overflow: 'hidden',
          marginBottom: 10,
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            width: animWidth,
            backgroundColor: isDragon ? '#F59E0B' : '#22C55E',
            borderRadius: 5,
          }}
        />
      </View>

      {/* Helper text */}
      {helperText ? (
        <Text
          style={{
            color: isDragon ? '#F59E0B' : '#475569',
            fontFamily: 'PlusJakartaSans_400Regular',
            fontSize: 13,
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          {helperText}
        </Text>
      ) : (
        <View style={{ marginBottom: 16 }} />
      )}

      {/* Divider + total */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: '#1E293B',
          paddingTop: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Text
          style={{
            color: '#475569',
            fontFamily: 'PlusJakartaSans_500Medium',
            fontSize: 12,
          }}
          accessibilityLabel={`${totalApproved} total approved submissions`}
        >
          {totalApproved} total approved
        </Text>
      </View>
    </View>
  );
}
