import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const LAST_UPDATED = 'May 10, 2026';
const APP_NAME = 'CodePact';
const CONTACT_EMAIL = 'privacy@codepact.app';

export default function PrivacyPolicyScreen() {
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
          Privacy Policy
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

        <Section title="1. Information We Collect">
          {`We collect information you provide when creating an account:

• Name and email address
• Profile information
• LeetCode submission screenshots you upload
• Group activity, votes, and streak data

We do not collect health data, location data, or financial information beyond what is necessary for expense tracking within your groups.`}
        </Section>

        <Section title="2. How We Use Your Information">
          {`We use your information to:

• Provide and maintain the ${APP_NAME} service
• Track group accountability and streaks
• Display submission screenshots to your group members for voting
• Send notifications about group activity and deadlines
• Improve the app experience

We do not sell your personal information to third parties.`}
        </Section>

        <Section title="3. Information Sharing">
          {`Your information is shared only within your groups:

• Your name and submission screenshots are visible to members of groups you join
• Penalty amounts and payment status are visible to relevant group members
• We do not share your information with advertisers or data brokers`}
        </Section>

        <Section title="4. Data Storage">
          {`Your data is stored securely using Supabase (PostgreSQL) with row-level security. Screenshots are stored in encrypted cloud storage. We retain your data for as long as your account is active.`}
        </Section>

        <Section title="5. Your Rights & Account Deletion">
          {`You have the right to:

• Access your personal data at any time
• Request correction of inaccurate data
• Delete your account and all associated data

To delete your account and all your data, go to Profile → Settings → Delete Account. Deletion is permanent and cannot be undone.`}
        </Section>

        <Section title="6. Subscriptions">
          {`${APP_NAME} offers paid subscriptions processed through Apple's In-App Purchase system. We do not store your payment card information. Subscription management and cancellation can be done through your Apple ID settings.`}
        </Section>

        <Section title="7. Children's Privacy">
          {`${APP_NAME} is not directed at children under 17 years of age. We do not knowingly collect personal information from children under 17. If you believe a child has provided us with their information, please contact us.`}
        </Section>

        <Section title="8. Changes to This Policy">
          {`We may update this Privacy Policy from time to time. We will notify you of significant changes through the app. Continued use of the app after changes means you accept the updated policy.`}
        </Section>

        <Section title="9. Contact Us">
          {`If you have questions about this Privacy Policy or your data, contact us at:\n\n${CONTACT_EMAIL}`}
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
