import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/Skeleton';

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

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PenaltyItem = {
  id: string;
  userId: string;
  memberName: string;
  amount: number;
  date: string;
  paid: boolean;
  paidAt: string | null;
};

type MemberSummary = {
  userId: string;
  name: string;
  totalUnpaid: number;
  totalPaid: number;
};

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchPenalties(groupId: string): Promise<{ items: PenaltyItem[]; summaries: MemberSummary[] }> {
  const [{ data: penalties }, { data: rawMembers }] = await Promise.all([
    supabase
      .from('penalties')
      .select('id, user_id, amount, date, paid, paid_at')
      .eq('group_id', groupId)
      .order('date', { ascending: false }),
    supabase
      .from('group_members')
      .select('user_id, profiles(name)')
      .eq('group_id', groupId),
  ]);

  const nameMap = new Map<string, string>(
    (rawMembers ?? []).map((m: any) => [m.user_id as string, (m.profiles as any)?.name ?? 'Member']),
  );

  const items: PenaltyItem[] = (penalties ?? []).map((p: any) => ({
    id: p.id as string,
    userId: p.user_id as string,
    memberName: nameMap.get(p.user_id) ?? 'Member',
    amount: p.amount as number,
    date: p.date as string,
    paid: p.paid as boolean,
    paidAt: p.paid_at as string | null,
  }));

  // Build per-member summary
  const summaryMap = new Map<string, MemberSummary>();
  for (const [uid, name] of nameMap) {
    summaryMap.set(uid, { userId: uid, name, totalUnpaid: 0, totalPaid: 0 });
  }
  for (const item of items) {
    const s = summaryMap.get(item.userId);
    if (!s) continue;
    if (item.paid) s.totalPaid += item.amount;
    else s.totalUnpaid += item.amount;
  }

  const summaries = [...summaryMap.values()]
    .filter(s => s.totalUnpaid > 0 || s.totalPaid > 0)
    .sort((a, b) => b.totalUnpaid - a.totalUnpaid);

  return { items, summaries };
}

// ─── Member summary row ───────────────────────────────────────────────────────

function MemberDebtRow({ summary }: { summary: MemberSummary }) {
  const color = avatarColor(summary.userId);
  const settled = summary.totalUnpaid === 0;
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: color + '28',
          alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Text style={{ color, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 }}>
          {initials(summary.name)}
        </Text>
      </View>
      <Text
        style={{ flex: 1, color: '#F8FAFC', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14 }}
        numberOfLines={1}
      >
        {summary.name}
      </Text>
      {settled ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
          <Text style={{ color: '#22C55E', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 }}>
            Settled
          </Text>
        </View>
      ) : (
        <Text style={{ color: '#EF4444', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 }}>
          ${summary.totalUnpaid.toFixed(2)}
        </Text>
      )}
    </View>
  );
}

// ─── Penalty record row ───────────────────────────────────────────────────────

function PenaltyRecordRow({
  item,
  onMarkPaid,
  marking,
}: {
  item: PenaltyItem;
  onMarkPaid: (id: string) => void;
  marking: boolean;
}) {
  const color = avatarColor(item.userId);
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 13, paddingHorizontal: 16, gap: 12,
      }}
    >
      <View
        style={{
          width: 34, height: 34, borderRadius: 17,
          backgroundColor: color + '25',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ color, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11 }}>
          {initials(item.memberName)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#F8FAFC', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13 }} numberOfLines={1}>
          {item.memberName}
        </Text>
        <Text style={{ color: '#475569', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, marginTop: 1 }}>
          {formatDate(item.date)}
        </Text>
      </View>
      <Text style={{ color: '#F8FAFC', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, marginRight: 10 }}>
        ${item.amount.toFixed(2)}
      </Text>
      {item.paid ? (
        <View
          style={{
            backgroundColor: '#22C55E18', borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 5,
          }}
        >
          <Text style={{ color: '#22C55E', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 }}>
            Paid
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={() => onMarkPaid(item.id)}
          disabled={marking}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#1E293B' : '#0F172A',
            borderWidth: 1,
            borderColor: '#334155',
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            opacity: marking ? 0.5 : 1,
          })}
          accessibilityRole="button"
          accessibilityLabel="Mark as paid"
        >
          {marking ? (
            <ActivityIndicator size="small" color="#94A3B8" />
          ) : (
            <Text style={{ color: '#94A3B8', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 }}>
              Mark paid
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonContent() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <Skeleton width={60} height={11} radius={5} style={{ marginBottom: 10, marginLeft: 4 }} />
      <View style={{ backgroundColor: '#0F172A', borderRadius: 16, padding: 16, marginBottom: 20, gap: 12 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={36} height={36} radius={18} />
            <Skeleton width={120} height={13} radius={6} style={{ flex: 1 }} />
            <Skeleton width={50} height={13} radius={6} />
          </View>
        ))}
      </View>
      <Skeleton width={60} height={11} radius={5} style={{ marginBottom: 10, marginLeft: 4 }} />
      <View style={{ backgroundColor: '#0F172A', borderRadius: 16, padding: 16, gap: 14 }}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={34} height={34} radius={17} />
            <View style={{ flex: 1, gap: 5 }}>
              <Skeleton width={100} height={12} radius={5} />
              <Skeleton width={60} height={10} radius={4} />
            </View>
            <Skeleton width={45} height={13} radius={6} />
            <Skeleton width={72} height={28} radius={8} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GroupPenaltiesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { groupId, groupName } = useLocalSearchParams<{ groupId: string; groupName?: string }>();

  const [filter, setFilter] = useState<'all' | 'unpaid'>('unpaid');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['penalties', groupId],
    queryFn: () => fetchPenalties(groupId!),
    enabled: !!groupId,
    staleTime: 1000 * 60 * 2,
  });

  const items = data?.items ?? [];
  const summaries = data?.summaries ?? [];
  const filteredItems = filter === 'unpaid' ? items.filter(i => !i.paid) : items;
  const totalUnpaid = summaries.reduce((sum, s) => sum + s.totalUnpaid, 0);

  type PenaltyContext = { prev: typeof data };

  const markPaidMutation = useMutation<void, Error, string, PenaltyContext>({
    mutationFn: async (penaltyId: string) => {
      const { error } = await supabase
        .from('penalties')
        .update({ paid: true, paid_at: new Date().toISOString() })
        .eq('id', penaltyId);
      if (error) throw error;
    },
    onMutate: async (penaltyId) => {
      await queryClient.cancelQueries({ queryKey: ['penalties', groupId] });
      const prev = queryClient.getQueryData<typeof data>(['penalties', groupId]);

      queryClient.setQueryData<typeof data>(['penalties', groupId], old => {
        if (!old) return old;
        const updatedItems = old.items.map(item =>
          item.id === penaltyId ? { ...item, paid: true, paidAt: new Date().toISOString() } : item
        );
        const summaryMap = new Map<string, MemberSummary>();
        for (const item of updatedItems) {
          const s = summaryMap.get(item.userId) ?? { userId: item.userId, name: item.memberName, totalUnpaid: 0, totalPaid: 0 };
          if (item.paid) s.totalPaid += item.amount; else s.totalUnpaid += item.amount;
          summaryMap.set(item.userId, s);
        }
        const updatedSummaries = [...summaryMap.values()]
          .filter(s => s.totalUnpaid > 0 || s.totalPaid > 0)
          .sort((a, b) => b.totalUnpaid - a.totalUnpaid);
        return { items: updatedItems, summaries: updatedSummaries };
      });
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['penalties', groupId], ctx.prev);
      Alert.alert('Error', 'Could not update penalty.');
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['penalties', groupId] });
    },
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
          accessibilityLabel="Go back"
        >
          <Ionicons name="close" size={20} color="#94A3B8" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#F8FAFC', fontSize: 20 }}>
            Penalties
          </Text>
          {groupName ? (
            <Text style={{ color: '#475569', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13 }}>
              {groupName}
            </Text>
          ) : null}
        </View>
        {totalUnpaid > 0 && (
          <View
            style={{
              backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
              paddingHorizontal: 10, paddingVertical: 4,
            }}
          >
            <Text style={{ color: '#EF4444', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 }}>
              ${totalUnpaid.toFixed(2)} owed
            </Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <SkeletonContent />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22C55E" />
          }
        >
          {/* Member summary */}
          {summaries.length > 0 && (
            <>
              <Text
                style={{
                  color: '#475569', fontFamily: 'PlusJakartaSans_500Medium',
                  fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8,
                  marginBottom: 8, marginTop: 4, marginLeft: 4,
                }}
              >
                Summary
              </Text>
              <View style={{ backgroundColor: '#0F172A', borderRadius: 16, marginBottom: 20, overflow: 'hidden' }}>
                {summaries.map((s, i) => (
                  <React.Fragment key={s.userId}>
                    {i > 0 && (
                      <View style={{ height: 1, backgroundColor: '#1E293B', marginLeft: 64 }} />
                    )}
                    <MemberDebtRow summary={s} />
                  </React.Fragment>
                ))}
              </View>
            </>
          )}

          {/* Filter pills */}
          {items.length > 0 && (
            <>
              <Text
                style={{
                  color: '#475569', fontFamily: 'PlusJakartaSans_500Medium',
                  fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8,
                  marginBottom: 8, marginLeft: 4,
                }}
              >
                History
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(['unpaid', 'all'] as const).map(f => (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
                      backgroundColor: filter === f ? '#22C55E' : '#0F172A',
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: filter === f }}
                  >
                    <Text
                      style={{
                        fontFamily: 'PlusJakartaSans_600SemiBold',
                        fontSize: 13,
                        color: filter === f ? '#000' : '#94A3B8',
                      }}
                    >
                      {f === 'unpaid' ? 'Unpaid' : 'All'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Penalty list */}
          {filteredItems.length > 0 ? (
            <View style={{ backgroundColor: '#0F172A', borderRadius: 16, overflow: 'hidden' }}>
              {filteredItems.map((item, i) => (
                <React.Fragment key={item.id}>
                  {i > 0 && (
                    <View style={{ height: 1, backgroundColor: '#1E293B', marginLeft: 62 }} />
                  )}
                  <PenaltyRecordRow
                    item={item}
                    onMarkPaid={(id) => markPaidMutation.mutate(id)}
                    marking={markPaidMutation.isPending && markPaidMutation.variables === item.id}
                  />
                </React.Fragment>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: summaries.length ? 20 : 60 }}>
              <View
                style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: '#0F172A',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <Ionicons name="checkmark-done-circle" size={26} color="#22C55E" />
              </View>
              <Text style={{ color: '#F8FAFC', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, marginBottom: 4 }}>
                {filter === 'unpaid' ? 'No unpaid penalties' : 'No penalties yet'}
              </Text>
              <Text style={{ color: '#475569', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13 }}>
                {filter === 'unpaid' ? 'Everyone is settled up.' : 'Keep hitting those problems.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
