import '../global.css';
import 'react-native-url-polyfill/auto';

import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { AuthProvider, useAuth } from '@/lib/auth-context';
// import { configurePurchases } from '@/lib/purchases'; // TODO: Uncomment when Apple Developer account is set up

SplashScreen.preventAutoHideAsync();
// configurePurchases(); // TODO: Uncomment when Apple Developer account is set up

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2,   // 2 min default
      gcTime:   1000 * 60 * 10,   // keep in memory 10 min
    },
  },
});

// ─── Route guard — re-evaluates on every auth/profile change ─────────────────

function RootLayoutNav() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuth    = segments[0] === '(auth)';
    const inPaywall = segments[0] === '(paywall)';
    const inTabs    = segments[0] === '(tabs)';
    const inModal   = [
      'group-create', 'group-join', 'challenge-set',
      'group-penalties', 'group-leaderboard',
    ].includes(segments[0] as string);

    if (!session) {
      if (!inAuth) router.replace('/(auth)' as any);
    } else if (!profile?.has_subscription) {
      if (!inPaywall) router.replace('/(paywall)');
    } else {
      // Allow modal screens when authenticated + subscribed
      if (!inTabs && !inModal) router.replace('/(tabs)');
    }
  }, [session, profile, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(paywall)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="group-create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="group-join" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="challenge-set" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="group-penalties" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="group-leaderboard" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

// ─── Root layout — loads fonts + wraps providers ─────────────────────────────

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
