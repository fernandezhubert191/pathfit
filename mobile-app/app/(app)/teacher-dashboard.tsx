import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity,
  useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

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
  pathfit1: { label: 'Pathfit 1', sub: 'Movement Enhancement',  emoji: '🏃', color: '#1c7ed6', light: '#eff6ff', border: '#bfdbfe' },
  pathfit2: { label: 'Pathfit 2', sub: 'Mobility Training',     emoji: '🧘', color: '#0ca678', light: '#ecfdf5', border: '#a7f3d0' },
} as const;

const SEC_COLOR:  Record<string, string> = { A: '#7c3aed', B: '#1c7ed6', C: '#0ca678', D: '#d97706' };
const SEC_BG:     Record<string, string> = { A: '#f5f3ff', B: '#eff6ff', C: '#ecfdf5', D: '#fffbeb' };
const SEC_BORDER: Record<string, string> = { A: '#ddd6fe', B: '#bfdbfe', C: '#a7f3d0', D: '#fde68a' };

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
      <StatusBar barStyle="dark-content" backgroundColor="#ecfdf5" />
      <View style={g.body}>
        {activeTab === 'home' && (
          <HomeTab teacher={teacher} initials={initials}
            avatarUri={avatarUri}
            students={students} modules={modules}
            refreshing={refreshing} onRefresh={onRefresh}
            onGoStudents={() => setActiveTab('students')}
            onGoModules={() => { setActiveCourse(null); setActiveTab('modules'); }} />
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

/* ── Home Tab ─────────────────────────────────────── */
function HomeTab({ teacher, initials, avatarUri, students, modules, refreshing, onRefresh, onGoStudents, onGoModules }: {
  teacher: AuthUser | null; initials: string; avatarUri: string | null;
  students: Student[]; modules: Module[];
  refreshing: boolean; onRefresh: () => void;
  onGoStudents: () => void; onGoModules: () => void;
}) {
  return (
    <ScrollView style={g.fill} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ca678" />}>
      {/* ── Hero background ── */}
      <View style={g.heroBg}>
        {/* ── Greeting header ── */}
        <TouchableOpacity style={g.greetHeader} activeOpacity={0.85}>
          {avatarUri
            ? <Image source={{ uri: avatarUri }} style={g.greetAvatarImg} />
            : <Text style={g.greetAvatarTxt}>{initials}</Text>
          }
          <Text style={g.greetTimeText}>{getGreeting()}, <Text style={g.greetName}>{teacher?.name ?? '—'} 👋</Text></Text>
        </TouchableOpacity>
        {/* ── Teacher Banner Carousel ── */}
        <TeacherBannerCarousel />
      </View>

      <View style={g.sectionRow}><Text style={g.sectionTitle}>Quick Access</Text></View>
      <View style={g.quickStack}>
        <TouchableOpacity style={[g.quickCard, { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' }]}
          onPress={onGoModules} activeOpacity={0.82}>
          <View style={[g.quickAccent, { backgroundColor: '#0ca678' }]} />
          <View style={[g.quickIcon, { borderColor: '#a7f3d0' }]}><Text style={g.quickEmoji}>📚</Text></View>
          <View style={g.quickInfo}>
            <Text style={[g.quickTitle, { color: '#0ca678' }]}>Modules</Text>
            <Text style={g.quickSub}>{modules.length} modules · Pathfit 1 & 2</Text>
          </View>
          <View style={[g.quickArrow, { backgroundColor: '#0ca678' }]}><Text style={g.quickArrowTxt}>›</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={[g.quickCard, { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }]}
          onPress={onGoStudents} activeOpacity={0.82}>
          <View style={[g.quickAccent, { backgroundColor: '#1c7ed6' }]} />
          <View style={[g.quickIcon, { borderColor: '#bfdbfe' }]}><Text style={g.quickEmoji}>🎓</Text></View>
          <View style={g.quickInfo}>
            <Text style={[g.quickTitle, { color: '#1c7ed6' }]}>Manage Student Progress</Text>
            <Text style={g.quickSub}>{students.length} students · sections A B C D</Text>
          </View>
          <View style={[g.quickArrow, { backgroundColor: '#1c7ed6' }]}><Text style={g.quickArrowTxt}>›</Text></View>
        </TouchableOpacity>
      </View>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/* ── Teacher Banner Carousel ─────────────────────── */
const T_BANNERS = [
  {
    tag: '👩‍🏫 Manage Classes',
    title: 'Track\nStudent Progress',
    sub: 'View completion rates and quiz scores for all your students.',
    gradient: ['#00695c', '#00897b', '#26a69a'] as const,
    tagBg: 'rgba(255,255,255,0.26)',
    emojiWrapBg: 'rgba(255,255,255,0.2)',
    dotColor: '#00897b',
    emoji: '📊',
  },
  {
    tag: '📚 Course Content',
    title: 'Pathfit 1\n& 2 Modules',
    sub: 'Review and manage all Movement Enhancement and Mobility Training lessons.',
    gradient: ['#1565c0', '#1e88e5', '#42a5f5'] as const,
    tagBg: 'rgba(255,255,255,0.28)',
    emojiWrapBg: 'rgba(255,255,255,0.22)',
    dotColor: '#1e88e5',
    emoji: '📖',
  },
  {
    tag: '🎓 Sections A–D',
    title: 'Monitor\nYour Class',
    sub: 'Filter students by section and check individual performance at a glance.',
    gradient: ['#4527a0', '#7b1fa2', '#ab47bc'] as const,
    tagBg: 'rgba(255,255,255,0.24)',
    emojiWrapBg: 'rgba(255,255,255,0.18)',
    dotColor: '#7b1fa2',
    emoji: '🏫',
  },
];

function TeacherBannerCarousel() {
  const { width } = useWindowDimensions();
  const CARD_W = width - 36;
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % T_BANNERS.length;
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
          setActive(Math.max(0, Math.min(idx, T_BANNERS.length - 1)));
        }}
      >
        {T_BANNERS.map((b, i) => (
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
        {T_BANNERS.map((b, i) => (
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
  return (
    <View style={g.fill}>
      <View style={g.panelHeader}>
        <Text style={g.panelTitle}>Manage Student Progress</Text>
        <Text style={g.panelSub}>{students.length} enrolled</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={g.secTabsScroll} contentContainerStyle={g.secTabsRow}>
        {SECTIONS.map(sec => {
          const active  = activeSection === sec;
          const count   = sec === 'All' ? students.length : students.filter(s => s.section === sec).length;
          const color   = sec === 'All' ? '#0ca678' : SEC_COLOR[sec];
          const bg      = sec === 'All' ? '#ecfdf5'  : SEC_BG[sec];
          const border  = sec === 'All' ? '#a7f3d0'  : SEC_BORDER[sec];
          return (
            <TouchableOpacity key={sec} activeOpacity={0.8}
              style={[g.secTab, active && { backgroundColor: bg, borderColor: border }]}
              onPress={() => setActiveSection(sec)}>
              <Text style={[g.secTabLabel, active && { color, fontWeight: '700' }]}>
                {sec === 'All' ? 'All' : `Sec ${sec}`}
              </Text>
              <View style={[g.secTabBadge, active && { backgroundColor: border }]}>
                <Text style={[g.secTabBadgeText, active && { color }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={g.searchWrap}>
        <View style={g.searchBox}>
          <Text style={g.searchIcon}>🔍</Text>
          <TextInput style={g.searchInput} placeholder="Search name, ID or email…"
            placeholderTextColor="#94a3b8" value={search} onChangeText={setSearch} />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={g.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={g.resultCount}>{filtered.length}</Text>
      </View>
      {loading ? (
        <View style={g.center}><ActivityIndicator size="large" color="#0ca678" /></View>
      ) : (
        <ScrollView style={g.fill} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ca678" />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 10, paddingBottom: 24 }}>
          {filtered.length === 0 ? (
            <View style={g.emptyBox}>
              <Text style={g.emptyEmoji}>🎓</Text>
              <Text style={g.emptyText}>
                {search ? 'No students match.' : activeSection === 'All' ? 'No students yet.' : `No students in Sec ${activeSection}.`}
              </Text>
            </View>
          ) : filtered.map(st => {
            const sec    = st.section ?? '';
            const color  = SEC_COLOR[sec]  ?? '#64748b';
            const bg     = SEC_BG[sec]     ?? '#f8fafc';
            const border = SEC_BORDER[sec] ?? '#e2e8f0';
            return (
              <TouchableOpacity key={st.id}
                style={[g.studentCard, { borderColor: border, backgroundColor: bg }]}
                onPress={() => onStudentPress(st)} activeOpacity={0.82}>
                <View style={[g.studentAvatar, { backgroundColor: color }]}>
                  <Text style={g.studentAvatarTxt}>{st.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={g.studentInfo}>
                  <Text style={g.studentName}>{st.name}</Text>
                  <Text style={g.studentMeta}>{st.student_id} · {st.email}</Text>
                </View>
                {sec ? (
                  <View style={[g.secPill, { backgroundColor: color }]}>
                    <Text style={g.secPillTxt}>Sec {sec}</Text>
                  </View>
                ) : null}
                <Text style={{ fontSize: 18, color: '#94a3b8', marginLeft: 4 }}>›</Text>
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
        <View style={g.center}><ActivityIndicator size="large" color="#0ca678" /></View>
      ) : (
        <ScrollView style={g.fill} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ca678" />}>
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
  safe: { flex: 1, backgroundColor: '#f0fdf9' },
  body: { flex: 1, backgroundColor: '#f0fdf9' },
  fill: { flex: 1, backgroundColor: 'transparent' },
  center: { paddingVertical: 48, alignItems: 'center' },

  navbar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
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
    backgroundColor: '#0ca678',
    shadowColor: '#0ca678',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  navLabel:       { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  navLabelActive: { color: '#0ca678', fontWeight: '700' },

  /* ── Hero background ── */
  heroBg: {
    backgroundColor: '#ecfdf5',
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    overflow: 'hidden',
    paddingBottom: 8,
    shadowColor: '#0ca678', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 5,
  },

  greetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 18,
  },
  greetTimeText:  { flex: 1, fontSize: 14, color: '#475569', fontWeight: '500' },
  greetName:      { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  greetAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#0ca678', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#0ca678', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  greetAvatarTxt: {
    width: 46, height: 46, borderRadius: 23, lineHeight: 46,
    textAlign: 'center', textAlignVertical: 'center',
    fontSize: 17, fontWeight: '800', color: '#fff',
    backgroundColor: '#0ca678',
    overflow: 'hidden',
    shadowColor: '#0ca678', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  greetAvatarImg: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },

  sectionRow:   { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 18, gap: 10 },
  statCard: {
    flex: 1, alignItems: 'center', borderRadius: 18, borderWidth: 1.5,
    paddingVertical: 16, overflow: 'hidden', gap: 2,
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  statAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  statEmoji:  { fontSize: 22 },
  statNum:    { fontSize: 22, fontWeight: '900' },
  statLabel:  { fontSize: 10, fontWeight: '700', marginTop: 2 },

  quickStack: { paddingHorizontal: 18, gap: 12, paddingTop: 4 },
  quickCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 18, borderWidth: 1.5, padding: 16, overflow: 'hidden',
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09, shadowRadius: 6, elevation: 2,
  },
  quickAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  quickIcon: {
    width: 52, height: 52, borderRadius: 15, borderWidth: 1.5,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  quickEmoji:    { fontSize: 26 },
  quickInfo:     { flex: 1 },
  quickTitle:    { fontSize: 16, fontWeight: '800' },
  quickSub:      { fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 17 },
  quickArrow:    { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickArrowTxt: { fontSize: 20, fontWeight: '700', color: '#fff', lineHeight: 22 },

  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  panelTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  panelSub:   { fontSize: 12, color: '#94a3b8' },

  secTabsScroll: { flexGrow: 0 },
  secTabsRow:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  secTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f8fafc',
  },
  secTabLabel:     { fontSize: 12, fontWeight: '600', color: '#64748b' },
  secTabBadge:     { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: '#e2e8f0' },
  secTabBadgeText: { fontSize: 11, fontWeight: '700', color: '#64748b' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 10, height: 40, gap: 6,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a', padding: 0 },
  clearBtn:    { fontSize: 13, color: '#94a3b8' },
  resultCount: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  studentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  studentAvatar:    { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  studentAvatarTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  studentInfo:      { flex: 1 },
  studentName:      { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  studentMeta:      { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  secPill:          { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  secPillTxt:       { fontSize: 11, fontWeight: '700', color: '#fff' },

  courseTabsBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  courseTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#f8fafc',
  },
  courseTabEmoji:  { fontSize: 22 },
  courseTabLabel:  { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  courseTabCount:  { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  courseTabDot:    { width: 8, height: 8, borderRadius: 4 },

  courseBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    borderRadius: 16, borderWidth: 1.5, padding: 16, overflow: 'hidden',
  },
  courseBannerAccent:   { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  courseBannerEmoji:    { fontSize: 28, marginLeft: 8 },
  courseBannerLabel:    { fontSize: 15, fontWeight: '800' },
  courseBannerSub:      { fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 16 },
  courseBannerBadge:    { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  courseBannerBadgeTxt: { fontSize: 12, fontWeight: '700' },

  moduleList: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  moduleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 14,
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 1,
  },
  moduleNum:     { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  moduleNumTxt:  { fontSize: 14, fontWeight: '800' },
  moduleInfo:    { flex: 1 },
  moduleTitle:   { fontSize: 14, fontWeight: '700', color: '#0f172a', lineHeight: 20 },
  moduleDesc:    { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  moduleArrow:   { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  moduleArrowTxt:{ fontSize: 20, fontWeight: '700' },

  emptyBox:      { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyEmoji:    { fontSize: 40 },
  emptyText:     { fontSize: 14, color: '#94a3b8' },
  emptyPick:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyPickEmoji:{ fontSize: 48 },
  emptyPickText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },

  profileScroll:    { flexGrow: 1, backgroundColor: '#f1f5f9' },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f1f5f9', paddingHorizontal: 18, paddingVertical: 16,
  },
  profileHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  profileAvatarSection: { alignItems: 'center', paddingBottom: 28, gap: 6 },
  profileAvatarWrap: { position: 'relative', marginBottom: 10 },
  profileAvatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#ffffff',
    backgroundColor: '#0ca678',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  profileAvatarTxt: { fontSize: 34, fontWeight: '800', color: '#ffffff' },
  profileAvatarImg:  { width: 100, height: 100, borderRadius: 50 },
  profileAvatarHint: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  profileEditBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#0ca678', borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  profileEditIcon:  { fontSize: 14 },
  profileName:      { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  profileEmail:     { fontSize: 13, color: '#64748b' },
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
  bannerWrap:    { marginHorizontal: 18, marginTop: 8, gap: 10 },
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
  bannerDots:        { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 4 },
  bannerDot:         { height: 7, borderRadius: 4 },
  bannerDotActive:   { width: 22 },
  bannerDotInactive: { width: 7, backgroundColor: '#cbd5e1' },
});
