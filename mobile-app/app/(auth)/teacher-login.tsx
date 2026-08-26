import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

import { API } from '@/lib/api';
import { saveAuth } from '@/lib/auth';
import LoadingOverlay from '@/components/LoadingOverlay';
import { fetchWithTimeout } from '@/lib/request';

// ── Dashboard-matched light green palette (Teacher) ──────────
const C = {
  bg: '#f0fdf4',
  accent: '#2e7d32',
  accentMid: '#388e3c',
  accentLight: '#4caf50',
  accentBorder: '#c5e1a5',
  cardBg: '#ffffff',
  cardBorder: '#c5e1a5',
  inputBg: '#f9fbe7',
  inputBorder: '#c5e1a5',
  inputFocus: '#2e7d32',
  inputFocusBg: '#f1f8e9',
  text: '#1a1a1a',
  textLabel: '#2e7d32',
  textMuted: '#78909c',
  divider: '#c5e1a5',
};

export default function TeacherLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Logo animation
  const logoScale   = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoFloat   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, { toValue: -7, duration: 1800, useNativeDriver: true }),
        Animated.timing(logoFloat, { toValue: 0,  duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

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
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
            activeOpacity={0.75}
          >
            <View style={s.backInner}>
              <Ionicons name="chevron-back" size={18} color="#2e7d32" />
              <Text style={s.backText}>Back</Text>
            </View>
          </TouchableOpacity>

          {/* Header */}
          <View style={s.header}>
            <Animated.View style={[s.logoRing, {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }, { translateY: logoFloat }],
            }]}>
              <Image source={require('@/assets/logo.png')} style={s.logo} resizeMode="contain" />
            </Animated.View>
            <Text style={s.appName}>PathFit</Text>
            <View style={s.rolePill}>
              <Text style={s.rolePillEmoji}>👩‍🏫</Text>
              <Text style={s.rolePillText}>Teacher Portal</Text>
            </View>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Welcome back! 👋</Text>
            <Text style={s.cardSub}>Sign in to manage your classes & students</Text>

            {/* Email */}
            <View style={s.field}>
              <Text style={s.label}>✉️  Email Address</Text>
              <TextInput
                style={[s.input, focusedField === 'email' && s.inputFocused]}
                placeholder="your@email.com"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {/* Password */}
            <View style={s.field}>
              <Text style={s.label}>🔒  Password</Text>
              <View style={s.pwRow}>
                <TextInput
                  style={[s.input, s.pwInput, focusedField === 'pw' && s.inputFocused]}
                  placeholder="Your password"
                  placeholderTextColor={C.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('pw')}
                  onBlur={() => setFocusedField(null)}
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
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign In */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}
              style={s.submitWrapper}
            >
              <LinearGradient
                colors={loading ? ['#9e9e9e', '#9e9e9e'] : ['#1b5e20', '#2e7d32', '#33691e']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.submitBtn, loading && s.disabled]}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitText}>Sign In  →</Text>}
              </LinearGradient>
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
                <Text style={s.footerLink}>Register here</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0fdf4' },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 48 },

  /* Header */
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingTop: 4,
  },
  backInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#c5e1a5',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...Platform.select({
      ios: { shadowColor: '#2e7d32', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
    }),
    elevation: 2,
  },
  backText: { fontSize: 14, color: '#2e7d32', fontWeight: '700' },
  logoRing: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: '#f1f8e9',
    borderWidth: 2, borderColor: '#c5e1a5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#2e7d32', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 14 },
    }),
    elevation: 6,
  },
  logo: { width: 62, height: 62 },
  appName: { fontSize: 28, fontWeight: '800', color: '#2e7d32', letterSpacing: 0.6, marginBottom: 12 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#f1f8e9', borderWidth: 1.5, borderColor: '#c5e1a5',
    borderRadius: 100, paddingHorizontal: 18, paddingVertical: 7,
  },
  rolePillEmoji: { fontSize: 14 },
  rolePillText: { fontSize: 13, fontWeight: '700', color: '#2e7d32' },

  /* Card */
  card: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#c5e1a5',
    padding: 24,
    ...Platform.select({
      ios: { shadowColor: '#2e7d32', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16 },
    }),
    elevation: 4,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 5 },
  cardSub: { fontSize: 13, color: '#78909c', marginBottom: 24, lineHeight: 19 },

  /* Fields */
  field: { marginBottom: 16 },
  label: {
    fontSize: 11, fontWeight: '700', color: '#2e7d32',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.9,
  },
  input: {
    height: 52, backgroundColor: '#f9fbe7',
    borderWidth: 1.5, borderColor: '#c5e1a5',
    borderRadius: 14, paddingHorizontal: 16,
    fontSize: 15, color: '#1a1a1a',
  },
  inputFocused: { borderColor: '#2e7d32', backgroundColor: '#f1f8e9' },
  pwRow: { position: 'relative' },
  pwInput: { paddingRight: 54 },
  eyeBtn: { position: 'absolute', right: 14, top: 12 },
  eyeText: { fontSize: 22 },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: 22, marginTop: -4 },
  forgotText: { fontSize: 13, fontWeight: '600', color: '#2e7d32' },

  submitWrapper: { borderRadius: 14, overflow: 'hidden' },
  submitBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  /* Divider */
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#c5e1a5' },
  dividerText: { fontSize: 12, color: '#a5d6a7' },

  /* Footer */
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerHint: { fontSize: 13, color: '#78909c' },
  footerLink: { fontSize: 13, fontWeight: '700', color: '#2e7d32' },
});
