// Online or not (batch 10), from expo-network. "Offline" only when the phone says so for sure:
// an unknown state counts as online, so a slow check never blocks sending.
import { useNetworkState } from 'expo-network';

export function useOnline(): boolean {
  const state = useNetworkState();
  return state.isConnected !== false && state.isInternetReachable !== false;
}
