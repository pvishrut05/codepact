import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const LAST_UPDATED = 'May 10, 2026';
const APP_NAME = 'CodePact';
const CONTACT_EMAIL = 'support@codepact.app';

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-1 mr-3">
          <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
        </Pressable>
        <Text
          className="text-foreground text-lg flex-1"
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
        >
          Terms of Service
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-muted text-sm mb-6" style={{ fontFamily: 'PlusJakartaSans_400Regular' }}>
          Last updated: {LAST_UPDATED}
        </Text>

        <Section title="1. Acceptance of Terms">
          {`By using ${APP_NAME}, you agree to these Terms of Service. If you do not agree, please do not use the app.`}
        </Section>

        <Section title="2. Description of Service">
          {`${APP_NAME} is a group accountability app for tracking LeetCode practice. Users form groups, upload screenshot proof of their daily LeetCode completions, and vote to approve or reject each other's submissions. The app tracks expense obligations between friends — it does not process payments, facilitate gambling, or handle financial transactions.`}
        </Section>

        <Section title="3. Expense Tracking Disclaimer">
          {`${APP_NAME} tracks agreed-upon expense obligations between consenting adults within friend groups. The app:

• Does NOT process real payments
• Does NOT hold, transfer, or manage money
• Does NOT facilitate gambling or wagering
• Only tracks user-defined amounts that group members agree to pay each other

Users are responsible for settling any obligations between themselves outside of the app.`}
        </Section>

        <Section title="4. User Accounts">
          {`You must be 17 or older to use ${APP_NAME}. You are responsible for maintaining the security of your account and for all activity under your account. You agree to provide accurate, current information.`}
        </Section>

        <Section title="5. User Content">
          {`You retain ownership of screenshots and content you upload. By uploading, you grant ${APP_NAME} a limited license to display your content to members of your groups for voting purposes. You agree not to upload content that is illegal, offensive, or unrelated to LeetCode completions.`}
        </Section>

        <Section title="6. Subscriptions & Billing">
          {`${APP_NAME} requires a paid subscription. Subscriptions are processed through Apple's In-App Purchase system subject to Apple's Terms and Conditions. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage or cancel subscriptions through your Apple ID settings. We offer a 7-day free trial for new subscribers.`}
        </Section>

        <Section title="7. Account Deletion">
          {`You may delete your account at any time from Profile → Settings → Delete Account. Deleting your account will permanently remove your data. Subscriptions must be cancelled separately through your Apple ID to stop billing.`}
        </Section>

        <Section title="8. Prohibited Use">
          {`You agree not to:

• Use the app for any unlawful purpose
• Upload fake or misleading screenshots
• Harass or abuse other group members
• Attempt to reverse-engineer or tamper with the app`}
        </Section>

        <Section title="9. Limitation of Liability">
          {`${APP_NAME} is provided "as is." We are not responsible for any disputes between group members regarding expense obligations or any financial decisions made based on data within the app.`}
        </Section>

        <Section title="10. Contact">
          {`Questions about these Terms? Contact us at:\n\n${CONTACT_EMAIL}`}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View className="mb-6">
      <Text
        className="text-foreground text-base mb-2"
        style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
      >
        {title}
      </Text>
      <Text
        className="text-muted text-sm leading-6"
        style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
      >
        {children}
      </Text>
    </View>
  );
}
