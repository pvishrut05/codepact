import React from 'react';
import {
  View, Text, Pressable, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const FEATURES = [
  { icon: 'flame-outline',            color: '#F59E0B', label: 'Daily streaks & group leaderboards' },
  { icon: 'camera-outline',           color: '#22C55E', label: 'Screenshot proof + peer voting'     },
  { icon: 'cash-outline',             color: '#3B82F6', label: 'Real money penalties for misses'    },
] as const;

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Background glow */}
      <LinearGradient
        colors={['rgba(34,197,94,0.10)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 24,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Branding ─────────────────────────────── */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: 'rgba(34,197,94,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(34,197,94,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              shadowColor: '#22C55E',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
            }}
          >
            <Ionicons name="shield-checkmark" size={38} color="#22C55E" />
          </View>

          <Text
            style={{
              fontFamily: 'PlusJakartaSans_700Bold',
              fontSize: 44,
              color: '#F8FAFC',
              letterSpacing: -1.5,
              marginBottom: 10,
            }}
          >
            CodePact
          </Text>

          <Text
            style={{
              fontFamily: 'PlusJakartaSans_400Regular',
              fontSize: 17,
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 26,
            }}
          >
            LeetCode accountability{'\n'}with real stakes.
          </Text>
        </View>

        {/* ── Feature card ─────────────────────────── */}
        <View
          style={{
            backgroundColor: '#0F172A',
            borderRadius: 24,
            padding: 20,
            gap: 16,
            width: '100%',
            marginBottom: 40,
            borderWidth: 1,
            borderColor: '#1E293B',
          }}
        >
          {FEATURES.map(({ icon, color, label }) => (
            <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  backgroundColor: color + '18',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ionicons name={icon as any} size={20} color={color} />
              </View>
              <Text
                style={{
                  fontFamily: 'PlusJakartaSans_500Medium',
                  fontSize: 15,
                  color: '#CBD5E1',
                  flex: 1,
                }}
              >
                {label}
              </Text>
              <Ionicons name="checkmark" size={16} color="#22C55E" />
            </View>
          ))}
        </View>

        {/* ── CTAs ─────────────────────────────────── */}
        <View style={{ width: '100%', gap: 12 }}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(auth)/register');
            }}
            style={({ pressed }) => ({
              backgroundColor: '#22C55E',
              borderRadius: 18,
              height: 58,
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              opacity: pressed ? 0.85 : 1,
              shadowColor: '#22C55E',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
            })}
            accessibilityRole="button"
            accessibilityLabel="Get started"
          >
            <Text
              style={{
                fontFamily: 'PlusJakartaSans_700Bold',
                fontSize: 17,
                color: '#000000',
                letterSpacing: 0.2,
              }}
            >
              Get Started — It's Free
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/(auth)/login');
            }}
            style={({ pressed }) => ({
              height: 58,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#334155',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              opacity: pressed ? 0.7 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="Sign in to existing account"
          >
            <Text
              style={{
                fontFamily: 'PlusJakartaSans_600SemiBold',
                fontSize: 16,
                color: '#94A3B8',
              }}
            >
              Sign In
            </Text>
          </Pressable>

          <Text
            style={{
              fontFamily: 'PlusJakartaSans_400Regular',
              fontSize: 12,
              color: '#334155',
              textAlign: 'center',
              marginTop: 4,
            }}
          >
            No credit card required to start
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
