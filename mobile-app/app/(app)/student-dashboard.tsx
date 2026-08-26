import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { API } from '@/lib/api';
import { getAvatar, saveAvatar } from '@/lib/avatar';
import { clearAuth, getToken, getUser, type AuthUser } from '@/lib/auth';
import { isOnline } from '@/lib/offline';
import { saveModuleList, loadModuleList } from '@/lib/module-cache';
import { precacheAllModules } from '@/lib/background-cache';
import { syncProgressFromServer, type QuizScore } from '@/lib/progress';
import { fetchWithTimeout } from '@/lib/request';
import { flushQueue } from '@/lib/sync-queue';
import { flushUploadQueue } from '@/lib/upload-queue';
import { useAutoRefresh } from '@/lib/use-auto-refresh';

/* ── Types ─────────────────────────────────────────── */
type Module = {
  id: number;
  title: string;
  course: string;
  description: string | null;
  cover_url: string | null;
};

type TabKey = 'home' | 'modules' | 'progress' | 'profile';

/* ── Course config ──────────────────────────────────── */
const COURSES = {
  pathfit1: {
    key: 'pathfit1',
    label: 'Pathfit 1',
    sub: 'Movement Enhancement',
    emoji: '🏃',
    color: '#1b5e20',
    light: '#e8f5e9',
    border: '#a5d6a7',
    gradient: ['#1b5e20', '#1e88e5'],
    cover: require('@/assets/pathfit1.png'),
  },
  pathfit2: {
    key: 'pathfit2',
    label: 'Pathfit 2',
    sub: 'Mobility Training',
    emoji: '🧘',
    color: '#2e7d32',
    light: '#f1f8e9',
    border: '#c5e1a5',
    gradient: ['#2e7d32', '#0288d1'],
    cover: require('@/assets/pathfit2.png'),
  },
} as const;
type CourseKey = keyof typeof COURSES;

/* ══════════════════════════════════════════════════════
   Root Screen
══════════════════════════════════════════════════════ */
export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser]             = useState<AuthUser | null>(null);
  const [modules, setModules]       = useState<Module[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab]   = useState<TabKey>('home');
  const [activeCourse, setActiveCourse] = useState<CourseKey | null>(null);
  const [viewed, setViewed]         = useState<Set<number>>(new Set());
  const [scores, setScores]         = useState<QuizScore[]>([]);
  const [avatarUri, setAvatarUri]   = useState<string | null>(null);

  const loadProgress = useCallback(async () => {
    const u = await getUser();
    if (!u) return;
    const online = await isOnline();
    if (online) {
      await flushQueue(u.id);
      await flushUploadQueue(); // sync any queued exercise video uploads
    }
    const [{ viewed: v, scores: s }, av] = await Promise.all([
      syncProgressFromServer(u.id),
      getAvatar(u.id),
    ]);
    setViewed(v);
    setScores(s);
    setAvatarUri(av);
  }, []);

  useFocusEffect(useCallback(() => { loadProgress(); }, [loadProgress]));

  const loadModules = async (token: string) => {
    try {
      const online = await isOnline();
      if (online) {
        const res = await fetchWithTimeout(`${API}/modules`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const list = (await res.json()).modules ?? [];
          setModules(list);
          await saveModuleList(list);
          precacheAllModules(list).catch(() => {});
          return;
        }
      }
      const cached = await loadModuleList();
      if (cached) setModules(cached);
    } catch {
      const cached = await loadModuleList();
      if (cached) setModules(cached);
    }
  };

  useEffect(() => {
    (async () => {
      const [u, t] = await Promise.all([getUser(), getToken()]);
      if (!u || !t) return;
      setUser(u);
      await loadModules(t);
      setLoading(false);
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const t = await getToken();
    if (t) await loadModules(t);
    setRefreshing(false);
  };

  const autoRefreshFn = useCallback(async () => {
    const t = await getToken();
    if (t) await loadModules(t);
  }, []);
  useAutoRefresh(autoRefreshFn, { enabled: !loading });

  const handleLogout = async () => {
    const t = await getToken();
    if (t) {
      try {
        await fetchWithTimeout(`${API}/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
        });
      } catch { /* ignore */ }
    }
    await clearAuth();
    router.replace('/');
  };

  const openCourse = (key: CourseKey) => {
    setActiveCourse(key);
    setActiveTab('modules');
  };

  if (loading) {
    return (
      <View style={g.loadScreen}>
        <StatusBar barStyle="dark-content" backgroundColor="#e8f5e9" />
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={g.loadText}>Loading your dashboard…</Text>
      </View>
    );
  }

  const pathfit1 = modules.filter(m => m.course === 'pathfit1');
  const pathfit2 = modules.filter(m => m.course === 'pathfit2');

  return (
    <SafeAreaView style={g.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#e8f5e9" />

      {/* ── Content area ── */}
      <View style={[g.body, { backgroundColor: '#e8f5e9' }]}>
        {activeTab === 'home' && (
          <HomeTab
            refreshing={refreshing}
            onRefresh={onRefresh}
            onOpenCourse={openCourse}
            onGoProfile={() => setActiveTab('profile')}
            pathfit1Count={pathfit1.length}
            pathfit2Count={pathfit2.length}
            pathfit1Viewed={pathfit1.filter(m => viewed.has(m.id)).length}
            pathfit2Viewed={pathfit2.filter(m => viewed.has(m.id)).length}
            pathfit1AllDone={pathfit1.length > 0 && pathfit1.every(m => viewed.has(m.id))}
            scores={scores}
            totalModules={modules.length}
            completedModules={viewed.size}
            user={user}
            avatarUri={avatarUri}
          />
        )}
        {activeTab === 'modules' && (
          <ModulesTab
            pathfit1={pathfit1}
            pathfit2={pathfit2}
            activeCourse={activeCourse}
            setActiveCourse={setActiveCourse}
            viewed={viewed}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onModulePress={mod => router.push({
              pathname: '/(app)/module-viewer',
              params: { id: String(mod.id), title: mod.title },
            })}
          />
        )}
        {activeTab === 'progress' && (
          <ProgressTab
            modules={modules}
            viewed={viewed}
            scores={scores}
            onLessonsPress={() => router.push('/(app)/progress-lessons')}
            onQuizzesPress={() => router.push('/(app)/progress-quizzes')}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            onLogout={handleLogout}
            avatarUri={avatarUri}
            onAvatarChange={async (uri) => {
              setAvatarUri(uri);
              const u = await getUser();
              if (u) await saveAvatar(u.id, uri);
            }}
          />
        )}
      </View>

      <BottomNav activeTab={activeTab} onSelect={setActiveTab} />
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════════════════
   Shared App Header
══════════════════════════════════════════════════════ */
function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <View style={g.header}>
      <View style={g.headerBrand} />
      {right}
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   Bottom Navigation
══════════════════════════════════════════════════════ */
type NavTab = {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const NAV_TABS: NavTab[] = [
  { key: 'home',     label: 'Home',     icon: 'home-outline',     iconActive: 'home' },
  { key: 'modules',  label: 'Modules',  icon: 'book-outline',     iconActive: 'book' },
  { key: 'progress', label: 'Progress', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { key: 'profile',  label: 'Profile',  icon: 'person-outline',   iconActive: 'person' },
];

function BottomNav({ activeTab, onSelect }: { activeTab: TabKey; onSelect: (k: TabKey) => void }) {
  return (
    <View style={g.navbar}>
      {NAV_TABS.map(tab => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={g.navItem}
            onPress={() => onSelect(tab.key)}
            activeOpacity={0.75}
          >
            <View style={[g.navIconWrap, active && g.navIconWrapActive]}>
              <Ionicons
                name={active ? tab.iconActive : tab.icon}
                size={22}
                color={active ? '#ffffff' : '#94a3b8'}
              />
            </View>
            <Text style={[g.navLabel, active && g.navLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── Greeting helper ── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getGreetingIcon(): string {
  const h = new Date().getHours();
  if (h < 12) return '🌞';   // morning — bright, cheerful sun
  if (h < 17) return '⛅';   // afternoon — sun with cloud
  return '🌃';               // evening — night city with stars
}

/* ── Animated wave greeting ── */
function WaveGreeting() {
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const wave = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1,  duration: 300, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: -1, duration: 300, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 1,  duration: 300, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: -1, duration: 300, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0,  duration: 200, useNativeDriver: true }),
        Animated.delay(3000),
      ]),
      { iterations: -1 }
    );
    wave.start();
    return () => wave.stop();
  }, [waveAnim]);

  const rotate = waveAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-20deg', '0deg', '20deg'],
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Text style={g.greetGreeting}>{getGreeting()}</Text>
      <Animated.Text
        style={[
          { fontSize: 18, transformOrigin: 'bottom right' },
          { transform: [{ rotate }] },
        ]}
      >
        {getGreetingIcon()}
      </Animated.Text>
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   Home Tab
══════════════════════════════════════════════════════ */
function HomeTab({
  refreshing, onRefresh, onOpenCourse, onGoProfile,
  pathfit1Count, pathfit2Count, pathfit1Viewed, pathfit2Viewed, pathfit1AllDone,
  scores, totalModules, completedModules, user, avatarUri,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  onOpenCourse: (key: CourseKey) => void;
  onGoProfile: () => void;
  pathfit1Count: number;
  pathfit2Count: number;
  pathfit1Viewed: number;
  pathfit2Viewed: number;
  pathfit1AllDone: boolean;
  scores: QuizScore[];
  totalModules: number;
  completedModules: number;
  user: AuthUser | null;
  avatarUri: string | null;
}) {
  const router = useRouter();
  const viewedCounts: Record<CourseKey, number> = { pathfit1: pathfit1Viewed, pathfit2: pathfit2Viewed };
  const totalCounts:  Record<CourseKey, number> = { pathfit1: pathfit1Count,  pathfit2: pathfit2Count };

  const initials   = user?.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
  const overallPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <View style={g.fill}>
      <ScrollView
        style={g.fillTransparent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1b5e20" />}
      >
      {/* ── Greeting header ── */}
      <TouchableOpacity style={g.greetHeader} onPress={onGoProfile} activeOpacity={0.88}>
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={g.greetAvatarImg} />
          : <Text style={g.greetAvatarTxt}>{initials}</Text>
        }
        <View style={g.greetInfo}>
          <WaveGreeting />
          <Text style={g.greetName} numberOfLines={1}>{user?.name ?? '—'}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Promo Banner Carousel ── */}
      <BannerCarousel />

      {/* ── Modules section ── */}
      <View style={g.sectionRow}>
        <Text style={g.sectionTitle}>Modules</Text>
      </View>
      <View style={g.courseStack}>
        {(Object.values(COURSES) as typeof COURSES[CourseKey][]).map(c => {
          const total    = totalCounts[c.key as CourseKey];
          const done     = viewedCounts[c.key as CourseKey];
          const pct      = total > 0 ? done / total : 0;
          const allDone  = total > 0 && done === total;
          const isLocked = c.key === 'pathfit2' && !pathfit1AllDone;

          return (
            <TouchableOpacity
              key={c.key}
              style={[g.coursePhotoCard, isLocked && g.coursePhotoCardLocked]}
              activeOpacity={isLocked ? 0.7 : 0.88}
              onPress={() => {
                if (isLocked) {
                  Alert.alert('Course Locked', 'Complete all Pathfit 1 modules first to unlock Pathfit 2.');
                } else {
                  onOpenCourse(c.key as CourseKey);
                }
              }}
            >
              {/* ── Photo area ── */}
              <View style={g.coursePhotoWrap}>
                <Image
                  source={c.cover}
                  style={[g.coursePhoto, isLocked && { opacity: 0.35 }]}
                  resizeMode="cover"
                />
                {isLocked && (
                  <View style={g.coursePhotoLockOverlay}>
                    <Text style={{ fontSize: 32 }}>🔒</Text>
                  </View>
                )}
              </View>

              {/* ── Details area ── */}
              <View style={g.coursePhotoBody}>
                <View style={g.courseNameRow}>
                  <Text style={[g.coursePhotoName, isLocked && { color: '#94a3b8' }]} numberOfLines={1}>
                    {c.label}
                  </Text>
                  <View style={[
                    g.courseInlineBadge,
                    {
                      backgroundColor: isLocked ? '#e2e8f0' : allDone ? '#e8f5e9' : c.light,
                      borderColor:     isLocked ? '#cbd5e1' : allDone ? '#a5d6a7' : c.color,
                    },
                  ]}>
                    <Text style={[
                      g.courseInlineBadgeText,
                      { color: isLocked ? '#94a3b8' : allDone ? '#1b5e20' : c.color },
                    ]}>
                      {isLocked ? 'Locked' : allDone ? 'Completed' : 'Available'}
                    </Text>
                  </View>
                </View>
                <Text style={[g.coursePhotoSub, isLocked && { color: '#94a3b8' }]} numberOfLines={1}>
                  {isLocked ? 'Finish Pathfit 1 to unlock' : c.sub}
                </Text>
                {!isLocked && (
                  <View style={g.homeProgressRow}>
                    <View style={g.homeProgressTrack}>
                      <View style={[g.homeProgressFill, { backgroundColor: c.color, width: `${pct * 100}%` as any }]} />
                    </View>
                    <Text style={[g.homeProgressLabel, { color: c.color }]}>{done}/{total}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── My Progress ── */}
      <View style={g.sectionRow}>
        <Text style={g.sectionTitle}>My Progress</Text>
      </View>
      <View style={g.progressRow}>

        {/* ── Lessons Done card ── */}
        {(() => {
          const lessonPct    = totalModules > 0 ? completedModules / totalModules : 0;
          const lessonAllDone = totalModules > 0 && completedModules === totalModules;
          const remaining    = totalModules - completedModules;
          return (
            <TouchableOpacity
              style={[g.progressCard, { borderColor: '#a5d6a7' }]}
              activeOpacity={0.82}
              onPress={() => router.push('/(app)/progress-lessons')}
            >
              {/* Top row */}
              <View style={g.pcTopRow}>
                <View style={[g.pcIconWrap, { backgroundColor: '#e8f5e9' }]}>
                  <Text style={g.pcIconEmoji}>📖</Text>
                </View>
                <View style={g.pcCountCol}>
                  <Text style={[g.pcBigCount, { color: '#1b5e20' }]}>
                    {completedModules}
                    <Text style={g.pcCountDenom}>/{totalModules}</Text>
                  </Text>
                  <Text style={[g.pcLabel, { color: '#1b5e20' }]}>Lessons Done</Text>
                </View>
                <View style={[g.pcStatusBadge, {
                  backgroundColor: lessonAllDone ? '#1b5e20' : '#e8f5e9',
                  borderColor:     lessonAllDone ? '#1b5e20' : '#a5d6a7',
                }]}>
                  <Text style={[g.pcStatusText, { color: lessonAllDone ? '#fff' : '#1b5e20' }]}>
                    {lessonAllDone ? '✓ All done' : `${Math.round(lessonPct * 100)}%`}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={g.pcBarTrack}>
                <View style={[g.pcBarFill, {
                  backgroundColor: '#1b5e20',
                  width: `${lessonPct * 100}%` as any,
                }]} />
              </View>

              {/* Bottom row */}
              <View style={g.pcBottomRow}>
                <Text style={g.pcSubLabel}>
                  {remaining > 0
                    ? `${remaining} lesson${remaining !== 1 ? 's' : ''} remaining`
                    : 'All lessons completed 🎉'}
                </Text>
                <Text style={g.pcViewAll}>View all ›</Text>
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* ── Quiz Done card ── */}
        {(() => {
          const uniqueModulesWithQuiz = new Set(scores.map(s => s.moduleId)).size;
          const passCount  = scores.filter(s => s.percent >= 75).length;
          const quizPct    = totalModules > 0 ? Math.min(uniqueModulesWithQuiz / totalModules, 1) : 0;
          const allPassed  = scores.length > 0 && passCount === scores.length;
          return (
            <TouchableOpacity
              style={[g.progressCard, { borderColor: '#c5e1a5' }]}
              activeOpacity={0.82}
              onPress={() => router.push('/(app)/progress-quizzes')}
            >
              {/* Top row */}
              <View style={g.pcTopRow}>
                <View style={[g.pcIconWrap, { backgroundColor: '#f1f8e9' }]}>
                  <Text style={g.pcIconEmoji}>🏆</Text>
                </View>
                <View style={g.pcCountCol}>
                  <Text style={[g.pcBigCount, { color: '#2e7d32' }]}>
                    {scores.length}
                    <Text style={g.pcCountDenom}> attempt{scores.length !== 1 ? 's' : ''}</Text>
                  </Text>
                  <Text style={[g.pcLabel, { color: '#2e7d32' }]}>Quiz Done</Text>
                </View>
                <View style={[g.pcStatusBadge, {
                  backgroundColor: allPassed ? '#2e7d32' : '#f1f8e9',
                  borderColor:     allPassed ? '#2e7d32' : '#c5e1a5',
                }]}>
                  <Text style={[g.pcStatusText, { color: allPassed ? '#fff' : '#2e7d32' }]}>
                    {scores.length === 0 ? 'No attempts' : `${passCount}/${scores.length} passed`}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={[g.pcBarTrack, { backgroundColor: '#f1f8e9' }]}>
                <View style={[g.pcBarFill, {
                  backgroundColor: '#2e7d32',
                  width: `${quizPct * 100}%` as any,
                }]} />
              </View>

              {/* Bottom row */}
              <View style={g.pcBottomRow}>
                <Text style={g.pcSubLabel}>
                  {scores.length === 0
                    ? 'No quizzes taken yet'
                    : `${uniqueModulesWithQuiz} module${uniqueModulesWithQuiz !== 1 ? 's' : ''} attempted`}
                </Text>
                <Text style={g.pcViewAll}>View all ›</Text>
              </View>
            </TouchableOpacity>
          );
        })()}

      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   Banner Carousel  (image-based: banner1, banner2, banner3)
══════════════════════════════════════════════════════ */
const BANNER_IMAGES = [
  require('@/assets/banner1.png'),
  require('@/assets/banner2.png'),
  require('@/assets/banner3.png'),
];

function BannerCarousel() {
  const { width } = useWindowDimensions();
  const CARD_W = width - 36; // 18px margin each side
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-advance
  useEffect(() => {
    const timer = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % BANNER_IMAGES.length;
        scrollRef.current?.scrollTo({ x: next * CARD_W, animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [CARD_W]);

  const goTo = (idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * CARD_W, animated: true });
    setActive(idx);
  };

  return (
    <View style={g.bannerWrap}>
      <View style={g.bannerShadow}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={CARD_W}
          bounces={false}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
            setActive(Math.max(0, Math.min(idx, BANNER_IMAGES.length - 1)));
          }}
          style={{ borderRadius: 20, overflow: 'hidden' }}
          contentContainerStyle={{ gap: 0 }}
        >
          {BANNER_IMAGES.map((src, i) => (
            <Image
              key={i}
              source={src}
              style={{ width: CARD_W, height: 160, borderRadius: 20 }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>

        {/* Dot indicator — floating over the banner */}
        <View style={g.bannerDotsOverlay}>
          {BANNER_IMAGES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goTo(i)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <View
                style={[
                  g.bannerDot,
                  i === active ? g.bannerDotActive : g.bannerDotInactive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   Modules Tab
══════════════════════════════════════════════════════ */
function ModulesTab({
  pathfit1, pathfit2, activeCourse, setActiveCourse,
  viewed, refreshing, onRefresh, onModulePress,
}: {
  pathfit1: Module[];
  pathfit2: Module[];
  activeCourse: CourseKey | null;
  setActiveCourse: (k: CourseKey) => void;
  viewed: Set<number>;
  refreshing: boolean;
  onRefresh: () => void;
  onModulePress: (m: Module) => void;
}) {
  const lists: Record<CourseKey, Module[]> = { pathfit1, pathfit2 };
  const activeList = activeCourse ? lists[activeCourse] : [];

  const pathfit1AllDone = pathfit1.length > 0 && pathfit1.every(m => viewed.has(m.id));
  const pathfit2Locked  = !pathfit1AllDone;

  const handleCourseTabPress = (key: CourseKey) => {
    if (key === 'pathfit2' && pathfit2Locked) {
      Alert.alert('Course Locked', 'Complete all Pathfit 1 modules first to unlock Pathfit 2');
      return;
    }
    setActiveCourse(key);
  };

  return (
    <View style={[g.fill, { backgroundColor: '#f0fdf4' }]}>
      <AppHeader />

      {/* ── Course selector tabs ── */}
      <View style={g.courseTabsBar}>
        {(Object.values(COURSES) as typeof COURSES[CourseKey][]).map(c => {
          const active   = activeCourse === c.key;
          const total    = lists[c.key as CourseKey].length;
          const done     = lists[c.key as CourseKey].filter(m => viewed.has(m.id)).length;
          const isLocked = c.key === 'pathfit2' && pathfit2Locked;
          return (
            <TouchableOpacity
              key={c.key}
              style={[
                g.courseTab,
                active
                  ? { backgroundColor: c.light, borderColor: c.color }
                  : { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
                isLocked && g.courseTabLocked,
              ]}
              onPress={() => handleCourseTabPress(c.key as CourseKey)}
              activeOpacity={0.8}
            >
              <Text style={[g.courseTabEmoji, isLocked && { opacity: 0.45 }]}>{c.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[g.courseTabLabel, active && { color: c.color }, isLocked && g.courseTabLockedText]}>
                  {c.label}
                </Text>
                <Text style={[g.courseTabCount, isLocked && { color: '#cbd5e1' }]}>
                  {isLocked ? 'Locked' : `${done}/${total} viewed`}
                </Text>
              </View>
              {isLocked
                ? <Text style={g.courseTabLockIcon}>🔒</Text>
                : active && <View style={[g.courseTabDot, { backgroundColor: c.color }]} />
              }
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Module list ── */}
      {!activeCourse ? (
        <View style={g.emptyPick}>
          <Text style={g.emptyPickEmoji}>👆</Text>
          <Text style={g.emptyPickText}>Pick a course above to see modules</Text>
        </View>
      ) : (
        <ScrollView
          style={g.fill}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1b5e20" />}
        >
          {(() => {
            const c    = COURSES[activeCourse];
            const done = activeList.filter(m => viewed.has(m.id)).length;
            const pct  = activeList.length > 0 ? done / activeList.length : 0;
            const courseIsLocked = activeCourse === 'pathfit2' && pathfit2Locked;
            return (
              <>
                <View style={[g.courseBanner, { borderColor: c.border, backgroundColor: c.light }]}>
                  <View style={[g.courseBannerAccent, { backgroundColor: c.color }]} />
                  <Text style={g.courseBannerEmoji}>{c.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[g.courseBannerLabel, { color: c.color }]}>{c.label}</Text>
                    <Text style={g.courseBannerSub}>{c.sub}</Text>
                    <View style={g.bannerProgressRow}>
                      <View style={g.bannerProgressTrack}>
                        <View style={[g.bannerProgressFill, { backgroundColor: c.color, width: `${pct * 100}%` as any }]} />
                      </View>
                      <Text style={[g.bannerProgressLabel, { color: c.color }]}>
                        {done}/{activeList.length} lessons
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={g.moduleList}>
                  {activeList.length === 0 ? (
                    <View style={g.emptyBox}>
                      <Text style={g.emptyEmoji}>📭</Text>
                      <Text style={g.emptyText}>No modules in {c.label} yet.</Text>
                    </View>
                  ) : activeList.map((mod, idx) => {
                    const isViewed = viewed.has(mod.id);
                    const isLocked = courseIsLocked;

                    if (isLocked) {
                      return (
                        <View key={mod.id} style={[g.moduleCard, g.moduleCardLocked]}>
                          <View style={[g.moduleCardNum, g.moduleCardNumLocked]}>
                            <Text style={g.moduleCardLockIcon}>🔒</Text>
                          </View>
                          <View style={g.moduleCardInfo}>
                            <Text style={[g.moduleCardTitle, g.moduleCardTitleLocked]} numberOfLines={2}>
                              {mod.title}
                            </Text>
                            {mod.description
                              ? <Text style={g.moduleCardDesc} numberOfLines={1}>{mod.description}</Text>
                              : null}
                          </View>
                        </View>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={mod.id}
                        style={[
                          g.moduleCard,
                          { borderColor: isViewed ? c.color : c.border },
                          isViewed && { backgroundColor: c.light },
                        ]}
                        onPress={() => onModulePress(mod)}
                        activeOpacity={0.82}
                      >
                        <View style={[g.moduleCardNum, { backgroundColor: isViewed ? c.color : c.light }]}>
                          {isViewed
                            ? <Text style={g.moduleCardCheck}>✓</Text>
                            : <Text style={[g.moduleCardNumText, { color: c.color }]}>{idx + 1}</Text>
                          }
                        </View>
                        <View style={g.moduleCardInfo}>
                          <Text style={[g.moduleCardTitle, isViewed && { color: c.color }]} numberOfLines={2}>
                            {mod.title}
                          </Text>
                          {mod.description
                            ? <Text style={g.moduleCardDesc} numberOfLines={1}>{mod.description}</Text>
                            : null}
                        </View>
                        <View style={[g.moduleCardArrowWrap, { backgroundColor: isViewed ? c.color : c.light }]}>
                          <Text style={[g.moduleCardArrow, { color: isViewed ? '#fff' : c.color }]}>›</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            );
          })()}
          <View style={{ height: 28 }} />
        </ScrollView>
      )}
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   Profile Tab
══════════════════════════════════════════════════════ */
function ProfileTab({
  user, onLogout, avatarUri, onAvatarChange,
}: {
  user: AuthUser | null;
  onLogout: () => void;
  avatarUri: string | null;
  onAvatarChange: (uri: string) => void;
}) {
  const initials = user?.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to change your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      onAvatarChange(result.assets[0].uri);
    }
  };

  const rows = [
    { label: 'Student ID', value: user?.student_id ?? '—', emoji: '🎓' },
    { label: 'Section',    value: user?.section    ?? '—', emoji: '📋' },
    { label: 'Name',       value: user?.name       ?? '—', emoji: '👤' },
    { label: 'Email',      value: user?.email      ?? '—', emoji: '✉️' },
  ];

  return (
    <ScrollView style={g.fill} showsVerticalScrollIndicator={false} contentContainerStyle={g.profileScroll}>

      {/* ── Profile header bar ── */}
      <View style={g.profileHeader}>
        <Text style={g.profileHeaderTitle}>Profile</Text>
      </View>

      {/* ── Avatar ── */}
      <View style={g.profileAvatarSection}>
        <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={g.profileAvatarWrap}>
          <View style={g.profileAvatar}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={g.profileAvatarImg} />
              : <Text style={g.profileAvatarTxt}>{initials}</Text>
            }
          </View>
          <View style={g.profileEditBtn}>
            <Text style={g.profileEditIcon}>✏️</Text>
          </View>
        </TouchableOpacity>
        <Text style={g.profileName}>{user?.name ?? '—'}</Text>
        <Text style={g.profileEmail}>{user?.email ?? ''}</Text>
        <Text style={g.profileAvatarHint}>Tap photo to change</Text>
      </View>

      {/* ── Info menu card ── */}
      <View style={g.profileMenuCard}>
        {rows.map((row, i) => (
          <View key={row.label} style={[g.profileMenuItem, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={g.profileMenuIconWrap}>
              <Text style={g.profileMenuIcon}>{row.emoji}</Text>
            </View>
            <View style={g.profileMenuBody}>
              <Text style={g.profileMenuLabel}>{row.label}</Text>
              <Text style={g.profileMenuValue} numberOfLines={1}>{row.value}</Text>
            </View>
            <Text style={g.profileMenuChevron}>›</Text>
          </View>
        ))}
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={g.profileLogoutCard} onPress={onLogout} activeOpacity={0.85}>
        <View style={g.profileMenuIconWrap}>
          <Text style={g.profileMenuIcon}>🚪</Text>
        </View>
        <Text style={g.profileLogoutText}>Logout</Text>
        <Text style={[g.profileMenuChevron, { color: '#fca5a5' }]}>›</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/* ══════════════════════════════════════════════════════
   Progress Tab
══════════════════════════════════════════════════════ */
function ProgressTab({
  modules, viewed, scores, onLessonsPress, onQuizzesPress,
}: {
  modules: { id: number; title: string; course: string }[];
  viewed: Set<number>;
  scores: import('@/lib/progress').QuizScore[];
  onLessonsPress: () => void;
  onQuizzesPress: () => void;
}) {
  const totalModules     = modules.length;
  const completedModules = viewed.size;
  const overallPct       = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  const COURSES = [
    { key: 'pathfit1', label: 'Pathfit 1', emoji: '🏃', color: '#1b5e20', light: '#e8f5e9', border: '#a5d6a7' },
    { key: 'pathfit2', label: 'Pathfit 2', emoji: '🧘', color: '#2e7d32', light: '#f1f8e9', border: '#c5e1a5' },
  ] as const;

  return (
    <ScrollView style={g.fill} showsVerticalScrollIndicator={false}>
      <AppHeader />

      {/* Overall summary */}
      <View style={g.progSummary}>
        <View style={g.progSummaryLeft}>
          <Text style={g.progSummaryPct}>{overallPct}%</Text>
          <Text style={g.progSummaryLabel}>Overall Progress</Text>
        </View>
        <View style={g.progSummaryRight}>
          <View style={g.progSummaryTrack}>
            <View style={[g.progSummaryFill, { width: `${overallPct}%` as any }]} />
          </View>
          <Text style={g.progSummaryCount}>{completedModules} / {totalModules} lessons done</Text>
        </View>
      </View>

      {/* Course breakdown */}
      <View style={g.sectionRow}>
        <Text style={g.sectionTitle}>By Course</Text>
      </View>
      <View style={g.progCourseRow}>
        {COURSES.map(c => {
          const list = modules.filter(m => m.course === c.key);
          const done = list.filter(m => viewed.has(m.id)).length;
          const pct  = list.length > 0 ? Math.round((done / list.length) * 100) : 0;
          return (
            <View key={c.key} style={[g.progCourseCard, { borderColor: c.border, backgroundColor: c.light }]}>
              <Text style={g.progCourseEmoji}>{c.emoji}</Text>
              <Text style={[g.progCourseLabel, { color: c.color }]}>{c.label}</Text>
              <Text style={[g.progCoursePct, { color: c.color }]}>{pct}%</Text>
              <View style={g.progCourseTrack}>
                <View style={[g.progCourseFill, { backgroundColor: c.color, width: `${pct}%` as any }]} />
              </View>
              <Text style={[g.progCourseCount, { color: c.color }]}>{done}/{list.length}</Text>
            </View>
          );
        })}
      </View>

      {/* Quick links */}
      <View style={g.sectionRow}>
        <Text style={g.sectionTitle}>Details</Text>
      </View>
      <View style={g.progLinks}>
        <TouchableOpacity style={[g.progLink, { borderColor: '#a5d6a7' }]} onPress={onLessonsPress} activeOpacity={0.82}>
          <View style={[g.progLinkIcon, { backgroundColor: '#e8f5e9' }]}>
            <Text style={g.progLinkEmoji}>📚</Text>
          </View>
          <View style={g.progLinkBody}>
            <Text style={[g.progLinkTitle, { color: '#1b5e20' }]}>Lessons Done</Text>
            <Text style={g.progLinkSub}>{completedModules} of {totalModules} completed</Text>
          </View>
          <Text style={[g.progLinkArrow, { color: '#a5d6a7' }]}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[g.progLink, { borderColor: '#c5e1a5' }]} onPress={onQuizzesPress} activeOpacity={0.82}>
          <View style={[g.progLinkIcon, { backgroundColor: '#f1f8e9' }]}>
            <Text style={g.progLinkEmoji}>🏆</Text>
          </View>
          <View style={g.progLinkBody}>
            <Text style={[g.progLinkTitle, { color: '#2e7d32' }]}>Quiz Results</Text>
            <Text style={g.progLinkSub}>{scores.length} quiz{scores.length !== 1 ? 'zes' : ''} taken</Text>
          </View>
          <Text style={[g.progLinkArrow, { color: '#c5e1a5' }]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/* ══════════════════════════════════════════════════════
   Styles
══════════════════════════════════════════════════════ */
const g = StyleSheet.create({
  /* ── Root ── */
  safe: { flex: 1, backgroundColor: '#e8f5e9' },
  body:       { flex: 1, backgroundColor: '#e8f5e9' },
  fill:       { flex: 1, backgroundColor: 'transparent' },
  fillTransparent: { flex: 1, backgroundColor: 'transparent' },
  loadScreen: { flex: 1, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText:   { fontSize: 14, color: '#4a7c59', fontWeight: '500' },



  /* ── App header ── */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'transparent', paddingHorizontal: 18, paddingVertical: 13,
  },
  headerBrand:    {},

  /* ── Badge / role pill ── */
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeEmoji: { fontSize: 12 },
  badgeText:  { fontSize: 12, fontWeight: '700' },

  /* ── Home greeting header ── */
  greetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  greetAvatarTxt: {
    width: 70, height: 70, borderRadius: 35, lineHeight: 70,
    textAlign: 'center', textAlignVertical: 'center',
    fontSize: 26, fontWeight: '800', color: '#fff',
    backgroundColor: '#2e7d32',
    overflow: 'hidden',
    shadowColor: '#2e7d32', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  greetAvatarImg: {
    width: 70, height: 70, borderRadius: 35,
    borderWidth: 2, borderColor: '#a5d6a7',
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  greetInfo:     { flex: 1, gap: 3 },
  greetName:     { fontSize: 24, fontWeight: '800', color: '#1b5e20' },
  greetGreeting: { fontSize: 13, color: '#4a7c59', fontWeight: '600' },

  /* ── Section heading ── */
  sectionRow: {
    paddingHorizontal: 18, paddingTop: 22, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1b5e20' },

  /* ── My Progress cards ── */
  progressRow: {
    flexDirection: 'column', paddingHorizontal: 18, gap: 10,
  },
  progressCard: {
    borderRadius: 18, borderWidth: 1.5,
    backgroundColor: '#ffffff', overflow: 'hidden',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 10,
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },

  /* top row */
  pcTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pcIconWrap: {
    width: 46, height: 46, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pcIconEmoji: { fontSize: 22 },
  pcCountCol:  { flex: 1 },
  pcBigCount:  { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  pcCountDenom:{ fontSize: 12, fontWeight: '500', color: '#94a3b8' },
  pcLabel:     { fontSize: 12, fontWeight: '700', marginTop: 2 },
  pcStatusBadge: {
    borderRadius: 10, borderWidth: 1.5,
    paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0,
  },
  pcStatusText: { fontSize: 11, fontWeight: '800' },

  /* progress bar */
  pcBarTrack: { height: 7, borderRadius: 4, backgroundColor: '#e8f5e9', overflow: 'hidden' },
  pcBarFill:  { height: 7, borderRadius: 4 },

  /* bottom row */
  pcBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pcSubLabel:  { fontSize: 11, color: '#94a3b8', fontWeight: '500', flex: 1 },
  pcViewAll:   { fontSize: 11, fontWeight: '700', color: '#a5d6a7' },

  /* legacy aliases (kept in case other code references them) */
  progressCardInner:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressCardIconWrap:{ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  progressCardEmoji:   { fontSize: 20 },
  progressCardBody:    { flex: 1 },
  progressCardCount:   { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  progressCardOf:      { fontSize: 11, fontWeight: '500', color: '#94a3b8' },
  progressCardTitle:   { fontSize: 11, fontWeight: '700', marginTop: 2 },
  progressCardTrack:   { height: 5, borderRadius: 4, backgroundColor: '#e8f5e9', overflow: 'hidden' },
  progressCardFill:    { height: 5, borderRadius: 4 },

  /* ── Banner Carousel ── */
  bannerWrap:    { marginHorizontal: 18, marginTop: 16 },
  bannerShadow: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#1b5e20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
  },
  bannerCard: {
    borderRadius: 20, overflow: 'hidden',
    height: 170,
  },
  bannerCircle: {
    position: 'absolute',
    width: 140, height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: -40, right: -30,
  },
  bannerContent:  { flex: 1, gap: 7, zIndex: 1 },
  bannerTagWrap: {
    alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 4,
  },
  bannerTag:    { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  bannerTitle:  { fontSize: 25, fontWeight: '900', color: '#fff', lineHeight: 31, letterSpacing: -0.3 },
  bannerSub:    { fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 17, fontWeight: '500' },
  bannerEmojiWrap: {
    width: 82, height: 82, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginLeft: 10, zIndex: 1,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1, shadowRadius: 6,
  },
  bannerEmoji: { fontSize: 40 },
  /* dots float over the bottom of the image */
  bannerDotsOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  bannerDot:         { height: 7, borderRadius: 4 },
  bannerDotActive:   { width: 24, backgroundColor: '#fff' },
  bannerDotInactive: { width: 7, backgroundColor: 'rgba(255,255,255,0.45)' },

  /* ── Course stack (home) — photo-card layout ── */
  courseStack: { flexDirection: 'row', paddingHorizontal: 18, gap: 14 },
  /* Photo card */
  coursePhotoCard: {
    flex: 1,
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1.5, borderColor: '#a5d6a7',
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  coursePhotoCardLocked: { opacity: 0.75 },
  coursePhotoWrap: { width: '100%', height: 90, backgroundColor: '#e8f5e9' },
  coursePhoto:     { width: '100%', height: '100%' },
  coursePhotoBadge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20,
  },
  coursePhotoBadgeDot:  { width: 7, height: 7, borderRadius: 4 },
  coursePhotoBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  coursePhotoLockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  coursePhotoBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  coursePhotoBannerTitle: { fontSize: 14, fontWeight: '800', color: '#fff', flex: 1 },
  coursePhotoBannerEmoji: { fontSize: 18 },
  coursePhotoBody: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8 },
  courseNameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' },
  coursePhotoName: { fontSize: 13, fontWeight: '800', color: '#1b5e20' },
  courseInlineBadge: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2,
  },
  courseInlineBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
  coursePhotoSub:  { fontSize: 10, color: '#4a7c59', lineHeight: 14 },

  /* Legacy (kept for courseTabsBar references) */
  courseStackCardLocked: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc', opacity: 0.85 },
  courseStackLockedHint: { fontSize: 11, color: '#cbd5e1', fontWeight: '600', marginTop: 4 },

  /* ── Home progress bar ── */
  homeProgressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  homeProgressTrack: { flex: 1, height: 5, backgroundColor: 'rgba(21,101,192,0.12)', borderRadius: 3, overflow: 'hidden' },
  homeProgressFill:  { height: '100%', borderRadius: 3 },
  homeProgressLabel: { fontSize: 11, fontWeight: '700' },

  /* ── Modules tab course tabs bar ── */
  courseTabsBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e8f5e9',
    backgroundColor: '#f0fdf4',
  },
  courseTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 11,
  },
  courseTabEmoji:      { fontSize: 22 },
  courseTabLabel:      { fontSize: 13, fontWeight: '700', color: '#1b5e20' },
  courseTabCount:      { fontSize: 11, color: '#4a7c59', marginTop: 1 },
  courseTabDot:        { width: 8, height: 8, borderRadius: 4 },
  courseTabLocked:     { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', opacity: 0.75 },
  courseTabLockedText: { color: '#94a3b8' },
  courseTabLockIcon:   { fontSize: 16 },

  /* ── Empty states ── */
  emptyPick:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyPickEmoji:{ fontSize: 48 },
  emptyPickText: { fontSize: 14, color: '#a5d6a7', fontWeight: '500' },
  emptyBox:      { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyEmoji:    { fontSize: 40 },
  emptyText:     { fontSize: 14, color: '#4a7c59' },

  /* ── Course banner (module list) ── */
  courseBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    borderRadius: 18, borderWidth: 1.5, padding: 16, overflow: 'hidden',
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  courseBannerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  courseBannerEmoji:  { fontSize: 28, marginLeft: 8 },
  courseBannerLabel:  { fontSize: 15, fontWeight: '800' },
  courseBannerSub:    { fontSize: 11, color: '#4a7c59', marginTop: 2, lineHeight: 16 },
  bannerProgressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  bannerProgressTrack: { flex: 1, height: 6, backgroundColor: 'rgba(21,101,192,0.12)', borderRadius: 3, overflow: 'hidden' },
  bannerProgressFill:  { height: '100%', borderRadius: 3 },
  bannerProgressLabel: { fontSize: 11, fontWeight: '700', minWidth: 56 },

  /* ── Module grid cards (photo design) ── */
  moduleGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingTop: 8, gap: 12,
  },
  modulePhotoCard: {
    width: '47%',
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1.5, borderColor: '#a5d6a7',
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  modulePhotoCardLocked: { opacity: 0.7, borderColor: '#e2e8f0' },
  modulePhotoTop:  { width: '100%', height: 110, backgroundColor: '#e8f5e9' },
  modulePhotoImg:  { width: '100%', height: '100%' },
  modulePhotoViewedBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(21,101,192,0.9)',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
  },
  modulePhotoViewedBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  modulePhotoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  modulePhotoBannerNum:   { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.75)' },
  modulePhotoBannerTitle: { flex: 1, fontSize: 12, fontWeight: '800', color: '#fff', lineHeight: 16 },
  modulePhotoBody: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 10 },
  modulePhotoDesc: { fontSize: 11, color: '#4a7c59', lineHeight: 15 },
  modulePhotoRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modulePhotoRatingText: { fontSize: 11, fontWeight: '600', color: '#4a7c59' },

  /* Legacy module card styles */
  moduleList:           { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  moduleCard:           { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 14, shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  moduleCardNum:        { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  moduleCardNumText:    { fontSize: 14, fontWeight: '800' },
  moduleCardCheck:      { fontSize: 16, fontWeight: '900', color: '#ffffff' },
  moduleCardInfo:       { flex: 1 },
  moduleCardTitle:      { fontSize: 14, fontWeight: '700', color: '#1b5e20', lineHeight: 20 },
  moduleCardDesc:       { fontSize: 11, color: '#4a7c59', marginTop: 3 },
  moduleCardArrowWrap:  { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  moduleCardArrow:      { fontSize: 20, fontWeight: '700' },
  moduleCardLocked:     { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  moduleCardNumLocked:  { backgroundColor: '#e2e8f0' },
  moduleCardLockIcon:   { fontSize: 15 },
  moduleCardTitleLocked:{ color: '#94a3b8' },

  /* ── Profile ── */
  profileScroll:    { flexGrow: 1, backgroundColor: '#e8f5e9' },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#e8f5e9', paddingHorizontal: 18, paddingVertical: 18,
  },
  profileHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#1b5e20' },
  profileAvatarSection: {
    alignItems: 'center', paddingBottom: 28, paddingTop: 24, gap: 6,
    backgroundColor: '#e8f5e9',
    marginBottom: 8,
  },
  profileAvatarWrap: { position: 'relative', marginBottom: 10 },
  profileAvatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#a5d6a7',
    backgroundColor: '#2e7d32',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 6,
  },
  profileAvatarImg:  { width: 100, height: 100, borderRadius: 50 },
  profileAvatarTxt:  { fontSize: 34, fontWeight: '800', color: '#ffffff' },
  profileEditBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#a5d6a7',
    alignItems: 'center', justifyContent: 'center',
  },
  profileEditIcon:  { fontSize: 14 },
  profileName:      { fontSize: 20, fontWeight: '800', color: '#1b5e20' },
  profileEmail:     { fontSize: 13, color: '#4a7c59' },
  profileAvatarHint: { fontSize: 11, color: '#a5d6a7', marginTop: 2 },

  /* ── Profile menu card ── */
  profileMenuCard: {
    marginHorizontal: 18, marginBottom: 12,
    backgroundColor: '#ffffff', borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  profileMenuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 18, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: '#e8f5e9',
  },
  profileMenuIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center',
  },
  profileMenuIcon:    { fontSize: 18 },
  profileMenuBody:    { flex: 1 },
  profileMenuLabel:   { fontSize: 13, fontWeight: '700', color: '#1b5e20' },
  profileMenuValue:   { fontSize: 12, color: '#4a7c59', marginTop: 1 },
  profileMenuChevron: { fontSize: 22, color: '#a5d6a7', fontWeight: '300' },

  /* ── Profile logout card ── */
  profileLogoutCard: {
    marginHorizontal: 18, marginBottom: 12,
    backgroundColor: '#fff5f5', borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 18, paddingVertical: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  profileLogoutText:  { flex: 1, fontSize: 14, fontWeight: '700', color: '#dc2626' },

  /* ── Profile body (legacy — kept for compat) ── */
  profileBody: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 40, gap: 14 },

  /* ── Info card (profile) ── */
  infoCard: {
    backgroundColor: '#ffffff', borderRadius: 18,
    borderWidth: 1.5, borderColor: '#a5d6a7', overflow: 'hidden',
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#e8f5e9',
  },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#a5d6a7',
    alignItems: 'center', justifyContent: 'center',
  },
  infoIcon:  { fontSize: 17 },
  infoText:  { flex: 1 },
  infoLabel: { fontSize: 11, color: '#4a7c59', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1b5e20', marginTop: 2 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 14, backgroundColor: '#fff5f5',
    borderWidth: 1.5, borderColor: '#fecaca',
  },
  signOutIcon: { fontSize: 17 },
  signOutText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },

  /* ── Bottom navigation ── */
  navbar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e8f5e9',
    paddingBottom: 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    shadowColor: '#1b5e20',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  navIconWrap: {
    width: 46,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconWrapActive: {
    backgroundColor: '#1b5e20',
    shadowColor: '#1b5e20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  navLabel:       { fontSize: 10, color: '#a5d6a7', fontWeight: '500' },
  navLabelActive: { color: '#1b5e20', fontWeight: '700' },

  /* ── Progress Tab ── */
  progSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginHorizontal: 18, marginTop: 16, marginBottom: 4,
    backgroundColor: '#1b5e20', borderRadius: 20, borderWidth: 0,
    padding: 18,
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  progSummaryLeft:  { alignItems: 'center', gap: 2 },
  progSummaryPct:   { fontSize: 32, fontWeight: '900', color: '#ffffff' },
  progSummaryLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  progSummaryRight: { flex: 1, gap: 6 },
  progSummaryTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progSummaryFill:  { height: 8, borderRadius: 4, backgroundColor: '#ffffff' },
  progSummaryCount: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  progCourseRow: { flexDirection: 'row', paddingHorizontal: 18, gap: 12 },
  progCourseCard: {
    flex: 1, borderRadius: 18, borderWidth: 1.5,
    padding: 14, gap: 6, alignItems: 'center',
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  progCourseEmoji: { fontSize: 26 },
  progCourseLabel: { fontSize: 12, fontWeight: '800' },
  progCoursePct:   { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  progCourseTrack: { width: '100%', height: 4, borderRadius: 4, backgroundColor: 'rgba(21,101,192,0.12)', overflow: 'hidden' },
  progCourseFill:  { height: 4, borderRadius: 4 },
  progCourseCount: { fontSize: 11, fontWeight: '700' },

  progLinks: { paddingHorizontal: 18, gap: 10 },
  progLink: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 18, borderWidth: 1.5,
    padding: 14,
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  progLinkIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  progLinkEmoji: { fontSize: 22 },
  progLinkBody:  { flex: 1 },
  progLinkTitle: { fontSize: 14, fontWeight: '800' },
  progLinkSub:   { fontSize: 12, color: '#4a7c59', marginTop: 2 },
  progLinkArrow: { fontSize: 26, fontWeight: '300' },
});
