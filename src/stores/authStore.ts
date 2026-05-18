import { create } from 'zustand';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Role, User } from '@/types';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: Role | null;
  error: string | null;

  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  initialize: () => Promise<void>;
}

async function fetchUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data as User;
}

/**
 * For OAuth/SSO users: the `handle_new_user()` trigger on `auth.users`
 * creates the public.users profile with role='employee' (SECURITY DEFINER).
 * We never upsert from the client to prevent role escalation attacks (V-01).
 * If the trigger hasn't fired yet, we retry with a short delay.
 */
async function ensureUserProfile(authUser: SupabaseUser): Promise<User | null> {
  // Try to fetch the existing profile (trigger should have created it)
  let profile = await fetchUserProfile(authUser.id);
  if (profile) return profile;

  // Trigger may not have fired yet — wait and retry (up to 3 attempts)
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((r) => setTimeout(r, 600));
    profile = await fetchUserProfile(authUser.id);
    if (profile) return profile;
  }

  console.error('User profile not found after auth — trigger may have failed');
  return null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  role: null,
  error: null,

  initialize: async () => {
    try {
      set({ loading: true });

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const profile = await ensureUserProfile(session.user);
        set({
          session,
          user: profile,
          role: profile?.role ?? null,
          loading: false,
          error: null,
        });
      } else {
        set({ session: null, user: null, role: null, loading: false });
      }

      // Keep auth state in sync on token refresh, sign-in, sign-out
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (event === 'SIGNED_OUT' || !newSession) {
          set({ session: null, user: null, role: null, loading: false });
          return;
        }

        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION'
        ) {
          const profile = await ensureUserProfile(newSession.user);
          set({
            session: newSession,
            user: profile,
            role: profile?.role ?? null,
            loading: false,
            error: null,
          });
        }
      });
    } catch {
      set({ loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true, error: null });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ loading: false, error: error.message });
      throw error;
    }

    if (data.session) {
      const profile = await fetchUserProfile(data.session.user.id);
      set({
        session: data.session,
        user: profile,
        role: profile?.role ?? null,
        loading: false,
        error: null,
      });
    }
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({ session: null, user: null, role: null, loading: false, error: null });
  },

  refreshUser: async () => {
    const { session } = get();
    if (!session?.user) return;

    const profile = await fetchUserProfile(session.user.id);
    set({ user: profile, role: profile?.role ?? null });
  },
}));
