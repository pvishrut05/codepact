import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Skeleton } from '@/components/ui/Skeleton';
import { AnimalMiniChip } from '@/components/animal/AnimalMiniChip';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#3B82F6'];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function calculateStreak(dateStrings: string[]): number {
  if (!dateStrings.length) return 0;
  const dateSet = new Set(dateStrings);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(today);

  if (!dateSet.has(check.toISOString().split('T')[0])) {
    check.setDate(check.getDate() - 1);
  }

  let streak = 0;
  while (true) {
    const d = check.toISOString().split('T')[0];
    if (dateSet.has(d)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LeaderboardEntry = {
  userId: string;
  name: string;
  approved: number;
  missed: number;
  streak: number;
  owed: number;
  animalIndex: number;
  animalFill: number;
};

type HistoryItem = {
  id: string;
  challengeId: string | null;
  status: 'pending_review' | 'approved' | 'rejected' | 'missed';
  submittedAt: string;
  challengeTitle: string | null;
};

type ScreenData = {
  entries: LeaderboardEntry[];
  history: HistoryItem[];
};

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchData(groupId: string, currentUserId: string): Promise<ScreenData> {
  const [
    { data: rawMembers },
    { data: allSubs },
    { data: penalties },
    { data: mySubs },
  ] = await Promise.all([
    supabase
      .from('group_members')
      .select('user_id, profiles(name, animal_index, animal_fill)')
      .eq('group_id', groupId),
    supabase
      .from('submissions')
      .select('user_id, status, submitted_at')
      .eq('group_id', groupId),
    supabase
      .from('penalties')
      .select('user_id, amount, paid')
      .eq('group_id', groupId),
    supabase
      .from('submissions')
      .select('id, challenge_id, status, submitted_at')
      .eq('group_id', groupId)
      .eq('user_id', currentUserId)
      .order('submitted_at', { ascending: false })
      .limit(60),
  ]);

  // Fetch challenge titles for my submissions
  const challengeIds = [...new Set(
    (mySubs ?? []).map((s: any) => s.challenge_id as string | null).filter((id): id is string => !!id),
  )];
  const { data: challenges } = challengeIds.length
    ? await supabase.from('daily_challenges').select('id, problem_title').in('id', challengeIds)
    : { data: [] as { id: string; problem_title: string | null }[] };

  const challengeMap = new Map((challenges ?? []).map((c: any) => [c.id as string, c.problem_title as string | null]));

  // Build name + animal map
  type MemberMeta = { name: string; animalIndex: number; animalFill: number };
  const memberMap = new Map<string, MemberMeta>(
    (rawMembers ?? []).map((m: any) => [
      m.user_id as string,
      {
        name: (m.profiles as any)?.name as string ?? 'Member',
        animalIndex: (m.profiles as any)?.animal_index as number ?? 0,
        animalFill: (m.profiles as any)?.animal_fill as number ?? 0,
      },
    ]),
  );
  const nameMap = new Map([...memberMap.entries()].map(([id, v]) => [id, v.name]));

  // Per-member submission stats
  type Stat = { approved: number; missed: number; approvedDates: Set<string> };
  const statMap = new Map<string, Stat>();
  for (const uid of nameMap.keys()) {
    statMap.set(uid, { approved: 0, missed: 0, approvedDates: new Set() });
  }
  (allSubs ?? []).forEach((s: any) => {
    const stat = statMap.get(s.user_id);
    if (!stat) return;
    if (s.status === 'approved') {
      stat.approved++;
      stat.approvedDates.add((s.submitted_at as string).split('T')[0]);
    } else if (s.status === 'missed') {
      stat.missed++;
    }
  });

  // Per-member unpaid penalties
  const owedMap = new Map<string, number>();
  (penalties ?? []).forEach((p: any) => {
    if (!p.paid) owedMap.set(p.user_id, (owedMap.get(p.user_id) ?? 0) + (p.amount as number));
  });

  // Build leaderboard entries
  const entries: LeaderboardEntry[] = [...memberMap.entries()].map(([uid, meta]) => {
    const stat = statMap.get(uid) ?? { approved: 0, missed: 0, approvedDates: new Set<string>() };
    return {
      userId: uid,
      name: meta.name,
      approved: stat.approved,
      missed: stat.missed,
      streak: calculateStreak([...stat.approvedDates]),
      owed: owedMap.get(uid) ?? 0,
      animalIndex: meta.animalIndex,
      animalFill: meta.animalFill,
    };
  });

  entries.sort((a, b) => b.approved - a.approved || b.streak - a.streak);

  // Build history items
  const history: HistoryItem[] = (mySubs ?? []).map((s: any) => ({
    id: s.id as string,
    challengeId: s.challenge_id as string | null,
    status: s.status as HistoryItem['status'],
    submittedAt: s.submitted_at as string,
    challengeTitle: s.challenge_id ? (challengeMap.get(s.challenge_id) ?? null) : null,
  }));

  return { entries, history };
}

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, { bg: string; text: string }> = {
    1: { bg: '#F59E0B20', text: '#F59E0B' },
    2: { bg: '#94A3B820', text: '#94A3B8' },
    3: { bg: '#D9770620', text: '#D97706' },
  };
  const style = colors[rank] ?? { bg: '#1E293B', text: '#475569' };
  return (
    <View
      style={{
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: style.bg,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ color: style.text, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 }}>
        {rank}
      </Text>
    </View>
  );
}

// ─── Leaderboard entry ────────────────────────────────────────────────────────

function LeaderboardRow({ entry, rank, isMe }: { entry: LeaderboardEntry; rank: number; isMe: boolean }) {
  const color = avatarColor(entry.userId);
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 13, paddingHorizontal: 16, gap: 12,
        backgroundColor: isMe ? '#22C55E08' : 'transparent',
      }}
    >
      <RankBadge rank={rank} />
      <View
        style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: color + '28',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ color, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 }}>
          {initials(entry.name)}
        </Text>
      </View>
      <Text
        style={{ flex: 1, color: '#F8FAFC', fontFamily: isMe ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium', fontSize: 14 }}
        numberOfLines={1}
      >
        {entry.name}{isMe ? ' (you)' : ''}
      </Text>
      {/* Stats */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AnimalMiniChip animalIndex={entry.animalIndex} animalFill={entry.animalFill} />
        <StatChip icon="flame" value={entry.streak} color="#F59E0B" />
        <StatChip icon="checkmark-circle" value={entry.approved} color="#22C55E" />
        {entry.owed > 0 && (
          <Text style={{ color: '#EF4444', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 }}>
            ${entry.owed.toFixed(0)}
          </Text>
        )}
      </View>
    </View>
  );
}

function StatChip({ icon, value, color }: { icon: string; value: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={icon as any} size={13} color={color} />
      <Text style={{ color: '#94A3B8', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 }}>
        {value}
      </Text>
    </View>
  );
}

// ─── History row ──────────────────────────────────────────────────────────────

const STATUS_META = {
  approved: { icon: 'checkmark-circle', color: '#22C55E', label: 'Approved' },
  rejected: { icon: 'close-circle', color: '#EF4444', label: 'Rejected' },
  missed: { icon: 'ban', color: '#475569', label: 'Missed' },
  pending_review: { icon: 'time', color: '#F59E0B', label: 'Pending' },
} as const;

function HistoryRow({ item }: { item: HistoryItem }) {
  const meta = STATUS_META[item.status];
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 13, paddingHorizontal: 16, gap: 12,
      }}
    >
      <Ionicons name={meta.icon as any} size={20} color={meta.color} />
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: '#F8FAFC', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14 }}
          numberOfLines={1}
        >
          {item.challengeTitle ?? 'Open submission'}
        </Text>
        <Text style={{ color: '#475569', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, marginTop: 1 }}>
          {formatDate(item.submittedAt)}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: meta.color + '18',
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}
      >
        <Text style={{ color: meta.color, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11 }}>
          {meta.label}
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GroupLeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const { groupId, groupName } = useLocalSearchParams<{ groupId: string; groupName?: string }>();
  const [tab, setTab] = useState<'leaderboard' | 'history'>('leaderboard');

  const userId = session?.user.id ?? '';

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['leaderboard', groupId, userId],
    queryFn: () => fetchData(groupId!, userId),
    enabled: !!groupId && !!userId,
    staleTime: 30_000,
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: '#0F172A',
            alignItems: 'center', justifyContent: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color="#94A3B8" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#F8FAFC', fontSize: 20 }}>
            Stats
          </Text>
          {groupName ? (
            <Text style={{ color: '#475569', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13 }}>
              {groupName}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 }}>
        {(['leaderboard', 'history'] as const).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
              backgroundColor: tab === t ? '#22C55E' : '#0F172A',
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text
              style={{
                fontFamily: 'PlusJakartaSans_600SemiBold',
                fontSize: 13,
                color: tab === t ? '#000' : '#94A3B8',
              }}
            >
              {t === 'leaderboard' ? 'Leaderboard' : 'My History'}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <LeaderboardSkeleton />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22C55E" />
          }
        >
          {tab === 'leaderboard' ? (
            <>
              {/* Column headers */}
              <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 6 }}>
                <Text style={{ flex: 1, color: '#334155', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11 }}>
                  MEMBER
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Text style={{ color: '#F59E0B50', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, width: 30, textAlign: 'center' }}>STK</Text>
                  <Text style={{ color: '#22C55E50', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, width: 24, textAlign: 'center' }}>APP</Text>
                </View>
              </View>

              {(data?.entries ?? []).length > 0 ? (
                <View style={{ backgroundColor: '#0F172A', borderRadius: 16, overflow: 'hidden' }}>
                  {(data?.entries ?? []).map((entry, i) => (
                    <React.Fragment key={entry.userId}>
                      {i > 0 && (
                        <View style={{ height: 1, backgroundColor: '#1E293B', marginLeft: 94 }} />
                      )}
                      <LeaderboardRow
                        entry={entry}
                        rank={i + 1}
                        isMe={entry.userId === userId}
                      />
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                <EmptyState message="No members yet." />
              )}
            </>
          ) : (
            <>
              {(data?.history ?? []).length > 0 ? (
                <View style={{ backgroundColor: '#0F172A', borderRadius: 16, overflow: 'hidden' }}>
                  {(data?.history ?? []).map((item, i) => (
                    <React.Fragment key={item.id}>
                      {i > 0 && (
                        <View style={{ height: 1, backgroundColor: '#1E293B', marginLeft: 48 }} />
                      )}
                      <HistoryRow item={item} />
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                <EmptyState message="No submissions yet. Start solving!" />
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function LeaderboardSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16 }}>
      <View style={{ backgroundColor: '#0F172A', borderRadius: 16, overflow: 'hidden' }}>
        {[0, 1, 2, 3].map((i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={{ height: 1, backgroundColor: '#1E293B', marginLeft: 94 }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, gap: 12 }}>
              <Skeleton width={30} height={30} radius={15} />
              <Skeleton width={36} height={36} radius={18} />
              <Skeleton width={100} height={13} radius={6} style={{ flex: 1 }} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Skeleton width={30} height={13} radius={5} />
                <Skeleton width={24} height={13} radius={5} />
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 60 }}>
      <View
        style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: '#0F172A',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Ionicons name="bar-chart-outline" size={24} color="#334155" />
      </View>
      <Text style={{ color: '#475569', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14 }}>
        {message}
      </Text>
    </View>
  );
}
