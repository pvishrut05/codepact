import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type ChallengeMode = 'assigned' | 'any';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function GroupCreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const [name, setName] = useState('');
  const [penaltyRaw, setPenaltyRaw] = useState('5');
  const [deadlineHour, setDeadlineHour] = useState(23);
  const [deadlineMinute, setDeadlineMinute] = useState(59);
  const [mode, setMode] = useState<ChallengeMode>('assigned');
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const penaltyAmount = parseFloat(penaltyRaw) || 0;

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Group name is required.';
    if (name.trim().length > 40) e.name = 'Max 40 characters.';
    if (isNaN(penaltyAmount) || penaltyAmount <= 0) e.penalty = 'Enter a valid amount.';
    if (penaltyAmount > 1000) e.penalty = 'Max $1,000 per miss.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate() || !session) return;
    setLoading(true);

    const deadlineTime = `${String(deadlineHour).padStart(2, '0')}:${String(deadlineMinute).padStart(2, '0')}:00`;
    let code = generateInviteCode();

    try {
      let groupId: string | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from('groups')
          .insert({
            name: name.trim(),
            invite_code: code,
            penalty_amount: penaltyAmount,
            deadline_time: deadlineTime,
            challenge_mode: mode,
            created_by: session.user.id,
          })
          .select('id')
          .single();

        if (error?.code === '23505') {
          code = generateInviteCode();
          continue;
        }
        if (error) throw error;
        groupId = data.id;
        break;
      }

      if (!groupId) throw new Error('Could not generate a unique invite code. Try again.');

      const { error: memberError } = await supabase.from('group_members').insert({
        group_id: groupId,
        user_id: session.user.id,
        role: 'admin',
      });
      if (memberError) throw memberError;

      await queryClient.invalidateQueries({ queryKey: ['groups'] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInviteCode(code);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!inviteCode) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({ message: `Join my CodePact group with code: ${inviteCode}` });
  }

  // ─── Success state ──────────────────────────────────────────────────────────
  if (inviteCode) {
    return (
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}
      >
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{ backgroundColor: 'rgba(34,197,94,0.15)', marginBottom: 24 }}
          >
            <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
          </View>
          <Text
            className="text-foreground text-2xl text-center"
            style={{ fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 8 }}
          >
            Group Created!
          </Text>
          <Text
            className="text-muted text-base text-center"
            style={{ fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 32 }}
          >
            Share this code with your friends so they can join.
          </Text>

          <View
            className="bg-surface rounded-2xl items-center"
            style={{ width: '100%', padding: 24, marginBottom: 16 }}
          >
            <Text
              className="text-muted text-xs mb-2"
              style={{ fontFamily: 'PlusJakartaSans_500Medium', letterSpacing: 2 }}
            >
              INVITE CODE
            </Text>
            <Text
              className="text-foreground"
              style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 36, letterSpacing: 8 }}
            >
              {inviteCode}
            </Text>
          </View>

          <Pressable
            onPress={handleShare}
            className="flex-row items-center rounded-2xl py-3.5"
            style={{
              width: '100%',
              backgroundColor: '#1E293B',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 12,
            }}
            accessibilityRole="button"
            accessibilityLabel="Share invite code"
          >
            <Ionicons name="share-outline" size={18} color="#F8FAFC" />
            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F8FAFC' }}>
              Share Code
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            className="w-full rounded-2xl py-4 items-center"
            style={{ backgroundColor: '#22C55E' }}
            accessibilityRole="button"
          >
            <Text
              style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', fontSize: 16 }}
            >
              Done
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Form ───────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center mb-8" style={{ gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color="#94A3B8" />
          </Pressable>
          <Text
            className="text-foreground text-xl"
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            Create Group
          </Text>
        </View>

        {/* Group Name */}
        <Field label="Group Name" error={errors.name}>
          <TextInput
            value={name}
            onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: '' })); }}
            placeholder="e.g. Grind Squad"
            placeholderTextColor="#475569"
            className="bg-surface text-foreground rounded-2xl px-4 py-4"
            style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16,
              borderWidth: errors.name ? 1 : 0, borderColor: errors.name ? '#EF4444' : undefined }}
            maxLength={40}
            returnKeyType="next"
            accessibilityLabel="Group name"
          />
        </Field>

        {/* Penalty Amount */}
        <Field label="Penalty per Missed Day ($)" error={errors.penalty}>
          <View
            className="bg-surface rounded-2xl flex-row items-center px-4"
            style={{ borderWidth: errors.penalty ? 1 : 0, borderColor: errors.penalty ? '#EF4444' : undefined }}
          >
            <Text className="text-muted text-lg mr-1" style={{ fontFamily: 'PlusJakartaSans_500Medium' }}>
              $
            </Text>
            <TextInput
              value={penaltyRaw}
              onChangeText={(t) => { setPenaltyRaw(t); setErrors((e) => ({ ...e, penalty: '' })); }}
              placeholder="5.00"
              placeholderTextColor="#475569"
              keyboardType="decimal-pad"
              className="flex-1 text-foreground py-4"
              style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16 }}
              accessibilityLabel="Penalty amount"
            />
          </View>
        </Field>

        {/* Deadline Time */}
        <Field label="Daily Deadline">
          <View className="bg-surface rounded-2xl flex-row items-center justify-between px-4 py-4">
            <Text className="text-muted text-sm" style={{ fontFamily: 'PlusJakartaSans_500Medium' }}>
              Submissions due by
            </Text>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <TimeStepper
                value={deadlineHour}
                onChange={setDeadlineHour}
                min={0}
                max={23}
                format={(v) => String(v % 12 || 12).padStart(2, '0')}
              />
              <Text className="text-foreground text-lg" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
                :
              </Text>
              <TimeStepper
                value={deadlineMinute}
                onChange={setDeadlineMinute}
                min={0}
                max={59}
                format={(v) => String(v).padStart(2, '0')}
              />
              <Pressable
                onPress={() => setDeadlineHour((h) => (h >= 12 ? h - 12 : h + 12))}
                style={{ backgroundColor: '#1E293B', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Text
                  className="text-foreground text-sm"
                  style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
                >
                  {deadlineHour >= 12 ? 'PM' : 'AM'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Field>

        {/* Challenge Mode */}
        <Field label="Challenge Mode">
          <View className="flex-row bg-surface rounded-2xl p-1" style={{ gap: 4 }}>
            {(['assigned', 'any'] as ChallengeMode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                className="flex-1 rounded-xl py-3 items-center"
                style={{ backgroundColor: mode === m ? '#22C55E' : 'transparent' }}
                accessibilityRole="radio"
                accessibilityState={{ selected: mode === m }}
              >
                <Text
                  className="text-sm"
                  style={{
                    fontFamily: 'PlusJakartaSans_600SemiBold',
                    color: mode === m ? '#000000' : '#94A3B8',
                  }}
                >
                  {m === 'assigned' ? 'Assigned Problem' : 'Any LeetCode'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {/* Submit */}
        <Pressable
          onPress={handleCreate}
          disabled={loading}
          className="rounded-2xl py-4 items-center mt-4"
          style={{ backgroundColor: loading ? '#1E293B' : '#22C55E' }}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#F8FAFC" />
          ) : (
            <Text
              style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', fontSize: 16 }}
            >
              Create Group
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text
        className="text-muted text-sm mb-2"
        style={{ fontFamily: 'PlusJakartaSans_500Medium' }}
      >
        {label}
      </Text>
      {children}
      {error ? (
        <Text
          style={{ fontFamily: 'PlusJakartaSans_400Regular', color: '#EF4444', fontSize: 12, marginTop: 6 }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ─── TimeStepper ──────────────────────────────────────────────────────────────

function TimeStepper({
  value, onChange, min, max, format,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  format: (v: number) => string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12 }}>
      <Pressable
        onPress={() => onChange(value <= min ? max : value - 1)}
        hitSlop={4}
        className="px-2 py-2"
      >
        <Ionicons name="chevron-back" size={14} color="#94A3B8" />
      </Pressable>
      <Text
        className="text-foreground"
        style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, minWidth: 24, textAlign: 'center' }}
      >
        {format(value)}
      </Text>
      <Pressable
        onPress={() => onChange(value >= max ? min : value + 1)}
        hitSlop={4}
        className="px-2 py-2"
      >
        <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
      </Pressable>
    </View>
  );
}
