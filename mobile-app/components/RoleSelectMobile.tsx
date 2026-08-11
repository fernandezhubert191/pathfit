import { useRouter } from 'expo-router';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RoleSelectMobile() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Brand header ── */}
        <View style={s.header}>
          <View style={s.logoRing}>
            <Image
              source={require('../assets/logo.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={s.appName}>PathFit</Text>
          <Text style={s.appSub}>Physical Education Portal</Text>
        </View>

        {/* ── Card ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Welcome!</Text>
          <Text style={s.cardSub}>Choose your role to continue</Text>

          {/* Student */}
          <TouchableOpacity
            style={[s.roleBtn, s.roleBtnStudent]}
            activeOpacity={0.82}
            onPress={() => router.push('/(auth)/student-login')}
          >
            <View style={[s.iconWrap, { backgroundColor: '#dbeafe' }]}>
              <Text style={s.icon}>🎓</Text>
            </View>
            <View style={s.roleInfo}>
              <Text style={s.roleTitle}>I'm a Student</Text>
              <Text style={s.roleDesc}>Modules, quizzes & results</Text>
            </View>
            <View style={[s.arrowWrap, { backgroundColor: '#eff6ff' }]}>
              <Text style={[s.arrow, { color: '#1c7ed6' }]}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Teacher */}
          <TouchableOpacity
            style={[s.roleBtn, s.roleBtnTeacher]}
            activeOpacity={0.82}
            onPress={() => router.push('/(auth)/teacher-login')}
          >
            <View style={[s.iconWrap, { backgroundColor: '#d1fae5' }]}>
              <Text style={s.icon}>👩‍🏫</Text>
            </View>
            <View style={s.roleInfo}>
              <Text style={s.roleTitle}>I'm a Teacher</Text>
              <Text style={s.roleDesc}>Classes, students & grades</Text>
            </View>
            <View style={[s.arrowWrap, { backgroundColor: '#ecfdf5' }]}>
              <Text style={[s.arrow, { color: '#0ca678' }]}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>New here?</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Register row */}
          <View style={s.registerRow}>
            <TouchableOpacity
              style={[s.registerBtn, s.registerBtnStudent]}
              activeOpacity={0.82}
              onPress={() => router.push('/(auth)/student-register')}
            >
              <Text style={[s.registerBtnText, { color: '#1c7ed6' }]}>Student Sign Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.registerBtn, s.registerBtnTeacher]}
              activeOpacity={0.82}
              onPress={() => router.push('/(auth)/teacher-register')}
            >
              <Text style={[s.registerBtnText, { color: '#0ca678' }]}>Teacher Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.footer}>Admin access via web portal only</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  /* Brand header */
  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 32,
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  logo: { width: 68, height: 68 },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  appSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    letterSpacing: 0.3,
  },

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
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 20,
  },

  /* Role buttons */
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1.5,
  },
  roleBtnStudent: { backgroundColor: '#f0f7ff', borderColor: '#bfdbfe' },
  roleBtnTeacher: { backgroundColor: '#f0fdf8', borderColor: '#a7f3d0' },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 24 },
  roleInfo: { flex: 1 },
  roleTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  roleDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  arrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { fontSize: 20, fontWeight: '700', lineHeight: 22 },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  /* Register row */
  registerRow: { flexDirection: 'row', gap: 10 },
  registerBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerBtnStudent: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  registerBtnTeacher: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  registerBtnText: { fontSize: 13, fontWeight: '700' },

  /* Footer */
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 28,
  },
});
