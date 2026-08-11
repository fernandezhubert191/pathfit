import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API } from '@/lib/api';
import { saveAuth } from '@/lib/auth';
import LoadingOverlay from '@/components/LoadingOverlay';
import { fetchWithTimeout } from '@/lib/request';

export default function TeacherLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithTimeout(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ role: 'teacher', identifier: email.trim(), password }),
      });
      const data = await res.json();
      if (res.ok) {
        await saveAuth(data.token, data.user);
        router.replace('/(app)/teacher-dashboard');
      } else {
        // Laravel validation errors come back as data.errors (422),
        // other errors use data.message
        const msg =
          data.message ??
          (data.errors ? Object.values(data.errors as Record<string, string[]>).flat().join('\n') : null) ??
          'Invalid credentials.';
        Alert.alert('Login failed', msg);
      }
    } catch (err: any) {
      Alert.alert('Connection error', err?.message ?? 'Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <LoadingOverlay visible={loading} message="Signing in…" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>‹ Back</Text>
          </TouchableOpacity>

          {/* Brand header */}
          <View style={s.header}>
            <View style={s.logoRing}>
              <Image source={require('@/assets/logo.png')} style={s.logo} resizeMode="contain" />
            </View>
            <Text style={s.appName}>PathFit</Text>
            <Text style={s.appSub}>Physical Education Portal</Text>
            {/* Role pill */}
            <View style={[s.rolePill, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
              <Text style={s.rolePillEmoji}>👩‍🏫</Text>
              <Text style={[s.rolePillText, { color: '#0ca678' }]}>Teacher Login</Text>
            </View>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Welcome back!</Text>
            <Text style={s.cardSub}>Sign in to manage your classes & students</Text>

            {/* Email */}
            <View style={s.field}>
              <Text style={s.label}>Email Address</Text>
              <TextInput
                style={s.input}
                placeholder="your@email.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {/* Password */}
            <View style={s.field}>
              <Text style={s.label}>Password</Text>
              <View style={s.pwRow}>
                <TextInput
                  style={[s.input, s.pwInput]}
                  placeholder="Your password"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                  <Text style={s.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot */}
            <TouchableOpacity style={s.forgotBtn}>
              <Text style={[s.forgotText, { color: '#0ca678' }]}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign In */}
            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: '#0ca678' }, loading && s.disabled]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>Sign In</Text>}
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Register */}
            <View style={s.footerRow}>
              <Text style={s.footerHint}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/teacher-register')}>
                <Text style={[s.footerLink, { color: '#0ca678' }]}>Register here</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  backBtn: { paddingTop: 14, paddingBottom: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 15, color: '#64748b', fontWeight: '500' },

  /* Brand header */
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 28 },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 14,
  },
  logo: { width: 62, height: 62 },
  appName: { fontSize: 26, fontWeight: '800', color: '#0f172a', letterSpacing: 0.4 },
  appSub: { fontSize: 12, color: '#94a3b8', marginTop: 3, letterSpacing: 0.3 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 14,
  },
  rolePillEmoji: { fontSize: 14 },
  rolePillText: { fontSize: 13, fontWeight: '700' },

  /* Card */
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#94a3b8', marginBottom: 22 },

  /* Fields */
  field: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    height: 52,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#0f172a',
  },
  pwRow: { position: 'relative' },
  pwInput: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: 14, top: 14 },
  eyeText: { fontSize: 20 },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, fontWeight: '600' },

  submitBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  disabled: { opacity: 0.65 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  /* Divider */
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 12, color: '#94a3b8' },

  /* Footer */
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerHint: { fontSize: 13, color: '#94a3b8' },
  footerLink: { fontSize: 13, fontWeight: '700' },
});
