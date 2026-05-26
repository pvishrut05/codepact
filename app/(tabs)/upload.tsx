import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, Pressable, ScrollView,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Group, DailyChallenge } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupMembership = {
  role: 'admin' | 'member';
  groups: Group;
};

type ExistingSubmission = {
  id: string;
  status: string;
  screenshot_url: string | null;
  submitted_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function statusInfo(status: string): { label: string; color: string; icon: string; bg: string } {
  switch (status) {
    case 'approved':
      return { label: 'Approved', color: '#22C55E', icon: 'checkmark-circle', bg: 'rgba(34,197,94,0.12)' };
    case 'rejected':
      return { label: 'Rejected', color: '#EF4444', icon: 'close-circle', bg: 'rgba(239,68,68,0.12)' };
    default:
      return { label: 'Awaiting review', color: '#F59E0B', icon: 'time', bg: 'rgba(245,158,11,0.12)' };
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const today = useMemo(todayStr, []);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── 1. Groups ──────────────────────────────────────────────────────────────
  const { data: memberships, isLoading: groupsLoading } = useQuery<GroupMembership[]>({
    queryKey: ['groups', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('role, groups(*)')
        .eq('user_id', session!.user.id)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      return data as unknown as GroupMembership[];
    },
  });

  useEffect(() => {
    if (memberships?.length && !selectedGroupId) {
      setSelectedGroupId(memberships[0].groups.id);
    }
  }, [memberships]);

  const selectedMembership = memberships?.find((m) => m.groups.id === selectedGroupId);
  const group = selectedMembership?.groups ?? null;

  // ── 2. Today's challenge ───────────────────────────────────────────────────
  const { data: challenge, isLoading: challengeLoading } = useQuery<DailyChallenge | null>({
    queryKey: ['challenge', selectedGroupId, today],
    enabled: !!selectedGroupId && group?.challenge_mode === 'assigned',
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('group_id', selectedGroupId!)
        .eq('date', today)
        .maybeSingle();
      return data as DailyChallenge | null;
    },
  });

  // ── 3. Existing submission today ───────────────────────────────────────────
  const { data: existingSubmission, isLoading: subLoading, refetch: refetchSub } =
    useQuery<ExistingSubmission | null>({
      queryKey: ['my-submission', selectedGroupId, today],
      enabled: !!selectedGroupId && !!session,
      queryFn: async () => {
        const start = `${today}T00:00:00.000Z`;
        const end = `${today}T23:59:59.999Z`;
        const { data } = await supabase
          .from('submissions')
          .select('id, status, screenshot_url, submitted_at')
          .eq('group_id', selectedGroupId!)
          .eq('user_id', session!.user.id)
          .gte('submitted_at', start)
          .lte('submitted_at', end)
          .maybeSingle();
        return data as ExistingSubmission | null;
      },
    });

  // Reset submitted flag when group changes
  useEffect(() => { setSubmitted(false); setImageUri(null); }, [selectedGroupId]);

  // ── Image pickers ──────────────────────────────────────────────────────────

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access in Settings to upload screenshots.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access in Settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!imageUri || !session || !selectedGroupId || !group) return;
    setUploading(true);

    try {
      // Step 1: resolve challenge_id
      let challengeId: string;

      if (group.challenge_mode === 'any') {
        // Auto-upsert a challenge row for 'any' mode groups
        const { data: existing } = await supabase
          .from('daily_challenges')
          .select('id')
          .eq('group_id', selectedGroupId)
          .eq('date', today)
          .maybeSingle();

        if (existing) {
          challengeId = existing.id;
        } else {
          const { data: created, error } = await supabase
            .from('daily_challenges')
            .insert({ group_id: selectedGroupId, date: today, set_by: session.user.id })
            .select('id')
            .single();
          if (error) throw error;
          challengeId = created.id;
        }
      } else {
        if (!challenge?.id) {
          throw new Error("Today's challenge hasn't been set yet. Ask your group admin.");
        }
        challengeId = challenge.id;
      }

      // Step 2: upload image to Supabase Storage
      const filePath = `${selectedGroupId}/${session.user.id}/${today}.jpg`;
      const response = await fetch(imageUri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      // Step 3: get public URL
      const { data: urlData } = supabase.storage
        .from('submissions')
        .getPublicUrl(filePath);

      // Step 4: upsert submission record
      const { error: subError } = await supabase
        .from('submissions')
        .upsert(
          {
            group_id: selectedGroupId,
            challenge_id: challengeId,
            user_id: session.user.id,
            screenshot_url: urlData.publicUrl,
            status: 'pending_review',
          },
          { onConflict: 'group_id,user_id,challenge_id' },
        );
      if (subError) throw subError;

      // Step 5: invalidate caches
      await queryClient.invalidateQueries({ queryKey: ['submissions-today', selectedGroupId] });
      await queryClient.invalidateQueries({ queryKey: ['my-submission', selectedGroupId, today] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      await refetchSub();
    } catch (err: any) {
      Alert.alert('Upload failed', err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLoading = groupsLoading || challengeLoading || subLoading;
  const noGroups = !groupsLoading && (!memberships || memberships.length === 0);

  // Blocked: assigned mode, no challenge set
  const needsChallenge =
    !isLoading &&
    group?.challenge_mode === 'assigned' &&
    !challenge &&
    !existingSubmission;

  // Show already-submitted state
  const showSubmittedState =
    submitted ||
    (existingSubmission && existingSubmission.status !== 'rejected');

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pt-2 pb-4">
        <Text className="text-foreground text-2xl" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
          Upload
        </Text>
        <Text className="text-muted text-sm" style={{ fontFamily: 'PlusJakartaSans_400Regular' }}>
          Submit your proof for today
        </Text>
      </View>

      {noGroups ? (
        <EmptyNoGroups />
      ) : isLoading ? (
        <LoadingState />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Group selector */}
          {(memberships?.length ?? 0) > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20, marginBottom: 16 }}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              {memberships!.map((item) => {
                const active = item.groups.id === selectedGroupId;
                return (
                  <Pressable
                    key={item.groups.id}
                    onPress={() => setSelectedGroupId(item.groups.id)}
                    className="rounded-full px-4 py-2"
                    style={{ backgroundColor: active ? '#22C55E' : '#0F172A' }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      className="text-sm"
                      style={{
                        fontFamily: 'PlusJakartaSans_600SemiBold',
                        color: active ? '#000000' : '#94A3B8',
                      }}
                      numberOfLines={1}
                    >
                      {item.groups.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Challenge context card */}
          {group && <ChallengeContextCard group={group} challenge={challenge} />}

          {/* Body */}
          {needsChallenge ? (
            <NoChallengeState />
          ) : showSubmittedState ? (
            <SubmittedState
              submission={existingSubmission}
              onResubmit={() => { setSubmitted(false); setImageUri(null); }}
            />
          ) : (
            <>
              {/* Image picker */}
              <ImagePickerZone
                imageUri={imageUri}
                onPickLibrary={pickFromLibrary}
                onPickCamera={pickFromCamera}
                onClear={() => setImageUri(null)}
              />

              {/* Submit button */}
              <Pressable
                onPress={handleSubmit}
                disabled={!imageUri || uploading}
                className="w-full rounded-2xl py-4 items-center mt-4"
                style={{
                  backgroundColor: !imageUri || uploading ? '#1E293B' : '#22C55E',
                }}
                accessibilityRole="button"
                accessibilityLabel="Submit proof"
              >
                {uploading ? (
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <ActivityIndicator color="#94A3B8" size="small" />
                    <Text className="text-muted text-base" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                      Uploading…
                    </Text>
                  </View>
                ) : (
                  <Text
                    className="text-base"
                    style={{
                      fontFamily: 'PlusJakartaSans_700Bold',
                      color: imageUri ? '#000000' : '#475569',
                    }}
                  >
                    {imageUri ? 'Submit Proof' : 'Pick a screenshot first'}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Challenge context card ───────────────────────────────────────────────────

function ChallengeContextCard({
  group,
  challenge,
}: {
  group: Group;
  challenge: DailyChallenge | null | undefined;
}) {
  const diffColor =
    challenge?.difficulty === 'Easy' ? '#22C55E'
      : challenge?.difficulty === 'Hard' ? '#EF4444'
      : '#F59E0B';

  return (
    <View className="bg-surface rounded-2xl p-4 mb-5">
      <Text
        className="text-muted text-xs mb-2"
        style={{ fontFamily: 'PlusJakartaSans_500Medium', letterSpacing: 1 }}
      >
        TODAY'S CHALLENGE
      </Text>

      {group.challenge_mode === 'any' ? (
        <Text
          className="text-foreground text-base"
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
        >
          Any LeetCode Problem
        </Text>
      ) : challenge ? (
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {challenge.difficulty && (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: diffColor + '22' }}
            >
              <Text
                className="text-xs"
                style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: diffColor }}
              >
                {challenge.difficulty}
              </Text>
            </View>
          )}
          <Text
            className="text-foreground text-base flex-1"
            style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
            numberOfLines={1}
          >
            {challenge.problem_title}
          </Text>
        </View>
      ) : (
        <Text
          className="text-muted text-base"
          style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
        >
          No challenge set yet
        </Text>
      )}
    </View>
  );
}

// ─── Image picker zone ────────────────────────────────────────────────────────

function ImagePickerZone({
  imageUri,
  onPickLibrary,
  onPickCamera,
  onClear,
}: {
  imageUri: string | null;
  onPickLibrary: () => void;
  onPickCamera: () => void;
  onClear: () => void;
}) {
  if (imageUri) {
    return (
      <View className="mb-4">
        <View className="rounded-2xl overflow-hidden" style={{ aspectRatio: 4 / 3 }}>
          <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
        </View>
        <Pressable
          onPress={onClear}
          className="flex-row items-center justify-center mt-3"
          style={{ gap: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Change screenshot"
        >
          <Ionicons name="refresh-outline" size={16} color="#94A3B8" />
          <Text
            className="text-muted text-sm"
            style={{ fontFamily: 'PlusJakartaSans_500Medium' }}
          >
            Change screenshot
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="mb-4">
      {/* Dashed drop zone */}
      <Pressable
        onPress={onPickLibrary}
        className="rounded-2xl items-center justify-center py-12"
        style={{ borderWidth: 1.5, borderColor: '#334155', borderStyle: 'dashed' }}
        accessibilityRole="button"
        accessibilityLabel="Select screenshot from library"
      >
        <View
          className="w-14 h-14 rounded-full items-center justify-center mb-3"
          style={{ backgroundColor: '#0F172A' }}
        >
          <Ionicons name="image-outline" size={28} color="#94A3B8" />
        </View>
        <Text
          className="text-foreground text-base mb-1"
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
        >
          Select Screenshot
        </Text>
        <Text
          className="text-muted text-sm"
          style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
        >
          Tap to choose from library
        </Text>
      </Pressable>

      {/* Camera button */}
      <Pressable
        onPress={onPickCamera}
        className="flex-row items-center justify-center mt-3 py-3 bg-surface rounded-2xl"
        style={{ gap: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Take a photo with camera"
      >
        <Ionicons name="camera-outline" size={18} color="#94A3B8" />
        <Text
          className="text-muted text-sm"
          style={{ fontFamily: 'PlusJakartaSans_500Medium' }}
        >
          Use Camera
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Submitted state ──────────────────────────────────────────────────────────

function SubmittedState({
  submission,
  onResubmit,
}: {
  submission: ExistingSubmission | null | undefined;
  onResubmit: () => void;
}) {
  const info = statusInfo(submission?.status ?? 'pending_review');

  return (
    <View>
      {/* Status card */}
      <View
        className="rounded-2xl p-5 items-center mb-4"
        style={{ backgroundColor: info.bg }}
      >
        <Ionicons name={info.icon as any} size={40} color={info.color} style={{ marginBottom: 12 }} />
        <Text
          className="text-foreground text-xl mb-1"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          {info.label}
        </Text>
        <Text
          className="text-muted text-sm text-center"
          style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
        >
          {submission?.status === 'approved'
            ? 'Your group approved your submission. Keep the streak alive!'
            : submission?.status === 'rejected'
            ? 'Your submission was rejected. Re-upload a valid screenshot.'
            : "Your screenshot is in — waiting for your group to vote."}
        </Text>
      </View>

      {/* Screenshot thumbnail */}
      {submission?.screenshot_url && (
        <View className="rounded-2xl overflow-hidden mb-4" style={{ aspectRatio: 4 / 3 }}>
          <Image
            source={{ uri: submission.screenshot_url }}
            className="w-full h-full"
            resizeMode="cover"
          />
        </View>
      )}

      {/* Re-submit if rejected */}
      {submission?.status === 'rejected' && (
        <Pressable
          onPress={onResubmit}
          className="w-full rounded-2xl py-4 items-center"
          style={{ backgroundColor: '#22C55E' }}
          accessibilityRole="button"
        >
          <Text
            style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', fontSize: 16 }}
          >
            Re-upload Screenshot
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Blocking states ──────────────────────────────────────────────────────────

function NoChallengeState() {
  return (
    <View
      className="bg-surface rounded-2xl p-5 items-center"
      style={{ marginTop: 8 }}
    >
      <Ionicons name="hourglass-outline" size={32} color="#94A3B8" style={{ marginBottom: 12 }} />
      <Text
        className="text-foreground text-base text-center mb-1"
        style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
      >
        No challenge set today
      </Text>
      <Text
        className="text-muted text-sm text-center"
        style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
      >
        Your admin hasn't set today's problem yet. Come back once it's posted.
      </Text>
    </View>
  );
}

function EmptyNoGroups() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Ionicons name="people-outline" size={40} color="#94A3B8" style={{ marginBottom: 16 }} />
      <Text
        className="text-foreground text-xl text-center"
        style={{ fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 8 }}
      >
        No groups yet
      </Text>
      <Text
        className="text-muted text-base text-center"
        style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
      >
        Join or create a group before uploading your proof.
      </Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color="#22C55E" />
    </View>
  );
}
