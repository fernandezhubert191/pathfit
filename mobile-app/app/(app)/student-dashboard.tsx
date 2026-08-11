import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, RefreshControl, ScrollView,
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
    color: '#1c7ed6',
    light: '#eff6ff',
    border: '#bfdbfe',
    gradient: ['#1c7ed6', '#3b9de8'],
  },
  pathfit2: {
    key: 'pathfit2',
    label: 'Pathfit 2',
    sub: 'Mobility Training',
    emoji: '🧘',
    color: '#0ca678',
    light: '#ecfdf5',
    border: '#a7f3d0',
    gradient: ['#0ca678', '#34d399'],
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
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#1c7ed6" />
        <Text style={g.loadText}>Loading your dashboard…</Text>
      </View>
    );
  }

  const pathfit1 = modules.filter(m => m.course === 'pathfit1');
  const pathfit2 = modules.filter(m => m.course === 'pathfit2');

  return (
    <SafeAreaView style={g.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Content area ── */}
      <View style={g.body}>
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
      {/* ── Decorative background ── */}
      <LinearGradient
        colors={['#e8f4ff', '#f0fdf8', '#f8faff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />


    <ScrollView
      style={g.fillTransparent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1c7ed6" />}
    >
      {/* ── Greeting header ── */}
      <TouchableOpacity style={g.greetHeader} onPress={onGoProfile} activeOpacity={0.85}>
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={g.greetAvatarImg} />
          : <Text style={g.greetAvatarText}>{initials}</Text>
        }
        <Text style={g.greetTimeText}>{getGreeting()}, <Text style={g.greetName}>{user?.name ?? '—'} 👋</Text></Text>
      </TouchableOpacity>

      {/* ── Promo Banner Carousel ── */}
      <BannerCarousel />

      {/* ── Modules section ── */}
      <View style={g.sectionRow}>
        <Text style={g.sectionTitle}>Modules</Text>
      </View>
      <View style={g.courseStack}>
        {(Object.values(COURSES) as typeof COURSES[CourseKey][]).map(c => {
          const total   = totalCounts[c.key as CourseKey];
          const done    = viewedCounts[c.key as CourseKey];
          const pct     = total > 0 ? done / total : 0;
          const allDone = total > 0 && done === total;
          const isLocked = c.key === 'pathfit2' && !pathfit1AllDone;

          if (isLocked) {
            return (
              <TouchableOpacity
                key={c.key}
                style={[g.courseStackCard, g.courseStackCardLocked]}
                activeOpacity={0.7}
                onPress={() =>
                  Alert.alert('Course Locked', 'Complete all Pathfit 1 modules first to unlock Pathfit 2.')
                }
              >
                <View style={[g.courseStackAccent, { backgroundColor: '#cbd5e1' }]} />
                <View style={[g.courseStackIconWrap, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                  <Text style={[g.courseStackEmoji, { opacity: 0.4 }]}>{c.emoji}</Text>
                </View>
                <View style={g.courseStackInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[g.courseStackLabel, { color: '#94a3b8' }]}>{c.label}</Text>
                    <Text style={{ fontSize: 14 }}>🔒</Text>
                  </View>
                  <Text style={[g.courseStackSub, { color: '#cbd5e1' }]} numberOfLines={1}>{c.sub}</Text>
                  <Text style={g.courseStackLockedHint}>Finish Pathfit 1 to unlock</Text>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={c.key}
              style={[g.courseStackCard, { borderColor: allDone ? c.color : c.border, backgroundColor: c.light }]}
              activeOpacity={0.82}
              onPress={() => onOpenCourse(c.key as CourseKey)}
            >
              <View style={[g.courseStackAccent, { backgroundColor: c.color }]} />
              <View style={[g.courseStackIconWrap, { backgroundColor: '#ffffff', borderColor: c.border }]}>
                <Text style={g.courseStackEmoji}>{c.emoji}</Text>
              </View>
              <View style={g.courseStackInfo}>
                <Text style={[g.courseStackLabel, { color: c.color }]}>{c.label}</Text>
                <Text style={g.courseStackSub} numberOfLines={1}>{c.sub}</Text>
                <View style={g.homeProgressRow}>
                  <View style={g.homeProgressTrack}>
                    <View style={[g.homeProgressFill, { backgroundColor: c.color, width: `${pct * 100}%` as any }]} />
                  </View>
                  <Text style={[g.homeProgressLabel, { color: c.color }]}>{done}/{total}</Text>
                </View>
              </View>
              <View style={[g.courseStackArrow, { backgroundColor: allDone ? c.color : c.border }]}>
                <Text style={[g.courseStackArrowText, { color: allDone ? '#fff' : c.color }]}>
                  {allDone ? '✓' : '›'}
                </Text>
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

        {/* Lessons Done */}
        <TouchableOpacity
          style={[g.progressCard, { borderColor: '#bfdbfe' }]}
          activeOpacity={0.82}
          onPress={() => router.push('/(app)/progress-lessons')}
        >
          <View style={g.progressCardInner}>
            <View style={[g.progressCardIconWrap, { backgroundColor: '#eff6ff' }]}>
              <Text style={g.progressCardEmoji}>📚</Text>
            </View>
            <View style={g.progressCardBody}>
              <Text style={[g.progressCardCount, { color: '#1c7ed6' }]}>
                {completedModules}<Text style={g.progressCardOf}>/{totalModules}</Text>
              </Text>
              <Text style={[g.progressCardTitle, { color: '#1c7ed6' }]}>Lessons Done</Text>
            </View>
          </View>
          <View style={g.progressCardTrack}>
            <View style={[
              g.progressCardFill,
              {
                backgroundColor: '#1c7ed6',
                width: totalModules > 0
                  ? `${Math.round((completedModules / totalModules) * 100)}%` as any
                  : '0%',
              },
            ]} />
          </View>
        </TouchableOpacity>

        {/* Quiz Done */}
        <TouchableOpacity
          style={[g.progressCard, { borderColor: '#a7f3d0' }]}
          activeOpacity={0.82}
          onPress={() => router.push('/(app)/progress-quizzes')}
        >
          <View style={g.progressCardInner}>
            <View style={[g.progressCardIconWrap, { backgroundColor: '#ecfdf5' }]}>
              <Text style={g.progressCardEmoji}>🏆</Text>
            </View>
            <View style={g.progressCardBody}>
              <Text style={[g.progressCardCount, { color: '#0ca678' }]}>
                {scores.length}<Text style={g.progressCardOf}> taken</Text>
              </Text>
              <Text style={[g.progressCardTitle, { color: '#0ca678' }]}>Quiz Done</Text>
            </View>
          </View>
          <View style={g.progressCardTrack}>
            <View style={[
              g.progressCardFill,
              {
                backgroundColor: '#0ca678',
                width: totalModules > 0
                  ? `${Math.min(Math.round((scores.length / totalModules) * 100), 100)}%` as any
                  : '0%',
              },
            ]} />
          </View>
        </TouchableOpacity>

      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   Banner Carousel
══════════════════════════════════════════════════════ */
const BANNERS = [
  {
    tag: '🧘 Stay Consistent',
    title: 'Unlock\nPathfit 2',
    sub: 'Finish all Pathfit 1 lessons to unlock Mobility Training courses.',
    gradient: ['#00695c', '#00897b', '#26a69a'] as const,
    tagBg: 'rgba(255,255,255,0.26)',
    emojiWrapBg: 'rgba(255,255,255,0.2)',
    dotColor: '#00897b',
    emoji: '🏆',
  },
  {
    tag: '📊 Track Progress',
    title: 'Quiz &\nLearn',
    sub: 'Score 75% or higher in quizzes to mark lessons as completed.',
    gradient: ['#4527a0', '#7b1fa2', '#ab47bc'] as const,
    tagBg: 'rgba(255,255,255,0.24)',
    emojiWrapBg: 'rgba(255,255,255,0.18)',
    dotColor: '#7b1fa2',
    emoji: '🎓',
  },
  {
    tag: '🏃 Get Moving',
    title: "Today's\nChallenge",
    sub: 'Complete your Pathfit 1 modules and level up your fitness journey!',
    gradient: ['#1565c0', '#1e88e5', '#42a5f5'] as const,
    tagBg: 'rgba(255,255,255,0.28)',
    emojiWrapBg: 'rgba(255,255,255,0.22)',
    dotColor: '#1e88e5',
    emoji: '💪',
  },
];

function BannerCarousel() {
  const { width } = useWindowDimensions();
  const CARD_W = width - 36; // 18px margin each side
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % BANNERS.length;
        scrollRef.current?.scrollTo({ x: next * CARD_W, animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [CARD_W]);

  return (
    <View style={g.bannerWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={CARD_W}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
          setActive(Math.max(0, Math.min(idx, BANNERS.length - 1)));
        }}
        contentContainerStyle={{ gap: 0 }}
      >
        {BANNERS.map((b, i) => (
          <LinearGradient
            key={i}
            colors={b.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[g.bannerCard, { width: CARD_W }]}
          >
            {/* Decorative circle — top-right */}
            <View style={g.bannerCircle} />
            <View style={g.bannerContent}>
              <View style={[g.bannerTagWrap, { backgroundColor: b.tagBg }]}>
                <Text style={g.bannerTag}>{b.tag}</Text>
              </View>
              <Text style={g.bannerTitle}>{b.title}</Text>
              <Text style={g.bannerSub}>{b.sub}</Text>
            </View>
            <View style={[g.bannerEmojiWrap, { backgroundColor: b.emojiWrapBg }]}>
              <Text style={g.bannerEmoji}>{b.emoji}</Text>
            </View>
          </LinearGradient>
        ))}
      </ScrollView>
      <View style={g.bannerDots}>
        {BANNERS.map((b, i) => (
          <View
            key={i}
            style={[
              g.bannerDot,
              i === active
                ? [g.bannerDotActive, { backgroundColor: b.dotColor }]
                : g.bannerDotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}
const BANNER_WIDTH = 0; // unused — kept for reference only

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
    <View style={g.fill}>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1c7ed6" />}
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

      {/* ── Logout card ── */}
      <TouchableOpacity style={g.profileLogoutCard} onPress={onLogout} activeOpacity={0.85}>
        <View style={g.profileMenuIconWrap}>
          <Text style={g.profileMenuIcon}>🚪</Text>
        </View>
        <Text style={g.profileLogoutText}>Logout Option</Text>
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
    { key: 'pathfit1', label: 'Pathfit 1', emoji: '🏃', color: '#1c7ed6', light: '#eff6ff', border: '#bfdbfe' },
    { key: 'pathfit2', label: 'Pathfit 2', emoji: '🧘', color: '#0ca678', light: '#ecfdf5', border: '#a7f3d0' },
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
        <TouchableOpacity style={[g.progLink, { borderColor: '#bfdbfe' }]} onPress={onLessonsPress} activeOpacity={0.82}>
          <View style={[g.progLinkIcon, { backgroundColor: '#eff6ff' }]}>
            <Text style={g.progLinkEmoji}>📚</Text>
          </View>
          <View style={g.progLinkBody}>
            <Text style={[g.progLinkTitle, { color: '#1c7ed6' }]}>Lessons Done</Text>
            <Text style={g.progLinkSub}>{completedModules} of {totalModules} completed</Text>
          </View>
          <Text style={[g.progLinkArrow, { color: '#bfdbfe' }]}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[g.progLink, { borderColor: '#a7f3d0' }]} onPress={onQuizzesPress} activeOpacity={0.82}>
          <View style={[g.progLinkIcon, { backgroundColor: '#ecfdf5' }]}>
            <Text style={g.progLinkEmoji}>🏆</Text>
          </View>
          <View style={g.progLinkBody}>
            <Text style={[g.progLinkTitle, { color: '#0ca678' }]}>Quiz Results</Text>
            <Text style={g.progLinkSub}>{scores.length} quiz{scores.length !== 1 ? 'zes' : ''} taken</Text>
          </View>
          <Text style={[g.progLinkArrow, { color: '#a7f3d0' }]}>›</Text>
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
  safe: { flex: 1, backgroundColor: '#e8f4ff' },
  body:       { flex: 1, backgroundColor: 'transparent' },
  fill:       { flex: 1, backgroundColor: 'transparent' },
  fillTransparent: { flex: 1, backgroundColor: 'transparent' },
  loadScreen: { flex: 1, backgroundColor: '#e8f4ff', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText:   { fontSize: 14, color: '#94a3b8' },



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
    paddingHorizontal: 18, paddingVertical: 18,
  },
  greetTimeText:   { flex: 1, fontSize: 14, color: '#64748b', fontWeight: '500' },
  greetName:       { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  greetAvatarText: {
    width: 46, height: 46, borderRadius: 23, lineHeight: 46,
    textAlign: 'center', textAlignVertical: 'center',
    fontSize: 17, fontWeight: '800', color: '#fff',
    backgroundColor: '#1c7ed6',
    overflow: 'hidden',
    shadowColor: '#1c7ed6', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  greetAvatarImg:  {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },

  /* ── Section heading ── */
  sectionRow: {
    paddingHorizontal: 18, paddingTop: 22, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },

  /* ── My Progress cards ── */
  progressRow: {
    flexDirection: 'row', paddingHorizontal: 18, gap: 10,
  },
  progressCard: {
    flex: 1, borderRadius: 14, borderWidth: 1.5,
    backgroundColor: '#fff', overflow: 'hidden',
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
    gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  progressCardInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  progressCardIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  progressCardEmoji:  { fontSize: 20 },
  progressCardBody:   { flex: 1 },
  progressCardCount:  { fontSize: 17, fontWeight: '900', lineHeight: 20 },
  progressCardOf:     { fontSize: 11, fontWeight: '500', color: '#94a3b8' },
  progressCardTitle:  { fontSize: 10, fontWeight: '700', marginTop: 1 },
  progressCardTrack:  { height: 3, borderRadius: 3, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  progressCardFill:   { height: 3, borderRadius: 3 },

  /* ── Banner Carousel ── */
  bannerWrap:    { marginHorizontal: 18, marginTop: 16, gap: 10 },
  bannerCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 24, overflow: 'hidden',
    paddingVertical: 24, paddingLeft: 22, paddingRight: 14,
    minHeight: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
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
  bannerEmoji:       { fontSize: 40 },
  bannerDots:        { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  bannerDot:         { height: 7, borderRadius: 4 },
  bannerDotActive:   { width: 22 },
  bannerDotInactive: { width: 7, backgroundColor: '#cbd5e1' },

  /* ── Course stack (home) ── */
  courseStack: { paddingHorizontal: 18, gap: 12 },
  courseStackCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 18, borderWidth: 1.5, padding: 16, overflow: 'hidden',
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09, shadowRadius: 6, elevation: 2,
  },
  courseStackAccent:   { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  courseStackIconWrap: {
    width: 52, height: 52, borderRadius: 15, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  courseStackEmoji:    { fontSize: 26 },
  courseStackInfo:     { flex: 1 },
  courseStackLabel:    { fontSize: 16, fontWeight: '800' },
  courseStackSub:      { fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 17 },
  courseStackArrow: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  courseStackArrowText: { fontSize: 20, fontWeight: '700', color: '#ffffff', lineHeight: 22 },
  courseStackCardLocked: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc', opacity: 0.85 },
  courseStackLockedHint: { fontSize: 11, color: '#cbd5e1', fontWeight: '600', marginTop: 4 },

  /* ── Home progress bar ── */
  homeProgressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  homeProgressTrack: { flex: 1, height: 5, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' },
  homeProgressFill:  { height: '100%', borderRadius: 3 },
  homeProgressLabel: { fontSize: 11, fontWeight: '700' },

  /* ── Modules tab course tabs bar ── */
  courseTabsBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  courseTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 11,
  },
  courseTabEmoji:      { fontSize: 22 },
  courseTabLabel:      { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  courseTabCount:      { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  courseTabDot:        { width: 8, height: 8, borderRadius: 4 },
  courseTabLocked:     { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', opacity: 0.75 },
  courseTabLockedText: { color: '#94a3b8' },
  courseTabLockIcon:   { fontSize: 16 },

  /* ── Empty states ── */
  emptyPick:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyPickEmoji:{ fontSize: 48 },
  emptyPickText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  emptyBox:      { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyEmoji:    { fontSize: 40 },
  emptyText:     { fontSize: 14, color: '#94a3b8' },

  /* ── Course banner (module list) ── */
  courseBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    borderRadius: 16, borderWidth: 1.5, padding: 16, overflow: 'hidden',
  },
  courseBannerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  courseBannerEmoji:  { fontSize: 28, marginLeft: 8 },
  courseBannerLabel:  { fontSize: 15, fontWeight: '800' },
  courseBannerSub:    { fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 16 },
  bannerProgressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  bannerProgressTrack: { flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' },
  bannerProgressFill:  { height: '100%', borderRadius: 3 },
  bannerProgressLabel: { fontSize: 11, fontWeight: '700', minWidth: 56 },

  /* ── Module list cards ── */
  moduleList: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  moduleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 14,
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 1,
  },
  moduleCardNum:        { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  moduleCardNumText:    { fontSize: 14, fontWeight: '800' },
  moduleCardCheck:      { fontSize: 16, fontWeight: '900', color: '#ffffff' },
  moduleCardInfo:       { flex: 1 },
  moduleCardTitle:      { fontSize: 14, fontWeight: '700', color: '#0f172a', lineHeight: 20 },
  moduleCardDesc:       { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  moduleCardArrowWrap:  { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  moduleCardArrow:      { fontSize: 20, fontWeight: '700' },
  moduleCardLocked:     { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  moduleCardNumLocked:  { backgroundColor: '#e2e8f0' },
  moduleCardLockIcon:   { fontSize: 15 },
  moduleCardTitleLocked:{ color: '#94a3b8' },

  /* ── Profile ── */
  profileScroll:    { flexGrow: 1, backgroundColor: '#f1f5f9' },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f1f5f9', paddingHorizontal: 18, paddingVertical: 16,
  },
  profileHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  profileAvatarSection: {
    alignItems: 'center', paddingBottom: 28, gap: 6,
  },
  profileAvatarWrap: { position: 'relative', marginBottom: 10 },
  profileAvatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#ffffff',
    backgroundColor: '#1c7ed6',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  profileAvatarImg:  { width: 100, height: 100, borderRadius: 50 },
  profileAvatarTxt:  { fontSize: 34, fontWeight: '800', color: '#ffffff' },
  profileEditBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#1c7ed6', borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  profileEditIcon:  { fontSize: 14 },
  profileName:      { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  profileEmail:     { fontSize: 13, color: '#64748b' },

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
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  profileMenuIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  profileMenuIcon:    { fontSize: 18 },
  profileMenuBody:    { flex: 1 },
  profileMenuLabel:   { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  profileMenuValue:   { fontSize: 12, color: '#64748b', marginTop: 1 },
  profileMenuChevron: { fontSize: 22, color: '#cbd5e1', fontWeight: '300' },

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
    borderWidth: 1.5, borderColor: '#e2e8f0', overflow: 'hidden',
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  infoIcon:  { fontSize: 17 },
  infoText:  { flex: 1 },
  infoLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginTop: 2 },
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
    borderTopColor: '#f1f5f9',
    paddingBottom: 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
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
    backgroundColor: '#1c7ed6',
    shadowColor: '#1c7ed6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  navLabel:       { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  navLabelActive: { color: '#1c7ed6', fontWeight: '700' },

  /* ── Progress Tab ── */
  progSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginHorizontal: 18, marginTop: 16, marginBottom: 4,
    backgroundColor: '#f8fafc', borderRadius: 18, borderWidth: 1.5,
    borderColor: '#e2e8f0', padding: 16,
  },
  progSummaryLeft:  { alignItems: 'center', gap: 2 },
  progSummaryPct:   { fontSize: 30, fontWeight: '900', color: '#1c7ed6' },
  progSummaryLabel: { fontSize: 10, fontWeight: '600', color: '#94a3b8' },
  progSummaryRight: { flex: 1, gap: 6 },
  progSummaryTrack: { height: 8, borderRadius: 4, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  progSummaryFill:  { height: 8, borderRadius: 4, backgroundColor: '#1c7ed6' },
  progSummaryCount: { fontSize: 12, fontWeight: '600', color: '#64748b' },

  progCourseRow: { flexDirection: 'row', paddingHorizontal: 18, gap: 12 },
  progCourseCard: {
    flex: 1, borderRadius: 18, borderWidth: 1.5,
    padding: 14, gap: 6, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  progCourseEmoji: { fontSize: 26 },
  progCourseLabel: { fontSize: 12, fontWeight: '800' },
  progCoursePct:   { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  progCourseTrack: { width: '100%', height: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  progCourseFill:  { height: 4, borderRadius: 4 },
  progCourseCount: { fontSize: 11, fontWeight: '700' },

  progLinks: { paddingHorizontal: 18, gap: 10 },
  progLink: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5,
    padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  progLinkIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  progLinkEmoji: { fontSize: 22 },
  progLinkBody:  { flex: 1 },
  progLinkTitle: { fontSize: 14, fontWeight: '800' },
  progLinkSub:   { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  progLinkArrow: { fontSize: 26, fontWeight: '300' },
});
