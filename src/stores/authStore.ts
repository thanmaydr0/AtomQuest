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
 * For OAuth/SSO users: if no public.users profile exists yet, create one
 * from the auth session metadata so they don't get stuck in a login loop.
 */
async function ensureUserProfile(authUser: SupabaseUser): Promise<User | null> {
  // First try to fetch the existing profile
  let profile = await fetchUserProfile(authUser.id);
  if (profile) return profile;

  // Profile doesn't exist — auto-provision from OAuth metadata
  const meta = authUser.user_metadata ?? {};
  const name =
    meta.full_name ||
    meta.name ||
    meta.preferred_username ||
    authUser.email?.split('@')[0] ||
    'User';

  const { error } = await supabase.from('users').upsert(
    {
      user_id: authUser.id,
      email: authUser.email ?? '',
      name,
      role: 'employee' as Role,
      department: '',
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('Failed to auto-create user profile:', error.message);
    // Even if upsert fails (e.g. RLS), try fetching again — the trigger might have created it
    await new Promise((r) => setTimeout(r, 500));
    profile = await fetchUserProfile(authUser.id);
    return profile;
  }

  // Fetch the newly created profile
  profile = await fetchUserProfile(authUser.id);
  return profile;
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
