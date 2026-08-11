import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';

const LARAVEL_LOGIN = 'http://localhost:8000/login';

/**
 * On web, immediately redirect to the Laravel admin login portal.
 * No need to duplicate the login form — the real admin panel lives there.
 */
export default function AdminLoginWeb() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.replace(LARAVEL_LOGIN);
    }
  }, []);

  return (
    <View style={styles.page}>
      <ActivityIndicator size="large" color="#4f46e5" />
      <Text style={styles.text}>Redirecting to admin portal…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    gap: 16,
  },
  text: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 12,
  },
});
