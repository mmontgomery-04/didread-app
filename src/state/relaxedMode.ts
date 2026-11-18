// Relaxed mode (batch 13): a switch in Settings that removes every game timer (Word Sprint's).
// Kept on the phone for each user, like the other phone settings; sign out clears it.
import { phoneKeys, readJson, writeJson } from './phoneStore';

export function readRelaxedMode(userId: string | null): boolean {
  return readJson<boolean>(phoneKeys.relaxedMode(userId)) === true;
}

export function writeRelaxedMode(userId: string | null, on: boolean) {
  writeJson(phoneKeys.relaxedMode(userId), on ? true : null);
}
