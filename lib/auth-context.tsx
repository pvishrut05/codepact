import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Profile } from './types';
import { identifyUser, clearUser } from './purchases';
import { currentAnimal, nextAnimal, type AnimalToastEvent } from './animals';

type AuthContextType = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  devGrantSubscription: () => void;
  animalToastEvent: AnimalToastEvent | null;
  clearAnimalToast: () => void;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  devGrantSubscription: () => {},
  animalToastEvent: null,
  clearAnimalToast: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [animalToastEvent, setAnimalToastEvent] = useState<AnimalToastEvent | null>(null);

  // Track previous animal state for change detection
  const profileRef = useRef<Profile | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      setProfile(data);
      profileRef.current = data;
    }
  };

  // Real-time subscription for animal progression updates
  const setupRealtimeChannel = (userId: string) => {
    const channel = supabase
      .channel(`profile-animal-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Profile;
          const prev = profileRef.current;

          if (prev) {
            if (updated.animal_index > prev.animal_index) {
              // Animal completed — new one unlocked
              const completedAnimal = currentAnimal(prev.animal_index);
              const unlockedAnimal = currentAnimal(updated.animal_index);
              setAnimalToastEvent({
                type: 'unlock',
                animal: completedAnimal,
                fill: completedAnimal.requiredFill,
                required: completedAnimal.requiredFill,
                nextAnimal: unlockedAnimal,
              });
            } else if (updated.animal_fill > prev.animal_fill) {
              // Fill increased
              const animal = currentAnimal(updated.animal_index);
              setAnimalToastEvent({
                type: 'fill',
                animal,
                fill: updated.animal_fill,
                required: animal.requiredFill,
                nextAnimal: nextAnimal(updated.animal_index),
              });
            }
          }

          profileRef.current = updated;
          setProfile(updated);
        },
      )
      .subscribe();

    return channel;
  };

  useEffect(() => {
    let realtimeChannel: ReturnType<typeof setupRealtimeChannel> | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        identifyUser(session.user.id);
        // Realtime channel is set up by onAuthStateChange (fires immediately with INITIAL_SESSION)
        // Setting it up here too causes "cannot add postgres_changes callbacks after subscribe()" error
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          identifyUser(session.user.id);
          if (realtimeChannel) supabase.removeChannel(realtimeChannel);
          realtimeChannel = setupRealtimeChannel(session.user.id);
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          profileRef.current = null;
          if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
          }
        }
      },
    );

    return () => {
      subscription.unsubscribe();
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    await clearUser();
    setSession(null);
    setProfile(null);
    profileRef.current = null;
  };

  const refreshProfile = async () => {
    if (session) await fetchProfile(session.user.id);
  };

  const devGrantSubscription = () => {
    if (!profile) return;
    const patched = { ...profile, has_subscription: true };
    setProfile(patched);
    profileRef.current = patched;
  };

  const clearAnimalToast = () => setAnimalToastEvent(null);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        signOut,
        refreshProfile,
        devGrantSubscription,
        animalToastEvent,
        clearAnimalToast,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
