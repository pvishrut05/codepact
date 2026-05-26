import React from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Group } from '@/lib/types';

type MemberRow = {
  role: 'admin' | 'member';
  groups: Group & { group_members: [{ count: number }] };
};

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery<MemberRow[]>({
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
      return data as unknown as MemberRow[];
    },
  });

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <Text
          className="text-foreground text-2xl"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          Groups
        </Text>
        <View className="flex-row" style={{ gap: 10 }}>
          <Pressable
            onPress={() => router.push('/group-join')}
            hitSlop={8}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
            accessibilityLabel="Join a group"
            accessibilityRole="button"
          >
            <Ionicons name="enter-outline" size={20} color="#94A3B8" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/group-create')}
            hitSlop={8}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: '#22C55E' }}
            accessibilityLabel="Create a group"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={22} color="#000000" />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <SkeletonList />
      ) : !data || data.length === 0 ? (
        <EmptyState
          onCreate={() => router.push('/group-create')}
          onJoin={() => router.push('/group-join')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22C55E" />
          }
          showsVerticalScrollIndicator={false}
        >
          {data.map((item) => (
            <GroupCard key={item.groups.id} item={item} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── GroupCard ────────────────────────────────────────────────────────────────

function GroupCard({ item }: { item: MemberRow }) {
  const router = useRouter();
  const { groups: group, role } = item;
  const memberCount = group.group_members?.[0]?.count ?? 1;

  return (
    <Pressable
      onPress={() => router.push(`/group/${group.id}`)}
      className="bg-surface rounded-2xl p-4 mb-3 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`Open ${group.name}`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <Text
          className="text-foreground text-lg flex-1 mr-2"
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
          numberOfLines={1}
        >
          {group.name}
        </Text>
        <View
          className="px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: role === 'admin' ? 'rgba(34,197,94,0.15)' : '#1E293B',
          }}
        >
          <Text
            className="text-xs"
            style={{
              fontFamily: 'PlusJakartaSans_500Medium',
              color: role === 'admin' ? '#22C55E' : '#94A3B8',
            }}
          >
            {role === 'admin' ? 'Admin' : 'Member'}
          </Text>
        </View>
      </View>

      <View className="flex-row" style={{ gap: 16 }}>
        <StatChip icon="cash-outline" value={`$${group.penalty_amount}`} label="per miss" />
        <StatChip
          icon="people-outline"
          value={String(memberCount)}
          label={memberCount === 1 ? 'member' : 'members'}
        />
        <StatChip
          icon="time-outline"
          value={formatDeadline(group.deadline_time)}
          label="deadline"
        />
      </View>
    </Pressable>
  );
}

function StatChip({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 4 }}>
      <Ionicons name={icon as any} size={13} color="#94A3B8" />
      <Text
        className="text-foreground text-sm"
        style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
      >
        {value}
      </Text>
      <Text className="text-muted text-xs" style={{ fontFamily: 'PlusJakartaSans_400Regular' }}>
        {label}
      </Text>
    </View>
  );
}

function formatDeadline(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View
        className="w-20 h-20 rounded-full bg-surface items-center justify-center"
        style={{ marginBottom: 24 }}
      >
        <Ionicons name="people-outline" size={36} color="#94A3B8" />
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
        Create a group or join one with an invite code.
      </Text>
      <Pressable
        onPress={onCreate}
        className="w-full rounded-2xl py-4 items-center"
        style={{ backgroundColor: '#22C55E', marginBottom: 12 }}
        accessibilityRole="button"
      >
        <Text
          className="text-base"
          style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}
        >
          Create a Group
        </Text>
      </Pressable>
      <Pressable
        onPress={onJoin}
        className="w-full bg-surface rounded-2xl py-4 items-center"
        accessibilityRole="button"
      >
        <Text
          className="text-foreground text-base"
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
        >
          Join with Invite Code
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View className="bg-surface rounded-2xl p-4 mb-3">
      <View className="flex-row justify-between mb-3">
        <Skeleton width={160} height={18} radius={8} />
        <Skeleton width={56} height={22} radius={11} />
      </View>
      <View className="flex-row" style={{ gap: 16 }}>
        <Skeleton width={60} height={14} radius={6} />
        <Skeleton width={60} height={14} radius={6} />
        <Skeleton width={60} height={14} radius={6} />
      </View>
    </View>
  );
}

function SkeletonList() {
  return (
    <View className="px-5 pt-1">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}
