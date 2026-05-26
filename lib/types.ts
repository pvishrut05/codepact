// ─── Domain types ────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  name: string;
  email: string;
  has_subscription: boolean;
  subscription_expires_at: string | null;
  created_at: string;
  animal_index: number;
  animal_fill: number;
  total_approved: number;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  penalty_amount: number;
  deadline_time: string;
  challenge_mode: 'assigned' | 'any';
  created_by: string | null;
  created_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
};

export type DailyChallenge = {
  id: string;
  group_id: string;
  date: string;
  problem_title: string | null;
  problem_url: string | null;
  difficulty: 'Easy' | 'Medium' | 'Hard' | null;
  set_by: string | null;
  created_at: string;
};

export type Submission = {
  id: string;
  group_id: string;
  challenge_id: string;
  user_id: string;
  screenshot_url: string | null;
  status: 'pending_review' | 'approved' | 'rejected' | 'missed';
  submitted_at: string;
};

export type Penalty = {
  id: string;
  group_id: string;
  user_id: string;
  amount: number;
  date: string;
  reason: string;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
};

export type Vote = {
  id: string;
  submission_id: string;
  voter_id: string;
  vote: 'approve' | 'reject';
  voted_at: string;
};

export type MemberWithProfile = {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profiles: { id: string; name: string; email: string };
};

// ─── Supabase DB type ─────────────────────────────────────────────────────────
// Manually maintained until `npx supabase gen types` is wired up.
// Format must match what @supabase/supabase-js v2 expects exactly.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          name?: string | undefined;
          email?: string | undefined;
          has_subscription?: boolean | undefined;
          subscription_expires_at?: string | null | undefined;
          created_at?: string | undefined;
          animal_index?: number | undefined;
          animal_fill?: number | undefined;
          total_approved?: number | undefined;
        };
        Update: {
          id?: string | undefined;
          name?: string | undefined;
          email?: string | undefined;
          has_subscription?: boolean | undefined;
          subscription_expires_at?: string | null | undefined;
          created_at?: string | undefined;
          animal_index?: number | undefined;
          animal_fill?: number | undefined;
          total_approved?: number | undefined;
        };
        Relationships: [];
      };
      groups: {
        Row: Group;
        Insert: {
          id?: string | undefined;
          name: string;
          invite_code: string;
          penalty_amount?: number | undefined;
          deadline_time?: string | undefined;
          challenge_mode?: 'assigned' | 'any' | undefined;
          created_by?: string | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          name?: string | undefined;
          invite_code?: string | undefined;
          penalty_amount?: number | undefined;
          deadline_time?: string | undefined;
          challenge_mode?: 'assigned' | 'any' | undefined;
          created_by?: string | null | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      group_members: {
        Row: GroupMember;
        Insert: {
          id?: string | undefined;
          group_id: string;
          user_id: string;
          role?: 'admin' | 'member' | undefined;
          joined_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          group_id?: string | undefined;
          user_id?: string | undefined;
          role?: 'admin' | 'member' | undefined;
          joined_at?: string | undefined;
        };
        Relationships: [];
      };
      daily_challenges: {
        Row: DailyChallenge;
        Insert: {
          id?: string | undefined;
          group_id: string;
          date?: string | undefined;
          problem_title?: string | null | undefined;
          problem_url?: string | null | undefined;
          difficulty?: 'Easy' | 'Medium' | 'Hard' | null | undefined;
          set_by?: string | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          group_id?: string | undefined;
          date?: string | undefined;
          problem_title?: string | null | undefined;
          problem_url?: string | null | undefined;
          difficulty?: 'Easy' | 'Medium' | 'Hard' | null | undefined;
          set_by?: string | null | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      submissions: {
        Row: Submission;
        Insert: {
          id?: string | undefined;
          group_id: string;
          challenge_id: string;
          user_id: string;
          screenshot_url?: string | null | undefined;
          status?: 'pending_review' | 'approved' | 'rejected' | 'missed' | undefined;
          submitted_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          group_id?: string | undefined;
          challenge_id?: string | undefined;
          user_id?: string | undefined;
          screenshot_url?: string | null | undefined;
          status?: 'pending_review' | 'approved' | 'rejected' | 'missed' | undefined;
          submitted_at?: string | undefined;
        };
        Relationships: [];
      };
      penalties: {
        Row: Penalty;
        Insert: {
          id?: string | undefined;
          group_id: string;
          user_id: string;
          amount: number;
          date: string;
          reason?: string | undefined;
          paid?: boolean | undefined;
          paid_at?: string | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          group_id?: string | undefined;
          user_id?: string | undefined;
          amount?: number | undefined;
          date?: string | undefined;
          reason?: string | undefined;
          paid?: boolean | undefined;
          paid_at?: string | null | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      votes: {
        Row: Vote;
        Insert: {
          id?: string | undefined;
          submission_id: string;
          voter_id: string;
          vote: 'approve' | 'reject';
          voted_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          submission_id?: string | undefined;
          voter_id?: string | undefined;
          vote?: 'approve' | 'reject' | undefined;
          voted_at?: string | undefined;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
