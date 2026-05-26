import React, { useState } from 'react';
import {
  View, Text, FlatList, Pressable, Image,
  ActivityIndicator, Modal, Dimensions, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

type VoteCard = {
  submissionId: string;
  groupId: string;
  groupName: string;
  submitterUserId: string;
  submitterName: string;
  challengeTitle: string | null;
  screenshotUrl: string | null;
  submittedAt: string;
  approveCount: number;
  rejectCount: number;
  myVote: 'approve' | 'reject' | null;
  memberCount: number;
};


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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchVoteCards(userId: string): Promise<VoteCard[]> {
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (!memberships?.length) return [];
  const groupIds = memberships.map((m: any) => m.group_id as string);

  const today = new Date().toISOString().split('T')[0];
  const { data: subs } = await supabase
    .from('submissions')
    .select('id, group_id, challenge_id, user_id, screenshot_url, submitted_at')
    .in('group_id', groupIds)
    .eq('status', 'pending_review')
    .neq('user_id', userId)
    .gte('submitted_at', `${today}T00:00:00`)
    .lte('submitted_at', `${today}T23:59:59.999`);

  if (!subs?.length) return [];

  const subIds = subs.map((s: any) => s.id as string);
  const submitterIds = [...new Set(subs.map((s: any) => s.user_id as string))];
  const challengeIds = subs
    .map((s: any) => s.challenge_id as string | null)
    .filter((id): id is string => !!id);

  const challengesPromise = challengeIds.length
    ? supabase
        .from('daily_challenges')
        .select('id, problem_title')
        .in('id', challengeIds)
    : Promise.resolve({ data: [] as { id: string; problem_title: string | null }[] });

  const [
    { data: profiles },
    { data: challenges },
    { data: votes },
    { data: groups },
    { data: allMembers },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name').in('id', submitterIds),
    challengesPromise,
    supabase.from('votes').select('submission_id, voter_id, vote').in('submission_id', subIds),
    supabase.from('groups').select('id, name').in('id', groupIds),
    supabase.from('group_members').select('group_id').in('group_id', groupIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id as string, p.name as string]));
  const challengeMap = new Map(
    (challenges ?? []).map((c: any) => [c.id as string, c.problem_title as string | null]),
  );
  const groupNameMap = new Map((groups ?? []).map((g: any) => [g.id as string, g.name as string]));

  const memberCountMap = new Map<string, number>();
  (allMembers ?? []).forEach((m: any) => {
    memberCountMap.set(m.group_id, (memberCountMap.get(m.group_id) ?? 0) + 1);
  });

  const approveCounts = new Map<string, number>();
  const rejectCounts = new Map<string, number>();
  const myVoteMap = new Map<string, 'approve' | 'reject'>();
  (votes ?? []).forEach((v: any) => {
    const key = v.submission_id as string;
    if (v.vote === 'approve') approveCounts.set(key, (approveCounts.get(key) ?? 0) + 1);
    else rejectCounts.set(key, (rejectCounts.get(key) ?? 0) + 1);
    if (v.voter_id === userId) myVoteMap.set(key, v.vote as 'approve' | 'reject');
  });

  return subs.map((s: any) => ({
    submissionId: s.id as string,
    groupId: s.group_id as string,
    groupName: groupNameMap.get(s.group_id) ?? 'Group',
    submitterUserId: s.user_id as string,
    submitterName: profileMap.get(s.user_id) ?? 'Member',
    challengeTitle: s.challenge_id ? (challengeMap.get(s.challenge_id) ?? null) : null,
    screenshotUrl: s.screenshot_url as string | null,
    submittedAt: s.submitted_at as string,
    approveCount: approveCounts.get(s.id) ?? 0,
    rejectCount: rejectCounts.get(s.id) ?? 0,
    myVote: myVoteMap.get(s.id) ?? null,
    memberCount: memberCountMap.get(s.group_id) ?? 1,
  }));
}

async function castVote(
  submissionId: string,
  groupId: string,
  vote: 'approve' | 'reject',
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('votes')
    .insert({ submission_id: submissionId, voter_id: userId, vote });

  if (error) throw error;

  const [{ data: allVotes }, { data: members }] = await Promise.all([
    supabase.from('votes').select('vote').eq('submission_id', submissionId),
    supabase.from('group_members').select('id').eq('group_id', groupId),
  ]);

  const memberCount = members?.length ?? 1;
  const voterCount = Math.max(memberCount - 1, 1);
  const threshold = Math.ceil(voterCount / 2);

  const approveCount = (allVotes ?? []).filter((v: any) => v.vote === 'approve').length;
  const rejectCount = (allVotes ?? []).filter((v: any) => v.vote === 'reject').length;

  let newStatus: string | null = null;
  if (approveCount >= threshold) newStatus = 'approved';
  else if (rejectCount >= threshold) newStatus = 'rejected';

  if (newStatus) {
    await supabase
      .from('submissions')
      .update({ status: newStatus as 'approved' | 'rejected' })
      .eq('id', submissionId);
  }
}

// ─── Image full-screen ────────────────────────────────────────────────────────

function ImageViewer({ uri, visible, onClose }: { uri: string; visible: boolean; onClose: () => void }) {
  const { width } = Dimensions.get('window');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Image
          source={{ uri }}
          style={{ width, height: width * (4 / 3) }}
          resizeMode="contain"
        />
        <View
          style={{
            position: 'absolute', top: 56, right: 16,
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.12)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Vote buttons ─────────────────────────────────────────────────────────────

function VoteButton({
  label, icon, color,
  voted, active, loading,
  onPress,
}: {
  label: string; icon: string; color: string;
  voted: boolean; active: boolean; loading: boolean;
  onPress: () => void;
}) {
  const solidBg = active;
  const dimmed = voted && !active;

  return (
    <Pressable
      onPress={onPress}
      disabled={voted || loading}
      style={{
        flex: 1, paddingVertical: 12, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 6,
        backgroundColor: solidBg ? color : 'transparent',
        borderWidth: solidBg ? 0 : 1,
        borderColor: dimmed ? '#1E293B' : color,
        opacity: dimmed ? 0.35 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: voted }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={solidBg ? '#000' : color} />
      ) : (
        <>
          <Ionicons name={icon as any} size={15} color={solidBg ? '#000' : color} />
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: solidBg ? '#000' : color }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ─── Submission card ──────────────────────────────────────────────────────────

function SubmissionCard({
  card,
  votingDirection,
  onVote,
}: {
  card: VoteCard;
  votingDirection: 'approve' | 'reject' | null;
  onVote: (submissionId: string, vote: 'approve' | 'reject') => void;
}) {
  const [imgVisible, setImgVisible] = useState(false);
  const color = avatarColor(card.submitterUserId);
  const ini = initials(card.submitterName);
  const voted = card.myVote !== null;
  const isVoting = votingDirection !== null;

  return (
    <View
      style={{
        backgroundColor: '#0F172A',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View
          style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: color + '30',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <Text style={{ color, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 }}>{ini}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F8FAFC', fontSize: 14 }}>
            {card.submitterName}
          </Text>
          <View
            style={{
              flexDirection: 'row', alignItems: 'center',
              marginTop: 3,
              backgroundColor: '#22C55E18',
              borderRadius: 10, alignSelf: 'flex-start',
              paddingHorizontal: 8, paddingVertical: 2,
            }}
          >
            <Text style={{ color: '#22C55E', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11 }}>
              {card.groupName}
            </Text>
          </View>
        </View>
        <Text style={{ color: '#475569', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12 }}>
          {timeAgo(card.submittedAt)}
        </Text>
      </View>

      {/* Challenge title */}
      <Text
        numberOfLines={1}
        style={{ color: '#94A3B8', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, marginBottom: 12 }}
      >
        {card.challengeTitle ?? 'Open submission'}
      </Text>

      {/* Screenshot */}
      {card.screenshotUrl ? (
        <>
          <Pressable
            onPress={() => setImgVisible(true)}
            style={{
              borderRadius: 12, overflow: 'hidden',
              aspectRatio: 16 / 9,
              backgroundColor: '#1E293B',
              marginBottom: 14,
            }}
            accessibilityRole="button"
            accessibilityLabel="View full screenshot"
          >
            <Image
              source={{ uri: card.screenshotUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            <View
              style={{
                position: 'absolute', bottom: 8, right: 8,
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 8, padding: 4,
              }}
            >
              <Ionicons name="expand-outline" size={14} color="#fff" />
            </View>
          </Pressable>
          <ImageViewer uri={card.screenshotUrl} visible={imgVisible} onClose={() => setImgVisible(false)} />
        </>
      ) : (
        <View
          style={{
            borderRadius: 12, aspectRatio: 16 / 9,
            backgroundColor: '#1E293B', marginBottom: 14,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="image-outline" size={28} color="#334155" />
        </View>
      )}

      {/* Tally row */}
      {(() => {
        const voterCount = Math.max(card.memberCount - 1, 1);
        const threshold = Math.ceil(voterCount / 2);
        const approveLeft = Math.max(0, threshold - card.approveCount);
        const rejectLeft  = Math.max(0, threshold - card.rejectCount);
        return (
          <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 16 }}>
                <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                <Text style={{ color: '#22C55E', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 }}>
                  {card.approveCount}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="close-circle" size={15} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 }}>
                  {card.rejectCount}
                </Text>
              </View>
              {voted && (
                <Text style={{ marginLeft: 'auto' as any, color: '#475569', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11 }}>
                  You voted {card.myVote}
                </Text>
              )}
            </View>
            {!voted && (approveLeft > 0 || rejectLeft > 0) && (
              <Text style={{ color: '#334155', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11 }}>
                {approveLeft > 0 ? `${approveLeft} more approve` : ''}
                {approveLeft > 0 && rejectLeft > 0 ? ' · ' : ''}
                {rejectLeft > 0 ? `${rejectLeft} more reject` : ''} to resolve
              </Text>
            )}
          </View>
        );
      })()}

      {/* Vote buttons */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <VoteButton
          label="Approve"
          icon="checkmark"
          color="#22C55E"
          voted={voted}
          active={card.myVote === 'approve'}
          loading={isVoting && votingDirection === 'approve'}
          onPress={() => onVote(card.submissionId, 'approve')}
        />
        <VoteButton
          label="Reject"
          icon="close"
          color="#EF4444"
          voted={voted}
          active={card.myVote === 'reject'}
          loading={isVoting && votingDirection === 'reject'}
          onPress={() => onVote(card.submissionId, 'reject')}
        />
      </View>
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <View style={{ backgroundColor: '#0F172A', borderRadius: 20, padding: 16, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Skeleton width={38} height={38} radius={19} style={{ marginRight: 10 }} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width={120} height={14} radius={6} />
          <Skeleton width={72} height={12} radius={5} />
        </View>
      </View>
      <Skeleton width="55%" height={13} radius={5} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={0} radius={12} style={{ aspectRatio: 16 / 9, height: undefined, marginBottom: 14 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Skeleton width="50%" height={44} radius={14} style={{ flex: 1 }} />
        <Skeleton width="50%" height={44} radius={14} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function VotesScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const userId = session?.user.id ?? '';

  const { data: cards, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['votes', userId],
    queryFn: () => fetchVoteCards(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const voteMutation = useMutation({
    mutationFn: ({ submissionId, groupId, vote }: { submissionId: string; groupId: string; vote: 'approve' | 'reject' }) =>
      castVote(submissionId, groupId, vote, userId),
    onMutate: async ({ submissionId, vote }) => {
      await queryClient.cancelQueries({ queryKey: ['votes', userId] });
      const prev = queryClient.getQueryData<VoteCard[]>(['votes', userId]);
      queryClient.setQueryData<VoteCard[]>(['votes', userId], old =>
        old?.map(card =>
          card.submissionId !== submissionId ? card : {
            ...card,
            myVote: vote,
            approveCount: vote === 'approve' ? card.approveCount + 1 : card.approveCount,
            rejectCount:  vote === 'reject'  ? card.rejectCount  + 1 : card.rejectCount,
          }
        ) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['votes', userId], ctx.prev);
      Alert.alert('Could not vote', 'Please try again.');
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['votes', userId] });
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#F8FAFC', fontSize: 28 }}>
            Review
          </Text>
          {!!cards?.length && (
            <View
              style={{
                backgroundColor: '#22C55E',
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 2,
                minWidth: 24,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#000', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 }}>
                {cards.length}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ color: '#475569', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, marginTop: 2 }}>
          Today's pending submissions
        </Text>
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={cards ?? []}
          keyExtractor={c => c.submissionId}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: insets.bottom + 100,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22C55E" />
          }
          renderItem={({ item }) => (
            <SubmissionCard
              card={item}
              votingDirection={
                voteMutation.isPending && voteMutation.variables?.submissionId === item.submissionId
                  ? voteMutation.variables.vote
                  : null
              }
              onVote={(submissionId, vote) =>
                voteMutation.mutate({ submissionId, groupId: item.groupId, vote })
              }
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <View
                style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: '#0F172A',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="checkmark-done" size={28} color="#22C55E" />
              </View>
              <Text
                style={{
                  color: '#F8FAFC', fontFamily: 'PlusJakartaSans_600SemiBold',
                  fontSize: 16, marginBottom: 6,
                }}
              >
                All caught up
              </Text>
              <Text
                style={{
                  color: '#475569', fontFamily: 'PlusJakartaSans_400Regular',
                  fontSize: 14, textAlign: 'center', maxWidth: 240,
                }}
              >
                No pending submissions to review today.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
