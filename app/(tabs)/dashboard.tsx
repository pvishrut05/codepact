import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, FlatList,
  RefreshControl, Linking, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/Skeleton';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Group, DailyChallenge, MemberWithProfile } from '@/lib/types';
import { AnimalCompactCard } from '@/components/animal/AnimalCompactCard';

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupMembership = {
  role: 'admin' | 'member';
  groups: Group & { group_members: [{ count: number }] };
};

type SubmissionRow = { user_id: string; status: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

function avatarColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, profile } = useAuth();
  const today = useMemo(todayStr, []);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const {
    data: memberships,
    isLoading: groupsLoading,
    refetch: refetchGroups,
    isRefetching,
  } = useQuery<GroupMembership[]>({
    queryKey: ['groups', session?.user.id],
    enabled: !!session,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('role, groups(*, group_members(count))')
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
  const userRole = selectedMembership?.role ?? 'member';

  const { data: challenge, isLoading: challengeLoading, refetch: refetchChallenge } = useQuery<DailyChallenge | null>({
    queryKey: ['challenge', selectedGroupId, today],
    enabled: !!selectedGroupId && group?.challenge_mode === 'assigned',
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
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

  const { data: members, isLoading: membersLoading, refetch: refetchMembers } = useQuery<MemberWithProfile[]>({
    queryKey: ['members', selectedGroupId],
    enabled: !!selectedGroupId,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, role, joined_at, profiles(id, name, email)')
        .eq('group_id', selectedGroupId!);
      if (error) throw error;
      return data as unknown as MemberWithProfile[];
    },
  });

  const challengeId = challenge?.id ?? null;
  const { data: submissions, refetch: refetchSubs } = useQuery<SubmissionRow[]>({
    queryKey: ['submissions-today', selectedGroupId, challengeId],
    enabled: !!selectedGroupId && !!challengeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select('user_id, status')
        .eq('challenge_id', challengeId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submissionMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of submissions ?? []) m[s.user_id] = s.status;
    return m;
  }, [submissions]);

  const submittedCount = Object.values(submissionMap).filter(
    (s) => s === 'pending_review' || s === 'approved',
  ).length;

  function handleRefresh() {
    refetchGroups();
    refetchChallenge();
    refetchMembers();
    refetchSubs();
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (groupsLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <TodayHeader />
        <SkeletonContent />
      </View>
    );
  }

  if (!memberships || memberships.length === 0) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <TodayHeader />
        <NoGroupsState onPress={() => router.push('/(tabs)' as any)} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <TodayHeader />

      {memberships.length > 1 && (
        <FlatList
          horizontal
          data={memberships}
          keyExtractor={(item) => item.groups.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}
          renderItem={({ item }) => {
            const active = item.groups.id === selectedGroupId;
            return (
              <Pressable
                onPress={() => setSelectedGroupId(item.groups.id)}
                className="rounded-full px-4 py-2"
                style={{ backgroundColor: active ? '#22C55E' : '#0F172A' }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  className="text-sm"
                  style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: active ? '#000000' : '#94A3B8' }}
                  numberOfLines={1}
                >
                  {item.groups.name}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#22C55E" />
        }
        showsVerticalScrollIndicator={false}
      >
        <AnimalCompactCard
          animalIndex={profile?.animal_index ?? 0}
          animalFill={profile?.animal_fill ?? 0}
        />

        {group && (
          <>
            <ChallengeCard
              group={group}
              challenge={challenge ?? null}
              userRole={userRole}
              loading={challengeLoading}
              router={router}
              selectedGroupId={selectedGroupId!}
              today={today}
            />
            <MemberStatusSection
              members={members ?? []}
              submissionMap={submissionMap}
              submittedCount={submittedCount}
              loading={membersLoading}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function TodayHeader() {
  return (
    <View className="px-5 pt-2 pb-4">
      <Text className="text-foreground text-2xl" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
        Today
      </Text>
      <Text className="text-muted text-sm" style={{ fontFamily: 'PlusJakartaSans_400Regular' }}>
        {formatDate()}
      </Text>
    </View>
  );
}

// ─── Challenge card ───────────────────────────────────────────────────────────

type ChallengeCardProps = {
  group: Group;
  challenge: DailyChallenge | null;
  userRole: 'admin' | 'member';
  loading: boolean;
  router: ReturnType<typeof useRouter>;
  selectedGroupId: string;
  today: string;
};

function ChallengeCard({ group, challenge, userRole, loading, router, selectedGroupId, today }: ChallengeCardProps) {
  if (loading) {
    return (
      <View className="bg-surface rounded-2xl p-4 mb-4">
        <View className="flex-row justify-between mb-3">
          <Skeleton width={112} height={12} radius={6} />
          <Skeleton width={80} height={24} radius={12} />
        </View>
        <Skeleton width="85%" height={20} radius={8} style={{ marginBottom: 8 }} />
        <Skeleton width={144} height={34} radius={10} />
      </View>
    );
  }

  if (group.challenge_mode === 'any') {
    return (
      <View className="bg-surface rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-muted text-xs" style={{ fontFamily: 'PlusJakartaSans_500Medium', letterSpacing: 1 }}>
            TODAY'S CHALLENGE
          </Text>
          <DeadlineChip time={group.deadline_time} />
        </View>
        <Text className="text-foreground text-lg mb-1" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
          Any LeetCode Problem
        </Text>
        <Text className="text-muted text-sm" style={{ fontFamily: 'PlusJakartaSans_400Regular' }}>
          Solve any problem and upload your screenshot before the deadline.
        </Text>
      </View>
    );
  }

  if (challenge) {
    const diffColor =
      challenge.difficulty === 'Easy' ? '#22C55E'
        : challenge.difficulty === 'Hard' ? '#EF4444'
        : '#F59E0B';

    return (
      <View className="bg-surface rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-muted text-xs" style={{ fontFamily: 'PlusJakartaSans_500Medium', letterSpacing: 1 }}>
            TODAY'S CHALLENGE
          </Text>
          <DeadlineChip time={group.deadline_time} />
        </View>
        {challenge.difficulty && (
          <View className="mb-2 self-start px-2 py-0.5 rounded-full" style={{ backgroundColor: diffColor + '22' }}>
            <Text className="text-xs" style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: diffColor }}>
              {challenge.difficulty}
            </Text>
          </View>
        )}
        <Text className="text-foreground text-lg mb-3" style={{ fontFamily: 'PlusJakartaSans_700Bold' }} numberOfLines={2}>
          {challenge.problem_title ?? 'Problem TBD'}
        </Text>
        {challenge.problem_url ? (
          <Pressable
            onPress={() =>
              Linking.openURL(challenge.problem_url!).catch(() => Alert.alert('Error', 'Could not open link.'))
            }
            className="flex-row items-center rounded-xl py-2.5 px-3 self-start"
            style={{ backgroundColor: 'rgba(34,197,94,0.12)', gap: 6 }}
            accessibilityRole="link"
            accessibilityLabel="Open problem on LeetCode"
          >
            <Ionicons name="open-outline" size={14} color="#22C55E" />
            <Text className="text-sm" style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#22C55E' }}>
              Open on LeetCode
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // assigned mode, no challenge set
  return (
    <View className="bg-surface rounded-2xl p-4 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-muted text-xs" style={{ fontFamily: 'PlusJakartaSans_500Medium', letterSpacing: 1 }}>
          TODAY'S CHALLENGE
        </Text>
        <DeadlineChip time={group.deadline_time} />
      </View>
      {userRole === 'admin' ? (
        <>
          <Text className="text-foreground text-base mb-1" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            No challenge set yet
          </Text>
          <Text className="text-muted text-sm mb-3" style={{ fontFamily: 'PlusJakartaSans_400Regular' }}>
            Set today's problem so your group can start grinding.
          </Text>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/challenge-set' as any, params: { groupId: selectedGroupId, date: today, groupName: group.name } })
            }
            className="flex-row items-center rounded-xl py-2.5 px-3 self-start"
            style={{ backgroundColor: '#22C55E', gap: 6 }}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={16} color="#000000" />
            <Text className="text-sm" style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
              Set Challenge
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text className="text-foreground text-base mb-1" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            Waiting on admin
          </Text>
          <Text className="text-muted text-sm" style={{ fontFamily: 'PlusJakartaSans_400Regular' }}>
            Today's problem hasn't been set yet. Check back soon.
          </Text>
        </>
      )}
    </View>
  );
}

function DeadlineChip({ time }: { time: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 4 }}>
      <Ionicons name="time-outline" size={12} color="#94A3B8" />
      <Text className="text-muted text-xs" style={{ fontFamily: 'PlusJakartaSans_500Medium' }}>
        Due {formatTime(time)}
      </Text>
    </View>
  );
}

// ─── Member status ────────────────────────────────────────────────────────────

function MemberStatusSection({
  members,
  submissionMap,
  submittedCount,
  loading,
}: {
  members: MemberWithProfile[];
  submissionMap: Record<string, string>;
  submittedCount: number;
  loading: boolean;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-foreground text-base" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
          Team
        </Text>
        {!loading && members.length > 0 && (
          <Text className="text-muted text-sm" style={{ fontFamily: 'PlusJakartaSans_500Medium' }}>
            {submittedCount}/{members.length} submitted
          </Text>
        )}
      </View>
      {loading ? (
        [0, 1, 2].map((i) => <MemberRowSkeleton key={i} />)
      ) : (
        members.map((m) => (
          <MemberRow key={m.user_id} member={m} status={submissionMap[m.user_id]} />
        ))
      )}
    </View>
  );
}

function MemberRow({ member, status }: { member: MemberWithProfile; status: string | undefined }) {
  const name = member.profiles?.name || 'Unknown';
  const color = avatarColor(member.user_id);
  const badge = statusBadge(status);

  return (
    <View className="flex-row items-center py-3 border-b border-border" style={{ gap: 12 }}>
      <View
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{ backgroundColor: color + '22' }}
      >
        <Text className="text-sm" style={{ fontFamily: 'PlusJakartaSans_700Bold', color }}>
          {initials(name)}
        </Text>
      </View>
      <View className="flex-1">
        <Text
          className="text-foreground text-sm"
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
          numberOfLines={1}
        >
          {name}
        </Text>
        {member.role === 'admin' && (
          <Text className="text-xs" style={{ fontFamily: 'PlusJakartaSans_400Regular', color: '#22C55E' }}>
            Admin
          </Text>
        )}
      </View>
      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: badge.bg }}>
        <Text className="text-xs" style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: badge.color }}>
          {badge.label}
        </Text>
      </View>
    </View>
  );
}

function statusBadge(status: string | undefined): { label: string; color: string; bg: string } {
  switch (status) {
    case 'approved':   return { label: 'Approved',  color: '#22C55E', bg: 'rgba(34,197,94,0.15)' };
    case 'pending_review': return { label: 'Submitted', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' };
    case 'rejected':   return { label: 'Rejected',  color: '#EF4444', bg: 'rgba(239,68,68,0.15)' };
    case 'missed':     return { label: 'Missed',    color: '#EF4444', bg: 'rgba(239,68,68,0.15)' };
    default:           return { label: 'Not yet',   color: '#94A3B8', bg: '#1E293B' };
  }
}

function MemberRowSkeleton() {
  return (
    <View className="flex-row items-center py-3 border-b border-border" style={{ gap: 12 }}>
      <Skeleton width={36} height={36} radius={18} />
      <View style={{ flex: 1, gap: 5 }}>
        <Skeleton width="65%" height={14} radius={6} />
        <Skeleton width="40%" height={11} radius={5} />
      </View>
      <Skeleton width={64} height={24} radius={12} />
    </View>
  );
}

// ─── Empty / skeleton states ──────────────────────────────────────────────────

function NoGroupsState({ onPress }: { onPress: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View
        className="w-20 h-20 rounded-full bg-surface items-center justify-center"
        style={{ marginBottom: 24 }}
      >
        <Ionicons name="calendar-outline" size={36} color="#94A3B8" />
      </View>
      <Text
        className="text-foreground text-xl text-center"
        style={{ fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 8 }}
      >
        No groups yet
      </Text>
      <Text
        className="text-muted text-base text-center"
        style={{ fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 32 }}
      >
        Join or create a group to see your daily challenge here.
      </Text>
      <Pressable
        onPress={onPress}
        className="w-full rounded-2xl py-4 items-center"
        style={{ backgroundColor: '#22C55E' }}
        accessibilityRole="button"
      >
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', fontSize: 16 }}>
          Go to Groups
        </Text>
      </Pressable>
    </View>
  );
}

function SkeletonContent() {
  return (
    <View className="px-5">
      <View className="bg-surface rounded-2xl p-4 mb-4">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Skeleton width={112} height={12} radius={6} />
          <Skeleton width={80} height={24} radius={12} />
        </View>
        <Skeleton width="85%" height={20} radius={8} style={{ marginBottom: 8 }} />
        <Skeleton width={144} height={34} radius={10} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <Skeleton width={56} height={16} radius={7} />
        <Skeleton width={88} height={14} radius={6} />
      </View>
      {[0, 1, 2].map((i) => <MemberRowSkeleton key={i} />)}
    </View>
  );
}
