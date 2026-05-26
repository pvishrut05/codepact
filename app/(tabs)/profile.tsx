import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Skeleton } from '@/components/ui/Skeleton';
// import RevenueCatUI from 'react-native-purchases-ui'; // TODO: Uncomment when Apple Developer account is set up
import { AnimalProgressCard } from '@/components/animal/AnimalProgressCard';

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

function calculateStreak(approvedDates: string[]): number {
  if (!approvedDates.length) return 0;
  const dateSet = new Set(approvedDates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(today);

  // If today has no submission yet, allow streak to start from yesterday
  const todayStr = check.toISOString().split('T')[0];
  if (!dateSet.has(todayStr)) {
    check.setDate(check.getDate() - 1);
  }

  let streak = 0;
  while (true) {
    const dateStr = check.toISOString().split('T')[0];
    if (dateSet.has(dateStr)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ─── Stats query ──────────────────────────────────────────────────────────────

type ProfileStats = {
  groupCount: number;
  approvedCount: number;
  streak: number;
};

async function fetchStats(userId: string): Promise<ProfileStats> {
  const [
    { count: groupCount },
    { count: approvedCount },
    { data: recentSubs },
  ] = await Promise.all([
    supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'approved'),
    supabase
      .from('submissions')
      .select('submitted_at')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .order('submitted_at', { ascending: false })
      .limit(90),
  ]);

  const dates = (recentSubs ?? []).map((s: any) =>
    (s.submitted_at as string).split('T')[0],
  );
  const streak = calculateStreak(dates);

  return {
    groupCount: groupCount ?? 0,
    approvedCount: approvedCount ?? 0,
    streak,
  };
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon, iconColor }: {
  value: number | string;
  label: string;
  icon: string;
  iconColor: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Ionicons name={icon as any} size={20} color={iconColor} />
      <Text style={{ color: '#F8FAFC', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22 }}>
        {value}
      </Text>
      <Text
        style={{
          color: '#475569',
          fontFamily: 'PlusJakartaSans_400Regular',
          fontSize: 11,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Row item ─────────────────────────────────────────────────────────────────

function SettingsRow({
  icon, label, onPress, destructive, loading,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  loading?: boolean;
}) {
  const color = destructive ? '#EF4444' : '#F8FAFC';
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 16,
        gap: 14,
        opacity: pressed || loading ? 0.6 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={{
          width: 34, height: 34, borderRadius: 10,
          backgroundColor: destructive ? '#EF444415' : '#1E293B',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Ionicons name={icon as any} size={18} color={color} />
        )}
      </View>
      <Text style={{ flex: 1, color, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15 }}>
        {label}
      </Text>
      {!loading && (
        <Ionicons name="chevron-forward" size={16} color="#334155" />
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const userId = session?.user.id ?? '';
  const name = profile?.name ?? 'User';
  const email = profile?.email ?? session?.user.email ?? '';
  const color = avatarColor(userId);
  const ini = initials(name);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['profile-stats', userId],
    queryFn: () => fetchStats(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSigningOut(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: deleteAccount,
        },
      ],
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const { error } = await (supabase.rpc as any)('delete_my_account');
      if (error) throw error;
      await supabase.auth.signOut();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not delete account. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#F8FAFC', fontSize: 28 }}>
          Profile
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + identity */}
        <View style={{ alignItems: 'center', paddingVertical: 28 }}>
          <View
            style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: color + '30',
              borderWidth: 2,
              borderColor: color + '80',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Text style={{ color, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28 }}>{ini}</Text>
          </View>
          <Text style={{ color: '#F8FAFC', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, marginBottom: 4 }}>
            {name}
          </Text>
          <Text style={{ color: '#475569', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14 }}>
            {email}
          </Text>
        </View>

        {/* Animal progression */}
        <AnimalProgressCard
          animalIndex={profile?.animal_index ?? 0}
          animalFill={profile?.animal_fill ?? 0}
          totalApproved={profile?.total_approved ?? 0}
        />

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {statsLoading ? (
            <>
              {[0, 1, 2].map(i => (
                <View key={i} style={{ flex: 1, backgroundColor: '#0F172A', borderRadius: 16, padding: 14, alignItems: 'center', gap: 8 }}>
                  <Skeleton width={22} height={22} radius={11} />
                  <Skeleton width={36} height={22} radius={6} />
                  <Skeleton width={52} height={11} radius={5} />
                </View>
              ))}
            </>
          ) : (
            <>
              <StatCard
                value={stats?.groupCount ?? 0}
                label="Groups"
                icon="people"
                iconColor="#3B82F6"
              />
              <StatCard
                value={stats?.approvedCount ?? 0}
                label="Approved"
                icon="checkmark-circle"
                iconColor="#22C55E"
              />
              <StatCard
                value={stats?.streak ?? 0}
                label="Day streak"
                icon="flame"
                iconColor="#F59E0B"
              />
            </>
          )}
        </View>

        {/* Account section */}
        <Text
          style={{
            color: '#475569',
            fontFamily: 'PlusJakartaSans_500Medium',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: 8,
          }}
        >
          Account
        </Text>
        <View style={{ backgroundColor: '#0F172A', borderRadius: 16, overflow: 'hidden' }}>
          <SettingsRow
            icon="card-outline"
            label="Manage Subscription"
            onPress={() => {
              Alert.alert(
                'Manage Subscription',
                'Full subscription management will be available once the app launches on the App Store.',
                [{ text: 'OK' }],
              );
            }}
          />
          <View style={{ height: 1, backgroundColor: '#1E293B', marginLeft: 64 }} />
          <SettingsRow
            icon="log-out-outline"
            label="Sign Out"
            loading={signingOut}
            onPress={handleSignOut}
          />
          <View style={{ height: 1, backgroundColor: '#1E293B', marginLeft: 64 }} />
          <SettingsRow
            icon="trash-outline"
            label="Delete Account"
            loading={deleting}
            destructive
            onPress={confirmDeleteAccount}
          />
        </View>

        <Text
          style={{
            color: '#334155',
            fontFamily: 'PlusJakartaSans_400Regular',
            fontSize: 12,
            textAlign: 'center',
            marginTop: 24,
          }}
        >
          CodePact — LeetCode accountability
        </Text>
      </ScrollView>
    </View>
  );
}
