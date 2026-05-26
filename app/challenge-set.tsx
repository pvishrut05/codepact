import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type Difficulty = 'Easy' | 'Medium' | 'Hard';

const DIFFICULTY_OPTIONS: { value: Difficulty; color: string }[] = [
  { value: 'Easy',   color: '#22C55E' },
  { value: 'Medium', color: '#F59E0B' },
  { value: 'Hard',   color: '#EF4444' },
];

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export default function ChallengeSetScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { groupId, date, groupName } = useLocalSearchParams<{
    groupId: string;
    date: string;
    groupName?: string;
  }>();

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});

  const urlRef = useRef<TextInput>(null);

  // Pre-populate if a challenge already exists for this group+date
  useEffect(() => {
    if (!groupId || !date) { setInitialLoading(false); return; }
    supabase
      .from('daily_challenges')
      .select('*')
      .eq('group_id', groupId)
      .eq('date', date)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTitle(data.problem_title ?? '');
          setUrl(data.problem_url ?? '');
          setDifficulty(data.difficulty as Difficulty | null);
          setIsEdit(true);
        }
        setInitialLoading(false);
      });
  }, [groupId, date]);

  function validate(): boolean {
    const e: { title?: string; url?: string } = {};
    if (!title.trim()) {
      e.title = 'Problem title is required.';
    }
    if (url.trim() && !url.trim().toLowerCase().includes('leetcode.com')) {
      e.url = 'URL must be a leetcode.com link.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || !session || !groupId || !date) return;
    setLoading(true);

    try {
      const payload = {
        group_id: groupId,
        date,
        problem_title: title.trim(),
        problem_url: url.trim() || null,
        difficulty: difficulty ?? null,
        set_by: session.user.id,
      };

      const { error } = await supabase
        .from('daily_challenges')
        .upsert(payload, { onConflict: 'group_id,date' });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['challenge', groupId, date] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save challenge. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <View
        className="flex-1 bg-background items-center justify-center"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center mb-2" style={{ gap: 12 }}>
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
            {isEdit ? 'Edit Challenge' : 'Set Challenge'}
          </Text>
        </View>

        {/* Subtitle: group + date */}
        <Text
          className="text-muted text-sm mb-8"
          style={{ fontFamily: 'PlusJakartaSans_400Regular', marginLeft: 52 }}
        >
          {groupName ? `${groupName} · ` : ''}{formatDisplayDate(date ?? '')}
        </Text>

        {/* Problem Title */}
        <Field label="Problem Title *" error={errors.title}>
          <TextInput
            value={title}
            onChangeText={(t) => { setTitle(t); setErrors((e) => ({ ...e, title: undefined })); }}
            onBlur={() => { if (!title.trim()) setErrors((e) => ({ ...e, title: 'Problem title is required.' })); }}
            placeholder="e.g. Two Sum"
            placeholderTextColor="#475569"
            returnKeyType="next"
            onSubmitEditing={() => urlRef.current?.focus()}
            blurOnSubmit={false}
            accessibilityLabel="Problem title"
            className="bg-surface text-foreground rounded-2xl px-4"
            style={{
              fontFamily: 'PlusJakartaSans_400Regular',
              fontSize: 16,
              paddingVertical: 14,
              borderWidth: errors.title ? 1 : 0,
              borderColor: '#EF4444',
            }}
          />
        </Field>

        {/* LeetCode URL */}
        <Field label="LeetCode URL" error={errors.url} hint="Optional — paste the problem link">
          <TextInput
            ref={urlRef}
            value={url}
            onChangeText={(t) => { setUrl(t); setErrors((e) => ({ ...e, url: undefined })); }}
            onBlur={() => {
              if (url.trim() && !url.trim().toLowerCase().includes('leetcode.com')) {
                setErrors((e) => ({ ...e, url: 'URL must be a leetcode.com link.' }));
              }
            }}
            placeholder="https://leetcode.com/problems/..."
            placeholderTextColor="#475569"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel="LeetCode URL"
            className="bg-surface text-foreground rounded-2xl px-4"
            style={{
              fontFamily: 'PlusJakartaSans_400Regular',
              fontSize: 16,
              paddingVertical: 14,
              borderWidth: errors.url ? 1 : 0,
              borderColor: '#EF4444',
            }}
          />
        </Field>

        {/* Difficulty */}
        <Field label="Difficulty">
          <View className="flex-row bg-surface rounded-2xl p-1" style={{ gap: 4 }}>
            {DIFFICULTY_OPTIONS.map(({ value, color }) => {
              const active = difficulty === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setDifficulty(active ? null : value)}
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ backgroundColor: active ? color + '22' : 'transparent' }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={value}
                >
                  <Text
                    className="text-sm"
                    style={{
                      fontFamily: 'PlusJakartaSans_600SemiBold',
                      color: active ? color : '#94A3B8',
                    }}
                  >
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text
            className="text-muted text-xs mt-1.5"
            style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
          >
            Optional — tap again to deselect
          </Text>
        </Field>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="w-full rounded-2xl py-4 items-center mt-4"
          style={{ backgroundColor: loading ? '#1E293B' : '#22C55E' }}
          accessibilityRole="button"
          accessibilityLabel={isEdit ? 'Update challenge' : 'Set challenge'}
        >
          {loading ? (
            <ActivityIndicator color="#F8FAFC" />
          ) : (
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', fontSize: 16 }}>
              {isEdit ? 'Update Challenge' : 'Set Challenge'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label, error, hint, children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
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
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text
          className="text-muted text-xs mt-1.5"
          style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
