import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
// import { purchasePlan, restorePurchases } from '@/lib/purchases'; // TODO: Uncomment when Apple Developer account is set up

// ─── Pricing config ───────────────────────────────────────────────────────────

const PLANS = {
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    badge: 'Save $4',
    price: '$15.99',
    period: '/month',
    sub: 'Best value · saves $4 vs weekly',
    trialText: 'then $15.99/month',
  },
  weekly: {
    id: 'weekly',
    label: 'Weekly',
    badge: null,
    price: '$4.99',
    period: '/week',
    sub: 'Billed every week',
    trialText: 'then $4.99/week',
  },
} as const;

type PlanKey = keyof typeof PLANS;

const FEATURES = [
  'Daily LeetCode challenges with your squad',
  'Screenshot proof & peer voting system',
  'Streak tracking & group leaderboards',
  'Automatic penalty tracking between friends',
  'Create & join unlimited groups',
  'Invite friends with a shareable link',
];

const PROMO_CODE = 'codePact26';

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, refreshProfile, devGrantSubscription } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('monthly');
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoVisible, setPromoVisible] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);

  const plan = PLANS[selectedPlan];

  // ─── Grant subscription in Supabase (called after successful RC purchase or promo) ──

  async function grantSubscription() {
    if (!session) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ has_subscription: true })
      .eq('id', session.user.id);
    if (error) return false;
    await refreshProfile();
    return true;
  }

  // ─── Main purchase flow ───────────────────────────────────────────────────────
  // TODO: Restore full RC flow when Apple Developer account is set up

  const handleSubscribe = async () => {
    Alert.alert('Coming Soon', 'In-app purchases will be available once we launch on the App Store.');
  };

  // ─── Restore flow ─────────────────────────────────────────────────────────────

  const handleRestore = async () => {
    Alert.alert('Coming Soon', 'Purchase restoration will be available once we launch on the App Store.');
  };

  // ─── Promo code flow ──────────────────────────────────────────────────────────

  const handlePromoCode = async () => {
    if (promoCode.trim().toLowerCase() !== PROMO_CODE.toLowerCase()) {
      Alert.alert('Invalid Code', 'That promo code is not valid.');
      return;
    }
    setPromoLoading(true);
    const granted = await grantSubscription();
    setPromoLoading(false);
    if (granted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Error', 'Could not apply promo code. Please try again.');
    }
  };

  return (
    <LinearGradient
      colors={['#000000', '#000000', '#0F172A']}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      {/* Dev bypass — floating, always visible, never buried in scroll */}
      {__DEV__ && (
        <Pressable
          onPress={devGrantSubscription}
          style={{
            position: 'absolute',
            top: insets.top + 8,
            right: 16,
            zIndex: 100,
            backgroundColor: '#1E293B',
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: '#334155',
          }}
          accessibilityRole="button"
          accessibilityLabel="Dev skip paywall"
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#94A3B8' }}>
            DEV skip
          </Text>
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6">

          {/* Logo */}
          <View className="items-center mb-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="shield-checkmark" size={28} color="#22C55E" />
              <Text
                className="text-foreground text-2xl"
                style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
              >
                CodePact
              </Text>
            </View>
          </View>

          {/* Trial badge */}
          <View className="items-center mb-8">
            <View className="bg-brand-green/20 border border-brand-green/40 px-4 py-1.5 rounded-full">
              <Text
                className="text-brand-green text-sm"
                style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
              >
                7-Day Free Trial
              </Text>
            </View>
          </View>

          {/* Hero */}
          <View className="mb-8">
            <Text
              className="text-foreground text-4xl text-center leading-tight mb-2"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              Stay accountable.{'\n'}
              <Text className="text-brand-green">Every day.</Text>
            </Text>
            <Text
              className="text-muted text-base text-center"
              style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
            >
              Your group. Your streak. Real stakes.
            </Text>
          </View>

          {/* Features */}
          <View className="bg-surface rounded-2xl p-5 mb-8 gap-3">
            {FEATURES.map((feature) => (
              <View key={feature} className="flex-row items-center gap-3">
                <View className="w-5 h-5 rounded-full bg-brand-green/20 items-center justify-center">
                  <Ionicons name="checkmark" size={13} color="#22C55E" />
                </View>
                <Text
                  className="text-foreground text-sm flex-1"
                  style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
                >
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          {/* Plan toggle */}
          <Text
            className="text-muted text-xs uppercase tracking-widest text-center mb-3"
            style={{ fontFamily: 'PlusJakartaSans_500Medium' }}
          >
            Choose your plan
          </Text>

          <View className="flex-row bg-surface rounded-2xl p-1 mb-5 gap-1">
            {(Object.keys(PLANS) as PlanKey[]).map((key) => {
              const p = PLANS[key];
              const active = selectedPlan === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setSelectedPlan(key);
                    Haptics.selectionAsync();
                  }}
                  className={`flex-1 py-3 rounded-xl items-center gap-0.5 ${
                    active ? 'bg-brand-green' : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-sm ${active ? 'text-black' : 'text-muted'}`}
                    style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
                  >
                    {p.label}
                  </Text>
                  {p.badge && (
                    <Text
                      className={`text-xs ${active ? 'text-black/70' : 'text-brand-green'}`}
                      style={{ fontFamily: 'PlusJakartaSans_500Medium' }}
                    >
                      {p.badge}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Price display */}
          <View className="items-center mb-8">
            <View className="flex-row items-end gap-1">
              <Text
                className="text-foreground text-5xl"
                style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
              >
                {plan.price}
              </Text>
              <Text
                className="text-muted text-lg mb-2"
                style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
              >
                {plan.period}
              </Text>
            </View>
            <Text
              className="text-muted text-sm"
              style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
            >
              {plan.sub}
            </Text>
          </View>

          {/* CTA */}
          <Pressable
            onPress={handleSubscribe}
            disabled={loading}
            style={({ pressed }) => ({ opacity: pressed || loading ? 0.8 : 1 })}
            className="bg-brand-green rounded-2xl h-14 items-center justify-center mb-3"
          >
            <Text
              className="text-black text-base"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              {loading ? 'Processing...' : 'Start 7-Day Free Trial'}
            </Text>
          </Pressable>

          <Text
            className="text-muted text-xs text-center mb-8"
            style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
          >
            7 days free, {plan.trialText}. Cancel anytime.
          </Text>

          {/* Promo code section */}
          <View className="mb-6">
            <Pressable
              onPress={() => setPromoVisible(v => !v)}
              className="items-center py-2"
            >
              <Text
                className="text-muted text-sm"
                style={{ fontFamily: 'PlusJakartaSans_500Medium' }}
              >
                Have a promo code?{' '}
                <Text style={{ color: '#22C55E' }}>
                  {promoVisible ? 'Hide' : 'Enter code'}
                </Text>
              </Text>
            </Pressable>

            {promoVisible && (
              <View className="flex-row mt-3 gap-2">
                <TextInput
                  value={promoCode}
                  onChangeText={setPromoCode}
                  placeholder="Enter promo code"
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    height: 48,
                    backgroundColor: '#0F172A',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    color: '#F8FAFC',
                    fontFamily: 'PlusJakartaSans_400Regular',
                    fontSize: 14,
                    borderWidth: 1,
                    borderColor: '#1E293B',
                  }}
                />
                <Pressable
                  onPress={handlePromoCode}
                  disabled={promoLoading || !promoCode.trim()}
                  style={({ pressed }) => ({
                    height: 48,
                    paddingHorizontal: 16,
                    backgroundColor: promoCode.trim() ? '#22C55E' : '#1E293B',
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed || promoLoading ? 0.7 : 1,
                  })}
                >
                  <Text style={{
                    color: promoCode.trim() ? '#000' : '#475569',
                    fontFamily: 'PlusJakartaSans_600SemiBold',
                    fontSize: 14,
                  }}>
                    {promoLoading ? '...' : 'Apply'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Footer links */}
          <View className="items-center gap-4">
            <Pressable onPress={handleRestore} disabled={loading}>
              <Text
                className="text-brand-green text-sm"
                style={{ fontFamily: 'PlusJakartaSans_500Medium' }}
              >
                Restore Purchases
              </Text>
            </Pressable>

            <View className="flex-row gap-4">
              <Pressable onPress={() => router.push('/(paywall)/privacy')}>
                <Text
                  className="text-muted text-xs"
                  style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
                >
                  Privacy Policy
                </Text>
              </Pressable>
              <Text style={{ color: '#475569', fontSize: 12 }}>·</Text>
              <Pressable onPress={() => router.push('/(paywall)/terms')}>
                <Text
                  className="text-muted text-xs"
                  style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
                >
                  Terms of Service
                </Text>
              </Pressable>
            </View>

          </View>

        </View>
      </ScrollView>
    </LinearGradient>
  );
}
