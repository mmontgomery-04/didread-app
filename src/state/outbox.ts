// Saves that didn't reach the database yet (batch 10): code-scored attempts, free-writes and
// analytics events made with no signal or during a server hiccup. They wait on the phone (so closing the app doesn't
// lose them) and are sent when the signal returns. Open-text answers have their own pending slot
// in the session, because they also need the AI's reply.
import { supabase } from '@/lib/supabase';

import { phoneKeys, readJson, writeJson } from './phoneStore';

export interface OutboxItem {
  table: 'attempts' | 'free_writes' | 'events';
  row: Record<string, unknown>;
}

const read = (userId: string) => readJson<OutboxItem[]>(phoneKeys.outbox(userId)) ?? [];
const write = (userId: string, items: OutboxItem[]) => writeJson(phoneKeys.outbox(userId), items.length ? items : null);

/** Saves one row now; if that fails, keeps it in the outbox for later. */
export async function saveOrQueue(userId: string, item: OutboxItem): Promise<void> {
  const { error } = await supabase.from(item.table).insert(item.row);
  if (error) write(userId, [...read(userId), item]);
}

/** Sends everything waiting, oldest first. What still fails stays for next time. */
export async function flushOutbox(userId: string): Promise<void> {
  const items = read(userId);
  if (items.length === 0) return;
  const left: OutboxItem[] = [];
  for (const item of items) {
    const { error } = await supabase.from(item.table).insert(item.row);
    if (error) left.push(item);
  }
  write(userId, left);
}
