// The app's Supabase client (batch 5a). Uses only the project URL and the publishable key, which
// are safe in the app (only the secret key isn't); they come from EXPO_PUBLIC_ lines in .env. The
// session is kept on the phone, so you stay signed in between launches, and the token refresh
// runs only while the app is open (Expo's Supabase guide).
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import './localStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !publishableKey) {
  throw new Error('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env, then restart npm start.');
}

// The web preview first renders on a server, where there is no localStorage (and no session).
const storage = typeof localStorage === 'undefined' ? undefined : localStorage;

export const supabase = createClient(url, publishableKey, {
  auth: { storage, autoRefreshToken: true, persistSession: storage !== undefined, detectSessionInUrl: false },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
