// Who's signed in, and their profile (batch 5a). Sign-in itself happens elsewhere: Sign in with
// Apple (batch 5b, src/lib/appleSignIn.ts) and the development-only test sign-in
// (src/components/DevSignIn.tsx). Both end in a Supabase session, which this provider follows. The first time a user signs in,
// their `profiles` row is created (SPEC section 9, batch 5).
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { appleCodeForDeletion } from '@/lib/appleSignIn';
import { supabase } from '@/lib/supabase';
import { cancelReminders } from '@/notifications/reminders';
import { clearPhoneData } from '@/state/phoneStore';

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface Profile {
  user_id: string;
  time_zone: string;
  reminder_time: string | null;
  onboarding_done: boolean;
  /** Word of the Day (batch 15): the day this person first saw the card. Null until then. */
  words_started_on?: string | null;
  /** Batch 17: practice days a week the person aims for (2, 3, 5 or 7). Missing before the migration. */
  weekly_goal?: number;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** Signed in; `profile` is null until it has loaded (or been created). */
  | { status: 'signedIn'; session: Session; profile: Profile | null };

/** Reads the user's profile, creating it on first sign-in. */
async function loadProfile(): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
  if (error) throw error;
  if (data) return data as Profile;
  const created = await supabase.from('profiles').insert({ time_zone: TIME_ZONE }).select('*').single();
  if (created.error) throw created.error;
  return created.data as Profile;
}

function useAuthState() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  /** Set after delete account, so Welcome can say so; cleared at the next sign-in. */
  const [accountDeleted, setAccountDeleted] = useState(false);

  // Follow the session: the saved one at launch, then every sign-in, sign-out and refresh.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setAccountDeleted(false);
      setState((prev) => {
        if (!session) return { status: 'signedOut' };
        // Same user (a token refresh): keep the profile already loaded.
        const keep = prev.status === 'signedIn' && prev.session.user.id === session.user.id ? prev.profile : null;
        return { status: 'signedIn', session, profile: keep };
      });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Load the profile once signed in. If it fails (no signal), try again when the app comes back.
  const userId = state.status === 'signedIn' ? state.session.user.id : null;
  const needsProfile = state.status === 'signedIn' && !state.profile;
  useEffect(() => {
    if (!userId || !needsProfile) return;
    let cancelled = false;
    const attempt = () =>
      loadProfile()
        .then((profile) => {
          if (cancelled) return;
          setState((prev) =>
            prev.status === 'signedIn' && prev.session.user.id === userId ? { ...prev, profile } : prev,
          );
        })
        .catch(() => {});
    attempt();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && attempt());
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [userId, needsProfile]);

  /**
   * Onboarding finished: remembered in the profile, so it shows only once. Batch 17: the weekly goal
   * picked on card 3 (3 after "Not now") is saved with it.
   */
  async function finishOnboarding(reminderTime: string | null, weeklyGoal: number) {
    if (state.status !== 'signedIn' || !state.profile) return;
    const change = { onboarding_done: true, weekly_goal: weeklyGoal, ...(reminderTime ? { reminder_time: reminderTime } : {}) };
    const { data, error } = await supabase
      .from('profiles')
      .update(change)
      .eq('user_id', state.session.user.id)
      .select('*')
      .single();
    if (error) throw error;
    setState((prev) => (prev.status === 'signedIn' ? { ...prev, profile: data as Profile } : prev));
  }

  /**
   * Word of the Day (batch 15): remembers the first day this person saw the card, which starts their
   * own order through the words. If it can't be saved (no signal), it's tried again later.
   */
  async function startWords(localDate: string) {
    if (state.status !== 'signedIn' || !state.profile || state.profile.words_started_on) return;
    const { data, error } = await supabase
      .from('profiles')
      .update({ words_started_on: localDate })
      .eq('user_id', state.session.user.id)
      .select('*')
      .single();
    if (error) return;
    setState((prev) => (prev.status === 'signedIn' ? { ...prev, profile: data as Profile } : prev));
  }

  /**
   * Batch 17, Settings: changes the weekly goal. It applies right away (the strip updates at once);
   * if it can't be saved (no signal), it goes back to the saved goal.
   */
  async function setWeeklyGoal(goal: number) {
    if (state.status !== 'signedIn' || !state.profile) return;
    const before = state.profile.weekly_goal;
    const apply = (value: number | undefined) =>
      setState((prev) => (prev.status === 'signedIn' && prev.profile ? { ...prev, profile: { ...prev.profile, weekly_goal: value } } : prev));
    apply(goal);
    const { error } = await supabase.from('profiles').update({ weekly_goal: goal }).eq('user_id', state.session.user.id);
    if (error) apply(before);
  }

  /** Sign out (batch 11b): cancels the reminders and clears what's kept on the phone (decision (d)). */
  async function signOut() {
    await cancelReminders().catch(() => {});
    clearPhoneData(userId);
    await supabase.auth.signOut();
  }

  /**
   * Delete account (batch 11b): the delete-account function deletes the caller's own account and,
   * with it, all their rows. Then the same clean-up as signing out. An Apple account first goes
   * through Apple's sheet for a one-time code, so DidRead's access to the Apple ID is revoked too
   * (batch 12's Apple token cleanup); closing the sheet deletes nothing ('cancelled').
   */
  async function deleteAccount(): Promise<'deleted' | 'cancelled' | 'failed'> {
    const isApple = state.status === 'signedIn' && state.session.user.identities?.some((i) => i.provider === 'apple');
    const appleCode = isApple ? await appleCodeForDeletion() : null;
    if (appleCode === 'cancelled') return 'cancelled';
    const { error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
      body: appleCode ? { apple_code: appleCode } : {},
    });
    if (error) return 'failed';
    await cancelReminders().catch(() => {});
    clearPhoneData(userId);
    setAccountDeleted(true);
    await supabase.auth.signOut({ scope: 'local' });
    return 'deleted';
  }

  return {
    state,
    userId,
    accountDeleted,
    finishOnboarding,
    startWords,
    setWeeklyGoal,
    signOut,
    deleteAccount,
  };
}

type Auth = ReturnType<typeof useAuthState>;

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}
