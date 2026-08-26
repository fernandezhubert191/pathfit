import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity,
  useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { API } from '@/lib/api';
import { clearAuth, getToken, getUser, type AuthUser } from '@/lib/auth';
import { getAvatar, saveAvatar } from '@/lib/avatar';
import { fetchWithTimeout } from '@/lib/request';
import { useAutoRefresh } from '@/lib/use-auto-refresh';

/* ── Types ─────────────────────────────────────────── */
const SECTIONS = ['All', 'A', 'B', 'C', 'D'] as const;
type Section = typeof SECTIONS[number];
type TabKey  = 'home' | 'students' | 'modules' | 'profile';
type Student = { id: number; name: string; email: string; student_id: string; section: string | null };
type Module  = { id: number; title: string; course: string; description: string | null };

/* ── Config ─────────────────────────────────────────── */
const COURSES = {
  pathfit1: { label: 'Pathfit 1', sub: 'Movement Enhancement',  emoji: '🏃', color: '#1b5e20', light: '#e8f5e9', border: '#a5d6a7', cover: require('@/assets/pathfit1.png') },
  pathfit2: { label: 'Pathfit 2', sub: 'Mobility Training',     emoji: '🧘', color: '#2e7d32', light: '#f1f8e9', border: '#c5e1a5', cover: require('@/assets/pathfit2.png') },
} as const;

const SEC_COLOR:  Record<string, string> = { A: '#2e7d32', B: '#1b5e20', C: '#33691e', D: '#558b2f' };
const SEC_BG:     Record<string, string> = { A: '#e8f5e9', B: '#f1f8e9', C: '#f9fbe7', D: '#dcedc8' };
const SEC_BORDER: Record<string, string> = { A: '#a5d6a7', B: '#c5e1a5', C: '#e6ee9c', D: '#aed581' };

/* ══════════════════════════════════════════════════════
   Root
══════════════════════════════════════════════════════ */
export default function TeacherDashboard() {
  const router = useRouter();
  const [teacher, setTeacher]   = useState<AuthUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [modules, setModules]   = useState<Module[]>([]);
  const [activeTab, setActiveTab]         = useState<TabKey>('home');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingModules, setLoadingModules]   = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('All');
  const [search, setSearch]               = useState('');
  const [activeCourse, setActiveCourse]   = useState<'pathfit1' | 'pathfit2' | null>(null);
  const [avatarUri, setAvatarUri]         = useState<string | null>(null);

  const fetchStudents = async (section: Section = activeSection) => {
    const token = await getToken();
    try {
      const q = section !== 'All' ? `?section=${section}` : '';
      const res = await fetchWithTimeout(`${API}/students${q}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      setStudents((await res.json()).students ?? []);
    } catch { setStudents([]); }
    finally { setLoadingStudents(false); setRefreshing(false); }
  };

  const fetchModules = async () => {
    const token = await getToken();
    try {
      const res = await fetchWithTimeout(`${API}/modules`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) setModules((await res.json()).modules ?? []);
    } catch { /* silent */ }
    finally { setLoadingModules(false); }
  };

  useEffect(() => {
    (async () => {
      const [u, t] = await Promise.all([getUser(), getToken()]);
      if (!u || !t) return;
      setTeacher(u);
      const av = await getAvatar(u.id);
      setAvatarUri(av);
      fetchStudents(); fetchModules();
    })();
  }, []);

  useEffect(() => {
    setLoadingStudents(true);
    fetchStudents(activeSection);
  }, [activeSection]);

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

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents(activeSection);
    fetchModules();
  };

  const autoRefreshFn = useCallback(() => {
    fetchStudents(activeSection);
    fetchModules();
  }, [activeSection]);
  useAutoRefresh(autoRefreshFn, { enabled: !loadingStudents && !loadingModules });

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q)
      || s.student_id.toLowerCase().includes(q)
      || s.email.toLowerCase().includes(q);
  });

  const initials = teacher?.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
  const pathfit1 = modules.filter(m => m.course === 'pathfit1');
  const pathfit2 = modules.filter(m => m.course === 'pathfit2');

  return (
    <SafeAreaView style={g.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#1b5e20" />
      <View style={[g.body, { backgroundColor: '#f0fdf4' }]}>
        {activeTab === 'home' && (
          <HomeTab teacher={teacher} initials={initials}
            avatarUri={avatarUri}
            students={students} modules={modules}
            refreshing={refreshing} onRefresh={onRefresh}
            onGoStudents={() => setActiveTab('students')}
            onGoPathfit1={() => { setActiveCourse('pathfit1'); setActiveTab('modules'); }}
            onGoPathfit2={() => { setActiveCourse('pathfit2'); setActiveTab('modules'); }} />
        )}
        {activeTab === 'students' && (
          <StudentsTab students={students} filtered={filtered}
            loading={loadingStudents} refreshing={refreshing}
            activeSection={activeSection} setActiveSection={setActiveSection}
            search={search} setSearch={setSearch} onRefresh={onRefresh}
            onStudentPress={st => router.push({
              pathname: '/(app)/student-progress',
              params: { studentId: String(st.id), studentName: st.name },
            })} />
        )}
        {activeTab === 'modules' && (
          <ModulesTab pathfit1={pathfit1} pathfit2={pathfit2}
            loading={loadingModules} refreshing={refreshing}
            activeCourse={activeCourse} setActiveCourse={setActiveCourse}
            onRefresh={onRefresh}
            onModulePress={mod => router.push({
              pathname: '/(app)/module-viewer',
              params: { id: String(mod.id), title: mod.title, role: 'teacher' },
            })} />
        )}
        {activeTab === 'profile' && (
          <ProfileTab
            teacher={teacher}
            initials={initials}
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

/* ── Bottom Navigation ───────────────────────────── */
type NavTab = {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const NAV_TABS: NavTab[] = [
  { key: 'home',     label: 'Home',     icon: 'home-outline',          iconActive: 'home' },
  { key: 'modules',  label: 'Modules',  icon: 'book-outline',          iconActive: 'book' },
  { key: 'students', label: 'Progress', icon: 'people-outline',        iconActive: 'people' },
  { key: 'profile',  label: 'Profile',  icon: 'person-outline',        iconActive: 'person' },
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
                color={active ? '#ffffff' : '#a5d6a7'}
              />
            </View>
            <Text style={[g.navLabel, active && g.navLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── Greeting helpers ── */
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

/* ── Home Tab ─────────────────────────────────────── */
function HomeTab({ teacher, initials, avatarUri, students, modules, refreshing, onRefresh, onGoStudents, onGoPathfit1, onGoPathfit2 }: {
  teacher: AuthUser | null; initials: string; avatarUri: string | null;
  students: Student[]; modules: Module[];
  refreshing: boolean; onRefresh: () => void;
  onGoStudents: () => void; onGoPathfit1: () => void; onGoPathfit2: () => void;
}) {
  const pathfit1 = modules.filter(m => m.course === 'pathfit1');
  const pathfit2 = modules.filter(m => m.course === 'pathfit2');

  const courseItems = [
    { key: 'pathfit1' as const, label: 'Pathfit 1', sub: 'Movement Enhancement', emoji: '🏃', color: '#1b5e20', light: '#e8f5e9', border: '#a5d6a7', cover: require('@/assets/pathfit1.png'), count: pathfit1.length, onPress: onGoPathfit1 },
    { key: 'pathfit2' as const, label: 'Pathfit 2', sub: 'Mobility Training',    emoji: '🧘', color: '#2e7d32', light: '#f1f8e9', border: '#c5e1a5', cover: require('@/assets/pathfit2.png'), count: pathfit2.length, onPress: onGoPathfit2 },
  ];

  return (
    <View style={g.fill}>
      <ScrollView
        style={g.fill}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2e7d32" />}
      >
        {/* ── Greeting header ── */}
        <TouchableOpacity style={g.greetHeader} activeOpacity={0.85}>
          {avatarUri
            ? <Image source={{ uri: avatarUri }} style={g.greetAvatarImg} />
            : <Text style={g.greetAvatarTxt}>{initials}</Text>
          }
          <View style={g.greetInfo}>
            <WaveGreeting />
            <Text style={g.greetName} numberOfLines={1}>{teacher?.name ?? '—'}</Text>
          </View>
        </TouchableOpacity>

        {/* ── Banner Carousel ── */}
        <TeacherBannerCarousel />

        {/* ── Quick Access: Modules (photo cards) ── */}
        <View style={g.sectionRow}><Text style={g.sectionTitle}>Quick Access</Text></View>
        <View style={g.coursePhotoRow}>
          {courseItems.map(c => (
            <TouchableOpacity
              key={c.key}
              style={g.coursePhotoCard}
              activeOpacity={0.88}
              onPress={c.onPress}
            >
              {/* Photo area */}
              <View style={g.coursePhotoWrap}>
                <Image
                  source={c.cover}
                  style={g.coursePhoto}
                  resizeMode="cover"
                />
              </View>
              {/* Details */}
              <View style={g.coursePhotoBody}>
                <Text style={[g.coursePhotoName, { color: c.color }]} numberOfLines={1}>{c.label}</Text>
                <Text style={g.coursePhotoSub} numberOfLines={1}>{c.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Student Progress card (no image) ── */}
        <TouchableOpacity
          style={g.spCard}
          onPress={onGoStudents}
          activeOpacity={0.88}
        >


          <View style={g.spInner}>
            {/* Icon block */}
            <View style={g.spIconWrap}>
              <Ionicons name="people" size={26} color="#fff" />
            </View>

            {/* Text content */}
            <View style={g.spContent}>
              {/* Title + badge */}
              <View style={g.spTitleRow}>
                <Text style={g.spTitle}>Student Progress</Text>
                <View style={g.spBadge}>
                  <Ionicons name="school" size={10} color="#1b5e20" />
                  <Text style={g.spBadgeText}>Teacher View</Text>
                </View>
              </View>

              {/* Section chips */}
              <View style={g.spSectionRow}>
                {['A', 'B', 'C', 'D'].map(sec => (
                  <View key={sec} style={g.spSecChip}>
                    <Text style={g.spSecChipText}>Sec {sec}</Text>
                  </View>
                ))}
              </View>

              {/* Progress row */}
              <View style={g.homeProgressRow}>
                <View style={g.homeProgressTrack}>
                  <View style={[g.homeProgressFill, { backgroundColor: '#1b5e20', width: students.length > 0 ? '100%' : '0%' }]} />
                </View>
                <Text style={g.spStudentCount}>
                  {students.length} {students.length === 1 ? 'student' : 'students'}
                </Text>
              </View>
            </View>

            {/* Arrow */}
            <View style={g.spArrow}>
              <Ionicons name="chevron-forward" size={18} color="#1b5e20" />
            </View>
          </View>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

/* ── Teacher Banner Carousel  (image-based: banner4, banner5, banner6) ── */
const T_BANNER_IMAGES = [
  require('@/assets/banner4.png'),
  require('@/assets/banner5.png'),
  require('@/assets/banner6.png'),
];

function TeacherBannerCarousel() {
  const { width } = useWindowDimensions();
  const CARD_W = width - 36;
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-advance
  useEffect(() => {
    const timer = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % T_BANNER_IMAGES.length;
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
            setActive(Math.max(0, Math.min(idx, T_BANNER_IMAGES.length - 1)));
          }}
          style={{ borderRadius: 20, overflow: 'hidden' }}
        >
          {T_BANNER_IMAGES.map((src, i) => (
            <Image
              key={i}
              source={src}
              style={{ width: CARD_W, height: 160, borderRadius: 20 }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>

        {/* Dot indicator */}
        <View style={g.bannerDotsOverlay}>
          {T_BANNER_IMAGES.map((_, i) => (
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

/* ── Students Tab ─────────────────────────────────── */
function StudentsTab({ students, filtered, loading, refreshing, activeSection,
  setActiveSection, search, setSearch, onRefresh, onStudentPress }: {
  students: Student[]; filtered: Student[];
  loading: boolean; refreshing: boolean;
  activeSection: Section; setActiveSection: (s: Section) => void;
  search: string; setSearch: (v: string) => void;
  onRefresh: () => void;
  onStudentPress: (st: Student) => void;
}) {
  /* Section stats for mini-summary row */
  const secCounts = SECTIONS.slice(1).map(sec => ({
    sec,
    count: students.filter(s => s.section === sec).length,
  })).filter(x => x.count > 0);

  return (
    <View style={g.fill}>
      {/* ── Rich header banner ── */}
      <View style={g.stHeader}>
        <View style={g.stHeaderInner}>
          <View style={g.stHeaderLeft}>
            <Text style={g.stHeaderTitle}>Student Progress</Text>
            <Text style={g.stHeaderSub}>Monitor lessons, quizzes & videos</Text>
          </View>
          <View style={g.stHeaderBadge}>
            <Text style={g.stHeaderBadgeNum}>{students.length}</Text>
            <Text style={g.stHeaderBadgeLabel}>enrolled</Text>
          </View>
        </View>
        {/* Section summary chips */}
        {secCounts.length > 0 && (
          <View style={g.stSummaryRow}>
            {secCounts.map(({ sec, count }) => (
              <View key={sec} style={[g.stSummaryChip, { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.35)' }]}>
                <Text style={g.stSummaryChipText}>Sec {sec}</Text>
                <View style={g.stSummaryChipDot} />
                <Text style={g.stSummaryChipCount}>{count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Section filter pills ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={g.secTabsScroll} contentContainerStyle={g.secTabsRow}>
        {SECTIONS.map(sec => {
          const active  = activeSection === sec;
          const count   = sec === 'All' ? students.length : students.filter(s => s.section === sec).length;
          const color   = sec === 'All' ? '#2e7d32' : SEC_COLOR[sec];
          const bg      = sec === 'All' ? '#1b5e20'  : SEC_COLOR[sec];
          const border  = sec === 'All' ? '#a5d6a7'  : SEC_BORDER[sec];
          return (
            <TouchableOpacity key={sec} activeOpacity={0.8}
              style={[g.secTab, active
                ? { backgroundColor: bg, borderColor: bg, shadowColor: bg, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 }
                : {}
              ]}
              onPress={() => setActiveSection(sec)}>
              <Text style={[g.secTabLabel, active && { color: '#fff', fontWeight: '700' }]}>
                {sec === 'All' ? 'All' : `Sec ${sec}`}
              </Text>
              <View style={[g.secTabBadge, active && { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'transparent' }]}>
                <Text style={[g.secTabBadgeText, active && { color: '#fff' }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Search bar ── */}
      <View style={g.searchWrap}>
        <View style={g.searchBox}>
          <Ionicons name="search-outline" size={16} color="#a5d6a7" style={{ marginLeft: 4 }} />
          <TextInput style={g.searchInput} placeholder="Search name, ID or email…"
            placeholderTextColor="#a5d6a7" value={search} onChangeText={setSearch} />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={g.searchClearBtn}>
              <Ionicons name="close-circle" size={17} color="#a5d6a7" />
            </TouchableOpacity>
          )}
        </View>
        <View style={g.searchCountPill}>
          <Text style={g.searchCountText}>{filtered.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={g.center}><ActivityIndicator size="large" color="#2e7d32" /></View>
      ) : (
        <ScrollView style={g.fill} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2e7d32" />}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, gap: 10, paddingBottom: 28 }}>
          {filtered.length === 0 ? (
            <View style={g.emptyBox}>
              <Text style={g.emptyEmoji}>🎓</Text>
              <Text style={g.emptyText}>
                {search ? 'No students match your search.' : activeSection === 'All' ? 'No students enrolled yet.' : `No students in Sec ${activeSection}.`}
              </Text>
            </View>
          ) : filtered.map(st => {
            const sec    = st.section ?? '';
            const color  = SEC_COLOR[sec]  ?? '#4a7c59';
            const bg     = SEC_BG[sec]     ?? '#f8fafc';
            const border = SEC_BORDER[sec] ?? '#e2e8f0';
            return (
              <TouchableOpacity key={st.id}
                style={[g.studentCard, { borderColor: border }]}
                onPress={() => onStudentPress(st)} activeOpacity={0.82}>
                {/* Left accent bar */}
                <View style={[g.studentCardAccent, { backgroundColor: color }]} />
                {/* Avatar */}
                <View style={[g.studentAvatar, { backgroundColor: color }]}>
                  <Text style={g.studentAvatarTxt}>{st.name.charAt(0).toUpperCase()}</Text>
                </View>
                {/* Info */}
                <View style={g.studentInfo}>
                  <Text style={g.studentName}>{st.name}</Text>
                  <Text style={g.studentMeta}>{st.student_id}</Text>
                  <Text style={g.studentEmail} numberOfLines={1}>{st.email}</Text>
                </View>
                {/* Right side */}
                <View style={g.studentRight}>
                  {sec ? (
                    <View style={[g.secPill, { backgroundColor: color }]}>
                      <Text style={g.secPillTxt}>Sec {sec}</Text>
                    </View>
                  ) : null}
                  <View style={[g.studentArrowWrap, { backgroundColor: bg }]}>
                    <Ionicons name="chevron-forward" size={14} color={color} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/* ── Modules Tab ──────────────────────────────────── */
function ModulesTab({ pathfit1, pathfit2, loading, refreshing, activeCourse,
  setActiveCourse, onRefresh, onModulePress }: {
  pathfit1: Module[]; pathfit2: Module[];
  loading: boolean; refreshing: boolean;
  activeCourse: 'pathfit1' | 'pathfit2' | null;
  setActiveCourse: (k: 'pathfit1' | 'pathfit2') => void;
  onRefresh: () => void;
  onModulePress: (m: Module) => void;
}) {
  const lists = { pathfit1, pathfit2 } as const;
  const activeList = activeCourse ? lists[activeCourse] : [];

  return (
    <View style={g.fill}>
      <View style={g.panelHeader}>
        <Text style={g.panelTitle}>Course Modules</Text>
        <Text style={g.panelSub}>{pathfit1.length + pathfit2.length} total</Text>
      </View>
      <View style={g.courseTabsBar}>
        {(['pathfit1', 'pathfit2'] as const).map(k => {
          const c      = COURSES[k];
          const active = activeCourse === k;
          return (
            <TouchableOpacity key={k}
              style={[g.courseTab, active && { backgroundColor: c.light, borderColor: c.color }]}
              onPress={() => setActiveCourse(k)} activeOpacity={0.8}>
              <Text style={g.courseTabEmoji}>{c.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[g.courseTabLabel, active && { color: c.color }]}>{c.label}</Text>
                <Text style={g.courseTabCount}>{lists[k].length} modules</Text>
              </View>
              {active && <View style={[g.courseTabDot, { backgroundColor: c.color }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
      {!activeCourse ? (
        <View style={g.emptyPick}>
          <Text style={g.emptyPickEmoji}>👆</Text>
          <Text style={g.emptyPickText}>Pick a course above</Text>
        </View>
      ) : loading ? (
        <View style={g.center}><ActivityIndicator size="large" color="#2e7d32" /></View>
      ) : (
        <ScrollView style={g.fill} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2e7d32" />}>
          {(() => {
            const c = COURSES[activeCourse];
            return (
              <>
                <View style={[g.courseBanner, { borderColor: c.border, backgroundColor: c.light }]}>
                  <View style={[g.courseBannerAccent, { backgroundColor: c.color }]} />
                  <Text style={g.courseBannerEmoji}>{c.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[g.courseBannerLabel, { color: c.color }]}>{c.label}</Text>
                    <Text style={g.courseBannerSub}>{c.sub}</Text>
                  </View>
                  <View style={[g.courseBannerBadge, { backgroundColor: c.border }]}>
                    <Text style={[g.courseBannerBadgeTxt, { color: c.color }]}>{activeList.length} modules</Text>
                  </View>
                </View>
                <View style={g.moduleList}>
                  {activeList.length === 0 ? (
                    <View style={g.emptyBox}>
                      <Text style={g.emptyEmoji}>📭</Text>
                      <Text style={g.emptyText}>No modules yet.</Text>
                    </View>
                  ) : activeList.map((mod, idx) => (
                    <TouchableOpacity key={mod.id}
                      style={[g.moduleCard, { borderColor: c.border }]}
                      onPress={() => onModulePress(mod)} activeOpacity={0.82}>
                      <View style={[g.moduleNum, { backgroundColor: c.light }]}>
                        <Text style={[g.moduleNumTxt, { color: c.color }]}>{idx + 1}</Text>
                      </View>
                      <View style={g.moduleInfo}>
                        <Text style={g.moduleTitle} numberOfLines={2}>{mod.title}</Text>
                        {mod.description ? <Text style={g.moduleDesc} numberOfLines={1}>{mod.description}</Text> : null}
                      </View>
                      <View style={[g.moduleArrow, { backgroundColor: c.light }]}>
                        <Text style={[g.moduleArrowTxt, { color: c.color }]}>›</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ height: 28 }} />
              </>
            );
          })()}
        </ScrollView>
      )}
    </View>
  );
}

/* ── Profile Tab ──────────────────────────────────── */
function ProfileTab({ teacher, initials, onLogout, avatarUri, onAvatarChange }: {
  teacher: AuthUser | null;
  initials: string;
  onLogout: () => void;
  avatarUri: string | null;
  onAvatarChange: (uri: string) => void;
}) {
  const rows = [
    { label: 'Employee ID', value: teacher?.employee_id ?? '—', emoji: '🪪' },
    { label: 'Name',        value: teacher?.name        ?? '—', emoji: '👤' },
    { label: 'Email',       value: teacher?.email       ?? '—', emoji: '✉️' },
  ] as { label: string; value: string; emoji: string }[];

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
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      onAvatarChange(result.assets[0].uri);
    }
  };

  return (
    <ScrollView style={g.fill} showsVerticalScrollIndicator={false} contentContainerStyle={g.profileScroll}>

      {/* Header bar */}
      <View style={g.profileHeader}>
        <Text style={g.profileHeaderTitle}>Profile</Text>
      </View>

      {/* Avatar */}
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
        <Text style={g.profileName}>{teacher?.name ?? '—'}</Text>
        <Text style={g.profileEmail}>{teacher?.email ?? ''}</Text>
        <Text style={g.profileAvatarHint}>Tap photo to change</Text>
      </View>

      {/* Info menu card */}
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

      {/* Logout card */}
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

/* ── Styles ───────────────────────────────────────── */
const g = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0fdf4' },
  body: { flex: 1, backgroundColor: '#f0fdf4' },
  fill: { flex: 1, backgroundColor: 'transparent' },
  center: { paddingVertical: 48, alignItems: 'center' },

  navbar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
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
    backgroundColor: '#2e7d32',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  navLabel:       { fontSize: 10, color: '#a5d6a7', fontWeight: '500' },
  navLabelActive: { color: '#2e7d32', fontWeight: '700' },

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

  /* ── Course stack cards (home quick access) ── */
  courseStack: { paddingHorizontal: 18, gap: 12 },

  /* ── Course photo cards (home modules row — matches student home) ── */
  coursePhotoRow: { flexDirection: 'row', paddingHorizontal: 18, gap: 14 },
  coursePhotoCard: {
    flex: 1,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#a5d6a7',
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 7, elevation: 3,
  },
  coursePhotoWrap: { width: '100%', height: 90, backgroundColor: '#e8f5e9' },
  coursePhoto:     { width: '100%', height: '100%' },
  coursePhotoBadge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  coursePhotoBadgeDot:  { width: 7, height: 7, borderRadius: 4 },
  coursePhotoBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  coursePhotoBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  coursePhotoBannerTitle: { fontSize: 14, fontWeight: '800', color: '#fff', flex: 1 },
  coursePhotoBannerEmoji: { fontSize: 18 },
  coursePhotoBody: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8 },
  coursePhotoName: { fontSize: 13, fontWeight: '800', color: '#1b5e20', marginBottom: 2 },
  coursePhotoSub:  { fontSize: 10, color: '#4a7c59', lineHeight: 14 },
  courseStackCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 18, borderWidth: 1.5, padding: 16, overflow: 'hidden',
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 2 },
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
  courseStackSub:      { fontSize: 12, color: '#4a7c59', marginTop: 3, lineHeight: 17 },
  courseStackArrow: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  courseStackArrowText: { fontSize: 20, fontWeight: '700', lineHeight: 22 },

  /* ── Student Progress card (no image) ── */
  spCard: {
    marginHorizontal: 18, marginTop: 12,
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#c5e1a5',
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
  },
  spInner: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 16, gap: 12,
  },
  spIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: '#1b5e20',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  spContent: { flex: 1, gap: 6 },
  spTitleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8,
  },
  spTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  spBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1, borderColor: '#c5e1a5',
  },
  spBadgeText: { color: '#1b5e20', fontSize: 10, fontWeight: '700' },
  spSectionRow: { flexDirection: 'row', gap: 5 },
  spSecChip: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8, borderWidth: 1, borderColor: '#c5e1a5',
    paddingHorizontal: 7, paddingVertical: 2,
  },
  spSecChipText: { fontSize: 10, fontWeight: '700', color: '#2e7d32' },
  spStudentCount: { fontSize: 11, fontWeight: '800', color: '#1b5e20', minWidth: 70 },
  spArrow: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#e8f5e9',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  /* ── Home progress bar ── */
  homeProgressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  homeProgressTrack: { flex: 1, height: 5, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' },
  homeProgressFill:  { height: '100%', borderRadius: 3 },
  homeProgressLabel: { fontSize: 11, fontWeight: '700' },

  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#e8f5e9',
  },
  panelTitle: { fontSize: 16, fontWeight: '800', color: '#1b5e20' },
  panelSub:   { fontSize: 12, color: '#a5d6a7' },

  /* ── Students Tab: rich header ── */
  stHeader: {
    backgroundColor: '#1b5e20',
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16,
    gap: 12,
  },
  stHeaderInner: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  stHeaderLeft:  { flex: 1, gap: 3 },
  stHeaderTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff', letterSpacing: -0.3 },
  stHeaderSub:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  stHeaderBadge: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  stHeaderBadgeNum:   { fontSize: 22, fontWeight: '900', color: '#fff', lineHeight: 26 },
  stHeaderBadgeLabel: { fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  stSummaryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  stSummaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 5,
  },
  stSummaryChipText:  { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  stSummaryChipDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  stSummaryChipCount: { fontSize: 11, color: '#fff', fontWeight: '800' },

  secTabsScroll: { flexGrow: 0 },
  secTabsRow: {
    flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, gap: 8,
    backgroundColor: '#fff',
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  secTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#c5e1a5',
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#f1f8e9',
  },
  secTabLabel:     { fontSize: 12, fontWeight: '600', color: '#4a7c59' },
  secTabBadge: {
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#c5e1a5',
  },
  secTabBadgeText: { fontSize: 10, fontWeight: '800', color: '#4a7c59' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#e8f5e9',
    backgroundColor: '#fff',
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#c5e1a5',
    borderRadius: 14, paddingHorizontal: 10, height: 42, gap: 6,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1b5e20', padding: 0 },
  searchClearBtn: { padding: 2 },
  searchCountPill: {
    backgroundColor: '#1b5e20', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
    minWidth: 30, alignItems: 'center',
  },
  searchCountText: { fontSize: 12, color: '#fff', fontWeight: '800' },

  studentCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1.5,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  studentCardAccent: { width: 4, alignSelf: 'stretch' },
  studentAvatar:    { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  studentAvatarTxt: { fontSize: 17, fontWeight: '900', color: '#fff' },
  studentInfo:      { flex: 1, paddingVertical: 12, paddingLeft: 10 },
  studentName:      { fontSize: 14, fontWeight: '800', color: '#1b5e20' },
  studentMeta:      { fontSize: 11, color: '#4a7c59', marginTop: 1, fontWeight: '600' },
  studentEmail:     { fontSize: 10, color: '#a5d6a7', marginTop: 1 },
  studentRight:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12 },
  studentArrowWrap: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  secPill:          { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  secPillTxt:       { fontSize: 10, fontWeight: '800', color: '#fff' },

  courseTabsBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e8f5e9',
  },
  courseTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#c5e1a5',
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#f1f8e9',
  },
  courseTabEmoji:  { fontSize: 22 },
  courseTabLabel:  { fontSize: 13, fontWeight: '700', color: '#1b5e20' },
  courseTabCount:  { fontSize: 11, color: '#a5d6a7', marginTop: 1 },
  courseTabDot:    { width: 8, height: 8, borderRadius: 4 },

  courseBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    borderRadius: 16, borderWidth: 1.5, padding: 16, overflow: 'hidden',
  },
  courseBannerAccent:   { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  courseBannerEmoji:    { fontSize: 28, marginLeft: 8 },
  courseBannerLabel:    { fontSize: 15, fontWeight: '800' },
  courseBannerSub:      { fontSize: 11, color: '#4a7c59', marginTop: 2, lineHeight: 16 },
  courseBannerBadge:    { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  courseBannerBadgeTxt: { fontSize: 12, fontWeight: '700' },

  moduleList: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  moduleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 14,
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 1,
  },
  moduleNum:     { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  moduleNumTxt:  { fontSize: 14, fontWeight: '800' },
  moduleInfo:    { flex: 1 },
  moduleTitle:   { fontSize: 14, fontWeight: '700', color: '#1b5e20', lineHeight: 20 },
  moduleDesc:    { fontSize: 11, color: '#a5d6a7', marginTop: 3 },
  moduleArrow:   { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  moduleArrowTxt:{ fontSize: 20, fontWeight: '700' },

  emptyBox:      { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyEmoji:    { fontSize: 40 },
  emptyText:     { fontSize: 14, color: '#4a7c59' },
  emptyPick:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyPickEmoji:{ fontSize: 48 },
  emptyPickText: { fontSize: 14, color: '#a5d6a7', fontWeight: '500' },

  profileScroll:    { flexGrow: 1, backgroundColor: '#e8f5e9' },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#e8f5e9', paddingHorizontal: 18, paddingVertical: 16,
  },
  profileHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#1b5e20' },
  profileAvatarSection: { alignItems: 'center', paddingBottom: 28, paddingTop: 24, gap: 6, backgroundColor: '#e8f5e9', marginBottom: 8 },
  profileAvatarWrap: { position: 'relative', marginBottom: 10 },
  profileAvatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#a5d6a7',
    backgroundColor: '#2e7d32',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  profileAvatarTxt: { fontSize: 34, fontWeight: '800', color: '#ffffff' },
  profileAvatarImg:  { width: 100, height: 100, borderRadius: 50 },
  profileAvatarHint: { fontSize: 11, color: '#a5d6a7', marginTop: 2 },
  profileEditBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#a5d6a7',
    alignItems: 'center', justifyContent: 'center',
  },
  profileEditIcon:  { fontSize: 14 },
  profileName:      { fontSize: 20, fontWeight: '800', color: '#1b5e20' },
  profileEmail:     { fontSize: 13, color: '#4a7c59' },
  profileBody:      { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 40, gap: 14 },
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
  profileLogoutCard: {
    marginHorizontal: 18, marginBottom: 12,
    backgroundColor: '#fff5f5', borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 18, paddingVertical: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  profileLogoutText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#dc2626' },

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
});
