import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [emailErr, setEmailErr]       = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [formErr, setFormErr]         = useState('');

  function validate(): boolean {
    let ok = true;
    if (!email.trim()) { setEmailErr('Email is required'); ok = false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { setEmailErr('Enter a valid email'); ok = false; }
    else setEmailErr('');
    if (!password) { setPasswordErr('Password is required'); ok = false; }
    else setPasswordErr('');
    return ok;
  }

  async function handleSignIn() {
    if (!validate()) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    setLoading(true);
    setFormErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFormErr(error.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setOauthLoading(provider);
    try {
      const redirectTo = 'codepact://auth/callback';
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw error ?? new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        const hash = result.url.split('#')[1] ?? '';
        const params = new URLSearchParams(hash);
        const accessToken  = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (e: any) {
      Alert.alert('Sign In Failed', e?.message ?? 'Could not complete sign in. Please try again.');
    } finally {
      setOauthLoading(null);
    }
  }

  function handleForgotPassword() {
    Alert.alert(
      'Reset Password',
      'Enter your email address to receive a password reset link.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            if (!email.trim()) {
              Alert.alert('Enter Email', 'Please enter your email address first.');
              return;
            }
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              Alert.alert('Check your inbox', `A reset link was sent to ${email.trim()}.`);
            }
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#000000' }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ marginBottom: 32, alignSelf: 'flex-start', padding: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#94A3B8" />
        </Pressable>

        {/* Header */}
        <Text
          style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 32, color: '#F8FAFC', marginBottom: 6 }}
        >
          Welcome back
        </Text>
        <Text
          style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, color: '#64748B', marginBottom: 36 }}
        >
          Sign in to your CodePact account
        </Text>

        {/* Form */}
        <View style={{ gap: 16 }}>
          {/* Email */}
          <View>
            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#94A3B8', marginBottom: 8 }}>
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={(t) => { setEmail(t); setEmailErr(''); setFormErr(''); }}
              placeholder="you@example.com"
              placeholderTextColor="#334155"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
              accessibilityLabel="Email address"
              style={{
                backgroundColor: '#0F172A',
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 15,
                color: '#F8FAFC',
                fontFamily: 'PlusJakartaSans_400Regular',
                fontSize: 16,
                borderWidth: 1,
                borderColor: emailErr ? '#EF4444' : '#1E293B',
              }}
            />
            {emailErr ? (
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#EF4444', marginTop: 5 }}>
                {emailErr}
              </Text>
            ) : null}
          </View>

          {/* Password */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#94A3B8' }}>
                Password
              </Text>
              <Pressable
                hitSlop={8}
                onPress={handleForgotPassword}
                accessibilityRole="button"
                accessibilityLabel="Forgot password"
              >
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#22C55E' }}>
                  Forgot?
                </Text>
              </Pressable>
            </View>
            <View style={{ position: 'relative' }}>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordErr(''); setFormErr(''); }}
                placeholder="••••••••"
                placeholderTextColor="#334155"
                secureTextEntry={!showPass}
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                accessibilityLabel="Password"
                style={{
                  backgroundColor: '#0F172A',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 15,
                  paddingRight: 52,
                  color: '#F8FAFC',
                  fontFamily: 'PlusJakartaSans_400Regular',
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: passwordErr ? '#EF4444' : '#1E293B',
                }}
              />
              <Pressable
                onPress={() => setShowPass(v => !v)}
                hitSlop={8}
                style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
                accessibilityRole="button"
                accessibilityLabel={showPass ? 'Hide password' : 'Show password'}
              >
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#475569" />
              </Pressable>
            </View>
            {passwordErr ? (
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#EF4444', marginTop: 5 }}>
                {passwordErr}
              </Text>
            ) : null}
          </View>

          {/* Form error */}
          {formErr ? (
            <View
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.25)',
                padding: 12,
              }}
            >
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#EF4444', textAlign: 'center' }}>
                {formErr}
              </Text>
            </View>
          ) : null}

          {/* Sign In button */}
          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            style={({ pressed }) => ({
              backgroundColor: '#22C55E',
              borderRadius: 14,
              height: 54,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4,
              opacity: pressed || loading ? 0.8 : 1,
              shadowColor: '#22C55E',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
            })}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#000000' }}>
                Sign In
              </Text>
            )}
          </Pressable>
        </View>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 28, gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#1E293B' }} />
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#475569' }}>
            or continue with
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#1E293B' }} />
        </View>

        {/* OAuth buttons */}
        <View style={{ gap: 12 }}>
          {/* Apple */}
          <Pressable
            onPress={() => handleOAuth('apple')}
            disabled={!!oauthLoading}
            style={({ pressed }) => ({
              height: 54,
              borderRadius: 14,
              backgroundColor: '#F8FAFC',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              opacity: pressed || !!oauthLoading ? 0.7 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Apple"
          >
            {oauthLoading === 'apple' ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color="#000000" />
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: '#000000' }}>
                  Continue with Apple
                </Text>
              </>
            )}
          </Pressable>

          {/* Google */}
          <Pressable
            onPress={() => handleOAuth('google')}
            disabled={!!oauthLoading}
            style={({ pressed }) => ({
              height: 54,
              borderRadius: 14,
              backgroundColor: '#0F172A',
              borderWidth: 1,
              borderColor: '#1E293B',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              opacity: pressed || !!oauthLoading ? 0.7 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
          >
            {oauthLoading === 'google' ? (
              <ActivityIndicator color="#F8FAFC" size="small" />
            ) : (
              <>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#4285F4', lineHeight: 22 }}>G</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: '#F8FAFC' }}>
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32, gap: 5 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#475569' }}>
            Don't have an account?
          </Text>
          <Pressable onPress={() => router.push('/(auth)/register')} hitSlop={8}>
            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#22C55E' }}>
              Sign up
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
