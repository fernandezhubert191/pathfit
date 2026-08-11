import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Auto-refresh hook — calls `onRefresh` in two situations:
 *
 * 1. The app returns to the foreground (user switches back from another app).
 * 2. A polling interval fires (default: every 30 seconds while the app is active).
 *
 * Pass `enabled = false` to pause polling (e.g. while a form is open).
 */
export function useAutoRefresh(
  onRefresh: () => void | Promise<void>,
  {
    intervalMs = 30_000,
    enabled = true,
  }: {
    intervalMs?: number;
    enabled?: boolean;
  } = {},
) {
  const appState   = useRef<AppStateStatus>(AppState.currentState);
  const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // ── Foreground listener ───────────────────────────────────────────────
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        // App just came back to foreground — refresh immediately.
        void onRefresh();
      }
      appState.current = nextState;
    });

    // ── Polling interval ──────────────────────────────────────────────────
    intervalId.current = setInterval(() => {
      if (AppState.currentState === 'active') {
        void onRefresh();
      }
    }, intervalMs);

    return () => {
      subscription.remove();
      if (intervalId.current !== null) clearInterval(intervalId.current);
    };
  }, [onRefresh, intervalMs, enabled]);
}
