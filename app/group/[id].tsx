import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Share, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Group, MemberWithProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';

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

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatJoined(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [leaving, setLeaving] = useState(false);

  const { data: group, isLoading: groupLoading } = useQuery<Group>({
    queryKey: ['group', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Group;
    },
  });

  const { data: members, isLoading: membersLoading } = useQuery<MemberWithProfile[]>({
    queryKey: ['members', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, role, joined_at, profiles(id, name, email)')
        .eq('group_id', id!);
      if (error) throw error;
      return data as unknown as MemberWithProfile[];
    },
  });

  const userMembership = members?.find((m) => m.user_id === session?.user.id);
  const isAdmin = userMembership?.role === 'admin';
  const isOnlyMember = (members?.length ?? 0) <= 1;

  async function handleShare() {
    if (!group) return;
    await Share.share({ message: `Join my CodePact group "${group.name}" with code: ${group.invite_code}` });
  }

  async function handleLeave() {
    if (!session || !id) return;
    Alert.alert(
      'Leave Group',
      isAdmin && !isOnlyMember
        ? 'You are the admin. Leaving will transfer admin to another member.'
        : isOnlyMember
        ? 'You are the last member. Leaving will delete the group.'
        : `Leave "${group?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              if (isAdmin && members && members.length > 1) {
                const nextAdmin = members.find((m) => m.user_id !== session.user.id);
                if (nextAdmin) {
                  await supabase
                    .from('group_members')
                    .update({ role: 'admin' })
                    .eq('group_id', id)
                    .eq('user_id', nextAdmin.user_id);
                }
              }

              const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', id)
                .eq('user_id', session.user.id);
              if (error) throw error;

              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await queryClient.invalidateQueries({ queryKey: ['groups'] });
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Could not leave group.');
            } finally {
              setLeaving(false);
            }
          },
        },
      ],
    );
  }

  const loading = groupLoading || membersLoading;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-2 pb-4" style={{ gap: 12 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color="#94A3B8" />
        </Pressable>
        <Text
          className="text-foreground text-xl flex-1"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          numberOfLines={1}
        >
          {group?.name ?? 'Group'}
        </Text>
      </View>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Group Details */}
          <SectionHeader title="Details" />
          <View className="bg-surface rounded-2xl mb-4 overflow-hidden">
            <InfoRow icon="cash-outline" label="Penalty" value={`$${group?.penalty_amount} per miss`} />
            <InfoRow icon="time-outline" label="Deadline" value={formatTime(group?.deadline_time ?? '23:59:00')} />
            <InfoRow
              icon="trophy-outline"
              label="Mode"
              value={group?.challenge_mode === 'assigned' ? 'Assigned Problem' : 'Any LeetCode'}
              last
            />
          </View>

          {/* Invite code (admin only) */}
          {isAdmin && group && (
            <>
              <SectionHeader title="Invite Code" />
              <View className="bg-surface rounded-2xl p-4 mb-4 items-center">
                <Text
                  className="text-muted text-xs mb-2"
                  style={{ fontFamily: 'PlusJakartaSans_500Medium', letterSpacing: 2 }}
                >
                  SHARE WITH FRIENDS
                </Text>
                <Text
                  className="text-foreground mb-4"
                  style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 32, letterSpacing: 6 }}
                >
                  {group.invite_code}
                </Text>
                <Pressable
                  onPress={handleShare}
                  className="flex-row items-center rounded-xl py-2.5 px-4"
                  style={{ backgroundColor: '#1E293B', gap: 8 }}
                  accessibilityRole="button"
                >
                  <Ionicons name="share-outline" size={16} color="#F8FAFC" />
                  <Text
                    className="text-foreground text-sm"
                    style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
                  >
                    Share Code
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Leaderboard */}
          <SectionHeader title="Stats" />
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/group-leaderboard' as any,
                params: { groupId: id, groupName: group?.name },
              })
            }
            style={({ pressed }) => ({
              backgroundColor: '#0F172A',
              borderRadius: 16,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 14,
              gap: 12,
              opacity: pressed ? 0.7 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="View leaderboard"
          >
            <View
              style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: '#3B82F618',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="bar-chart-outline" size={16} color="#3B82F6" />
            </View>
            <Text style={{ flex: 1, color: '#F8FAFC', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15 }}>
              Leaderboard & History
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#334155" />
          </Pressable>

          {/* Penalties */}
          <SectionHeader title="Penalties" />
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/group-penalties' as any,
                params: { groupId: id, groupName: group?.name },
              })
            }
            style={({ pressed }) => ({
              backgroundColor: '#0F172A',
              borderRadius: 16,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 14,
              gap: 12,
              opacity: pressed ? 0.7 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="View penalties"
          >
            <View
              style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: '#F59E0B18',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="cash-outline" size={16} color="#F59E0B" />
            </View>
            <Text
              style={{ flex: 1, color: '#F8FAFC', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15 }}
            >
              View Penalties
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#334155" />
          </Pressable>

          {/* Members */}
          <SectionHeader title={`Members (${members?.length ?? 0})`} />
          <View className="bg-surface rounded-2xl mb-6 overflow-hidden">
            {members?.map((m, i) => {
              const name = m.profiles?.name || 'Unknown';
              const color = avatarColor(m.user_id);
              const isLast = i === (members.length - 1);
              return (
                <View
                  key={m.user_id}
                  className="flex-row items-center px-4 py-3"
                  style={!isLast ? { borderBottomWidth: 1, borderBottomColor: '#334155' } : undefined}
                >
                  <View
                    className="w-9 h-9 rounded-full items-center justify-center mr-3"
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
                      {m.user_id === session?.user.id ? ' (you)' : ''}
                    </Text>
                    <Text
                      className="text-muted text-xs"
                      style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
                    >
                      Joined {formatJoined(m.joined_at)}
                    </Text>
                  </View>
                  {m.role === 'admin' && (
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}
                    >
                      <Text
                        className="text-xs"
                        style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#22C55E' }}
                      >
                        Admin
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Danger zone */}
          <Pressable
            onPress={handleLeave}
            disabled={leaving}
            className="w-full rounded-2xl py-4 items-center flex-row justify-center"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)', gap: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Leave group"
          >
            {leaving ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <>
                <Ionicons name="exit-outline" size={18} color="#EF4444" />
                <Text
                  className="text-brand-red text-base"
                  style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
                >
                  Leave Group
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      className="text-muted text-xs mb-2"
      style={{ fontFamily: 'PlusJakartaSans_500Medium', letterSpacing: 1, textTransform: 'uppercase' }}
    >
      {title}
    </Text>
  );
}

function InfoRow({
  icon, label, value, last,
}: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View
      className="flex-row items-center px-4 py-3"
      style={!last ? { borderBottomWidth: 1, borderBottomColor: '#334155' } : undefined}
    >
      <Ionicons name={icon as any} size={16} color="#94A3B8" style={{ marginRight: 12 }} />
      <Text className="text-muted text-sm flex-1" style={{ fontFamily: 'PlusJakartaSans_400Regular' }}>
        {label}
      </Text>
      <Text className="text-foreground text-sm" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
        {value}
      </Text>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <Skeleton width={56} height={11} radius={5} style={{ marginBottom: 8 }} />
      <View style={{ backgroundColor: '#0F172A', borderRadius: 16, padding: 16, marginBottom: 20, gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={64} height={14} radius={6} />
            <Skeleton width={110} height={14} radius={6} />
          </View>
        ))}
      </View>
      <Skeleton width={72} height={11} radius={5} style={{ marginBottom: 8 }} />
      <View style={{ backgroundColor: '#0F172A', borderRadius: 16, padding: 16, gap: 14 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={36} height={36} radius={18} />
            <View style={{ flex: 1, gap: 5 }}>
              <Skeleton width={100} height={13} radius={5} />
              <Skeleton width={70} height={10} radius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
