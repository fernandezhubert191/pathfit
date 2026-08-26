import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// ── Dashboard-matched light green palette ────────────────────
const C = {
  bg: '#e8f5e9',
  bg2: '#f0fdf4',
  accent: '#1b5e20',
  accentMid: '#2e7d32',
  accentLight: '#4caf50',
  accentBorder: '#a5d6a7',
  accentDim: '#e8f5e9',
  cardBg: '#ffffff',
  cardBorder: '#c8e6c9',
  text: '#1b5e20',
  textDark: '#0d3b12',
  textMuted: '#558b2f',
  textFaint: '#a5d6a7',
  divider: '#c8e6c9',
  badgeBg: '#e8f5e9',
  badgeBorder: '#a5d6a7',
};

export default function RoleSelectMobile() {
  const router = useRouter();

  // Logo: bounce in on mount
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  // Logo: gentle float loop
  const logoFloat = useRef(new Animated.Value(0)).current;
  // Card icons: pulse loop
  const studentPulse = useRef(new Animated.Value(1)).current;
  const teacherPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Bounce in
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Float loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, { toValue: -8, duration: 1800, useNativeDriver: true }),
        Animated.timing(logoFloat, { toValue: 0,  duration: 1800, useNativeDriver: true }),
      ])
    ).start();

    // Staggered pulse for card icons
    const pulseOne = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1,    duration: 600, useNativeDriver: true }),
          Animated.delay(2200),
        ])
      ).start();

    pulseOne(studentPulse, 800);
    pulseOne(teacherPulse, 1600);
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      {/* Body */}
      <View style={s.body}>

        {/* Header */}
        <View style={s.header}>
          <Animated.View style={[s.logoRing, {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }, { translateY: logoFloat }],
          }]}>
            <Image
              source={require('../assets/logo.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </Animated.View>
          <Text style={s.appName}>PathFit</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>👋  Welcome — choose your role</Text>
          </View>
        </View>

        {/* ── Role cards ── */}
        <View style={s.cardsContainer}>

          {/* Student card */}
          <TouchableOpacity
            style={s.card}
            activeOpacity={0.86}
            onPress={() => router.push('/(auth)/student-login')}
          >
            <View style={s.cardContent}>
              <Animated.View style={[s.cardIconWrap, { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7' },
                { transform: [{ scale: studentPulse }] }]}>
                <Text style={s.cardIcon}>🎓</Text>
              </Animated.View>
              <View style={s.cardText}>
                <Text style={[s.cardTitle, { color: '#1b5e20' }]}>I'm a Student</Text>
                <Text style={s.cardDesc}>Modules · Quizzes · Progress</Text>
              </View>
              <View style={[s.arrowCircle, { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7' }]}>
                <Text style={[s.arrowText, { color: '#1b5e20' }]}>›</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Teacher card */}
          <TouchableOpacity
            style={s.card}
            activeOpacity={0.86}
            onPress={() => router.push('/(auth)/teacher-login')}
          >
            <View style={s.cardContent}>
              <Animated.View style={[s.cardIconWrap, { backgroundColor: '#f1f8e9', borderColor: '#c5e1a5' },
                { transform: [{ scale: teacherPulse }] }]}>
                <Text style={s.cardIcon}>👩‍🏫</Text>
              </Animated.View>
              <View style={s.cardText}>
                <Text style={[s.cardTitle, { color: '#2e7d32' }]}>I'm a Teacher</Text>
                <Text style={s.cardDesc}>Classes · Students · Grades</Text>
              </View>
              <View style={[s.arrowCircle, { backgroundColor: '#f1f8e9', borderColor: '#c5e1a5' }]}>
                <Text style={[s.arrowText, { color: '#2e7d32' }]}>›</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Sign-up section ── */}
        <View style={s.signupSection}>
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>New here?</Text>
            <View style={s.dividerLine} />
          </View>

          <View style={s.registerRow}>
            <TouchableOpacity
              style={[s.registerBtn, { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7' }]}
              activeOpacity={0.82}
              onPress={() => router.push('/(auth)/student-register')}
            >
              <Text style={[s.registerBtnText, { color: '#1b5e20' }]}>🎓  Student Sign Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.registerBtn, { backgroundColor: '#f1f8e9', borderColor: '#c5e1a5' }]}
              activeOpacity={0.82}
              onPress={() => router.push('/(auth)/teacher-register')}
            >
              <Text style={[s.registerBtnText, { color: '#2e7d32' }]}>👩‍🏫  Teacher Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>


      </View>
    </SafeAreaView>
  );
}

const CARD_WIDTH = width - 48;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#e8f5e9' },

  /* Header */
  header: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#e8f5e9',
    borderWidth: 2,
    borderColor: '#a5d6a7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#1b5e20',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 14,
      },
    }),
    elevation: 6,
  },
  logo: { width: 66, height: 66 },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1b5e20',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  badge: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1.5,
    borderColor: '#a5d6a7',
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  badgeText: {
    color: '#2e7d32',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* Body */
  body: { flex: 1, paddingHorizontal: 24 },

  /* ── Role cards ── */
  cardsContainer: { gap: 14 },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#c8e6c9',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#1b5e20',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
    }),
    elevation: 4,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  cardIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  cardIcon: { fontSize: 28 },
  cardText: { flex: 1 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12,
    color: '#78909c',
    letterSpacing: 0.2,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  arrowText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },

  /* ── Sign-up section ── */
  signupSection: { marginTop: 28 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#c8e6c9' },
  dividerText: {
    fontSize: 12,
    color: '#81c784',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  registerRow: { flexDirection: 'row', gap: 10 },
  registerBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

});
