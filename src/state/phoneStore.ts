// Everything DidRead keeps on the phone for a user, besides the Supabase session: the open-text
// answer waiting to be sent, the week whose recap was dismissed, and the outbox of saves waiting
// for a signal (src/state/outbox.ts), Relaxed mode (batch 13), and today's revealed Word of the Day
// (batch 15). Sign out and delete account
// clear all of it (decision (d)).
// Every read and write is wrapped: if storage isn't available, the app still works.

export const phoneKeys = {
  pendingAnswer: (userId: string | null) => `didread.pendingAnswer.${userId ?? 'none'}`,
  recapDismissed: (userId: string | null) => `didread.recapDismissed.${userId ?? 'none'}`,
  outbox: (userId: string | null) => `didread.outbox.${userId ?? 'none'}`,
  relaxedMode: (userId: string | null) => `didread.relaxedMode.${userId ?? 'none'}`,
  wordRevealed: (userId: string | null) => `didread.wordRevealed.${userId ?? 'none'}`,
};

export function readJson<T>(key: string): T | null {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : null;
  } catch {
    return null;
  }
}

/** Saves a value, or removes it when null. */
export function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not kept across restarts; still kept in memory.
  }
}

/** Sign out and delete account: forget everything kept on the phone for this user. */
export function clearPhoneData(userId: string | null) {
  for (const key of Object.values(phoneKeys)) writeJson(key(userId), null);
}
