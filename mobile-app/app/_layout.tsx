import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { getToken, getUser } from '@/lib/auth';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Wait until the navigator is fully mounted before any navigation
    if (!navState?.key) return;

    (async () => {
      const [user, token] = await Promise.all([getUser(), getToken()]);
      const inApp  = segments[0] === '(app)';
      const inAuth = segments[0] === '(auth)';

      if (!user || !token) {
        // No session — send to role select if trying to access a protected screen
        if (inApp) router.replace('/');
      } else {
        // Has session — redirect away from auth/role screens to the right dashboard
        if (!inApp) {
          router.replace(
            user.role === 'teacher'
              ? '/(app)/teacher-dashboard'
              : '/(app)/student-dashboard',
          );
        }
      }
      setAuthChecked(true);
    })();
  }, [navState?.key, segments[0]]);

  // Don't render children until we've verified auth — prevents flash of wrong screen
  if (!authChecked && !navState?.key) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthGuard>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </AuthGuard>
  );
}
