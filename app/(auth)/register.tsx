import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string; email?: string; password?: string; confirm?: string; form?: string;
  }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Full name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!confirm) e.confirm = 'Please confirm your password';
    else if (confirm !== password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setLoading(true);
    setErrors({});
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    setLoading(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors({ form: error.message });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Route guard in _layout.tsx takes over navigation
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6">

          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            className="mb-8 self-start p-1"
          >
            <Ionicons name="chevron-back" size={26} color="#F8FAFC" />
          </Pressable>

          {/* Header */}
          <View className="mb-8">
            <Text
              className="text-foreground text-3xl mb-2"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              Create account
            </Text>
            <Text
              className="text-muted text-base"
              style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
            >
              Join the accountability squad
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <Input
              label="Full name"
              value={name}
              onChangeText={setName}
              error={errors.name}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              placeholder="Vishrut Patel"
            />

            <Input
              ref={emailRef}
              label="Email"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="you@example.com"
            />

            <Input
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              placeholder="Min. 8 characters"
              hint={!errors.password ? 'At least 8 characters' : undefined}
            />

            <Input
              ref={confirmRef}
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              error={errors.confirm}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              placeholder="••••••••"
            />

            {errors.form && (
              <Text
                className="text-brand-red text-sm text-center"
                style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
              >
                {errors.form}
              </Text>
            )}

            <Button
              label="Create Account"
              fullWidth
              loading={loading}
              size="lg"
              onPress={handleRegister}
              style={{ marginTop: 8 }}
            />

            {/* Account deletion — Apple mandate */}
            <Text
              className="text-muted text-xs text-center mt-2"
              style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
            >
              You can delete your account anytime from Profile → Settings → Delete Account.
            </Text>
          </View>

          {/* Footer */}
          <View className="flex-row justify-center mt-8 gap-1">
            <Text
              className="text-muted text-sm"
              style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
            >
              Already have an account?
            </Text>
            <Pressable onPress={() => router.back()}>
              <Text
                className="text-brand-green text-sm"
                style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
              >
                Sign in
              </Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
