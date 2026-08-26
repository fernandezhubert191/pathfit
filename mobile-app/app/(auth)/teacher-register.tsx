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
  noticeBg: '#e8f5e9',
  noticeBorder: '#a5d6a7',
  text: '#1a1a1a',
  textLabel: '#2e7d32',
  textMuted: '#78909c',
  divider: '#c5e1a5',
};

export default function TeacherRegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !employeeId.trim()) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithTimeout(`${API}/register/teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          employee_id: employeeId.trim(),
          email: email.trim(),
          password,
          password_confirmation: confirmPassword,
        }),
      });
      const data = await res.json();
      if (res.ok || res.status === 201) {
        Alert.alert(
          'Account submitted!',
          'Your account is pending approval by the administrator.',
          [{ text: 'Sign in', onPress: () => router.replace('/(auth)/teacher-login') }],
        );
      } else {
        let msg = 'Registration failed.';
        if (data.errors) {
          msg = (Object.entries(data.errors) as [string, string[]][])
            .map(([field, msgs]) => `• ${field}: ${msgs[0]}`)
            .join('\n');
        } else if (data.message) {
          msg = data.message;
        }
        Alert.alert('Registration failed', msg);
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Cannot connect to server.';
      const hint = msg.toLowerCase().includes('timeout')
        ? 'Request timed out. Make sure your phone and PC are on the same WiFi and the Laravel server is running.'
        : msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')
          ? 'Network error. Check that your phone and PC are on the same WiFi and that http traffic is allowed.'
          : msg;
      Alert.alert('Connection error', hint);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <LoadingOverlay visible={loading} message="Creating account…" />
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
              <Text style={s.rolePillText}>Teacher Registration</Text>
            </View>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Create Account ✨</Text>
            <Text style={s.cardSub}>Fill in your details to get started</Text>

            {/* Full name */}
            <View style={s.field}>
              <Text style={s.label}>👤  Full Name</Text>
              <TextInput
                style={[s.input, focusedField === 'name' && s.inputFocused]}
                placeholder="Maria Santos"
                placeholderTextColor={C.textMuted}
                value={name}
                onChangeText={setName}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>

            {/* Employee ID */}
            <View style={s.field}>
              <Text style={s.label}>🪪  Employee ID</Text>
              <TextInput
                style={[s.input, focusedField === 'eid' && s.inputFocused]}
                placeholder="e.g. TCH-2024-0010"
                placeholderTextColor={C.textMuted}
                value={employeeId}
                onChangeText={setEmployeeId}
                onFocus={() => setFocusedField('eid')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="characters"
              />
            </View>

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
                  placeholder="Create a password"
                  placeholderTextColor={C.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('pw')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                  <Text style={s.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm password */}
            <View style={s.field}>
              <Text style={s.label}>🔐  Confirm Password</Text>
              <View style={s.pwRow}>
                <TextInput
                  style={[s.input, s.pwInput, focusedField === 'cpw' && s.inputFocused]}
                  placeholder="Repeat your password"
                  placeholderTextColor={C.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocusedField('cpw')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
                  <Text style={s.eyeText}>{showConfirm ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Approval notice */}
            <View style={s.noticeBox}>
              <Text style={s.noticeIcon}>ℹ️</Text>
              <Text style={s.noticeText}>
                Your account will be reviewed and activated by an administrator before you can sign in.
              </Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleRegister}
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
                  : <Text style={s.submitText}>Create Account  →</Text>}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Login */}
            <View style={s.footerRow}>
              <Text style={s.footerHint}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/teacher-login')}>
                <Text style={s.footerLink}>Sign in</Text>
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

  /* Notice */
  noticeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#e8f5e9', borderRadius: 14,
    padding: 14, borderWidth: 1.5, borderColor: '#a5d6a7',
    marginBottom: 20,
  },
  noticeIcon: { fontSize: 16, marginTop: 1 },
  noticeText: { flex: 1, fontSize: 13, color: '#2e7d32', lineHeight: 20 },

  submitWrapper: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
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
