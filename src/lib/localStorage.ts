// On the phone, gives the app a `localStorage` backed by SQLite, so Supabase can keep the
// signed-in session between launches (Expo's Supabase guide). The web preview has its own.
import 'expo-sqlite/localStorage/install';
