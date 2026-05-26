import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Group } from '@/lib/types';

type Step = 'input' | 'preview' | 'success';

export default function GroupJoinScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [foundGroup, setFoundGroup] = useState<Group | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [codeError, setCodeError] = useState('');

  async function handleLookup() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setCodeError('Code must be exactly 6 characters.');
      return;
    }
    setCodeError('');
    setLookupLoading(true);

    try {
      const { data: group, error } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', trimmed)
        .single();

      if (error || !group) {
        setCodeError('No group found with that code. Check and try again.');
        return;
      }

      // Check not already a member
      if (session) {
        const { data: existing } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', group.id)
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (existing) {
          setCodeError("You're already a member of this group.");
          return;
        }
      }

      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id);

      setFoundGroup(group as Group);
      setMemberCount(count ?? 0);
      setStep('preview');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setCodeError('Something went wrong. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleJoin() {
    if (!foundGroup || !session) return;
    setJoinLoading(true);

    try {
      const { error } = await supabase.from('group_members').insert({
        group_id: foundGroup.id,
        user_id: session.user.id,
        role: 'member',
      });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['groups'] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not join group. Please try again.');
    } finally {
      setJoinLoading(false);
    }
  }

  // ─── Success ────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <View
        className="flex-1 bg-background items-center justify-center px-8"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}
      >
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
          You're in!
        </Text>
        <Text
          className="text-muted text-base text-center"
          style={{ fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 32 }}
        >
          You joined {foundGroup?.name}. Time to get grinding.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="w-full rounded-2xl py-4 items-center"
          style={{ backgroundColor: '#22C55E' }}
          accessibilityRole="button"
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', fontSize: 16 }}>
            Let's Go
          </Text>
        </Pressable>
      </View>
    );
  }

  // ─── Preview ────────────────────────────────────────────────────────────────
  if (step === 'preview' && foundGroup) {
    return (
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}
      >
        <View className="flex-row items-center mb-8" style={{ gap: 12 }}>
          <Pressable
            onPress={() => setStep('input')}
            hitSlop={8}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={20} color="#94A3B8" />
          </Pressable>
          <Text
            className="text-foreground text-xl"
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            Join Group
          </Text>
        </View>

        <View className="bg-surface rounded-2xl p-5 mb-6">
          <Text
            className="text-foreground text-xl mb-4"
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            {foundGroup.name}
          </Text>
          <PreviewRow
            icon="cash-outline"
            label="Penalty per miss"
            value={`$${foundGroup.penalty_amount}`}
          />
          <PreviewRow
            icon="people-outline"
            label="Members"
            value={String(memberCount)}
          />
          <PreviewRow
            icon="time-outline"
            label="Daily deadline"
            value={formatTime(foundGroup.deadline_time)}
          />
          <PreviewRow
            icon="trophy-outline"
            label="Challenge mode"
            value={foundGroup.challenge_mode === 'assigned' ? 'Assigned Problem' : 'Any LeetCode'}
          />
        </View>

        <Pressable
          onPress={handleJoin}
          disabled={joinLoading}
          className="w-full rounded-2xl py-4 items-center"
          style={{ backgroundColor: joinLoading ? '#1E293B' : '#22C55E' }}
          accessibilityRole="button"
        >
          {joinLoading ? (
            <ActivityIndicator color="#F8FAFC" />
          ) : (
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', fontSize: 16 }}>
              Join Group
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  // ─── Code input ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        className="flex-1"
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
      >
        <View className="flex-row items-center mb-10" style={{ gap: 12 }}>
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
            Join a Group
          </Text>
        </View>

        <Text
          className="text-muted text-sm mb-2"
          style={{ fontFamily: 'PlusJakartaSans_500Medium' }}
        >
          Invite Code
        </Text>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
            setCodeError('');
          }}
          placeholder="e.g. ABC123"
          placeholderTextColor="#475569"
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={handleLookup}
          className="bg-surface rounded-2xl px-4 py-4 text-foreground"
          style={{
            fontFamily: 'PlusJakartaSans_700Bold',
            fontSize: 24,
            letterSpacing: 6,
            textAlign: 'center',
            borderWidth: codeError ? 1 : 0,
            borderColor: codeError ? '#EF4444' : undefined,
            marginBottom: 4,
          }}
          accessibilityLabel="Invite code"
        />
        {codeError ? (
          <Text
            style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#EF4444', marginBottom: 8 }}
          >
            {codeError}
          </Text>
        ) : (
          <Text
            className="text-muted text-xs"
            style={{ fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 8 }}
          >
            6-character code from your group admin
          </Text>
        )}

        <Pressable
          onPress={handleLookup}
          disabled={lookupLoading || code.length !== 6}
          className="rounded-2xl py-4 items-center mt-4"
          style={{
            backgroundColor:
              lookupLoading || code.length !== 6 ? '#1E293B' : '#22C55E',
          }}
          accessibilityRole="button"
        >
          {lookupLoading ? (
            <ActivityIndicator color="#94A3B8" />
          ) : (
            <Text
              style={{
                fontFamily: 'PlusJakartaSans_700Bold',
                color: code.length !== 6 ? '#94A3B8' : '#000000',
                fontSize: 16,
              }}
            >
              Look Up Group
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PreviewRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2.5 border-b border-border">
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Ionicons name={icon as any} size={16} color="#94A3B8" />
        <Text className="text-muted text-sm" style={{ fontFamily: 'PlusJakartaSans_400Regular' }}>
          {label}
        </Text>
      </View>
      <Text
        className="text-foreground text-sm"
        style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
      >
        {value}
      </Text>
    </View>
  );
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}
