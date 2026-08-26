import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Modal, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';

import { API, toDirectUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { fetchWithTimeout } from '@/lib/request';

/* ── Types ──────────────────────────────────────── */
type ModuleRow = {
  id: number;
  title: string;
  course: string;
  completed: boolean;
  exercise_video: { url: string; uploaded_at: string } | null;
};
type QuizResult = {
  moduleId: number;
  moduleTitle: string;
  course: 'pathfit1' | 'pathfit2';
  attempt: number;
  score: number;
  total: number;
  percent: number;
  takenAt: string;
};
type StudentInfo = {
  id: number;
  name: string;
  student_id: string;
  section: string | null;
  email: string;
};

const COURSES = [
  { key: 'pathfit1', label: 'Pathfit 1', emoji: '🏃', color: '#1b5e20', light: '#e8f5e9', border: '#a5d6a7' },
  { key: 'pathfit2', label: 'Pathfit 2', emoji: '🧘', color: '#2e7d32', light: '#f1f8e9', border: '#c5e1a5' },
] as const;

/* ══════════════════════════════════════════════ */
export default function StudentProgressScreen() {
  const router = useRouter();
  const { studentId, studentName } =    useLocalSearchParams<{ studentId: string; studentName: string }>();

  const [student, setStudent]   = useState<StudentInfo | null>(null);
  const [modules, setModules]   = useState<ModuleRow[]>([]);
  const [scores, setScores]     = useState<QuizResult[]>([]);
  const [tab, setTab]           = useState<'lessons' | 'quizzes' | 'videos'>('lessons');
  const [pathTab, setPathTab]   = useState<'pathfit1' | 'pathfit2'>('pathfit1');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const toggleGroup = (moduleId: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetchWithTimeout(
        `${API}/students/${studentId}/progress`,
        { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setStudent(data.student);
        setModules(data.modules ?? []);
        setScores(data.quiz_results ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [studentId]);

  const completedCount = modules.filter(m => m.completed).length;
  const videoCount     = modules.filter(m => m.exercise_video).length;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#1b5e20" />

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.9)" />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={s.topTitle} numberOfLines={1}>Student Progress</Text>
        </View>
        <View style={{ width: 72 }} />
      </View>

      {/* Student profile card */}
      {!loading && (
        <View style={s.profileCard}>
          <View style={s.profileCardRow}>
            <View style={s.profileCardAvatar}>
              <Text style={s.profileCardInitials}>
                {(student?.name ?? studentName ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={s.profileCardInfo}>
              <Text style={s.profileCardName} numberOfLines={1}>
                {student?.name ?? studentName ?? '—'}
              </Text>
              <Text style={s.profileCardMeta}>
                {student?.student_id ?? ''}
                {student?.section ? ` · Sec ${student.section}` : ''}
                {student?.email ? `  ·  ${student.email}` : ''}
              </Text>
            </View>
          </View>
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#0ca678" /></View>
      ) : (
        <>
          {/* Tab switcher */}
          <View style={s.tabs}>
            <TouchableOpacity
              style={[s.tab, tab === 'lessons' && s.tabActive]}
              onPress={() => setTab('lessons')} activeOpacity={0.8}>
              <Text style={[s.tabText, tab === 'lessons' && s.tabTextActive]}>
                📚 Lessons ({completedCount}/{modules.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, tab === 'quizzes' && s.tabActiveGreen]}
              onPress={() => setTab('quizzes')} activeOpacity={0.8}>
              <Text style={[s.tabText, tab === 'quizzes' && s.tabTextActiveGreen]}>
                🏆 Quizzes ({scores.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, tab === 'videos' && s.tabActiveViolet]}
              onPress={() => setTab('videos')} activeOpacity={0.8}>
              <Text style={[s.tabText, tab === 'videos' && s.tabTextActiveViolet]}>
                🎬 Videos ({videoCount})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0ca678" />
            }
          >
            {/* ── Lessons tab ── */}
            {tab === 'lessons' && (
              <View>
                {/* Path tab switcher */}
                <View style={s.pathTabs}>
                  {COURSES.map(c => {
                    const isActive = pathTab === c.key;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        style={[
                          s.pathTab,
                          isActive && { backgroundColor: c.color, borderColor: c.color },
                        ]}
                        onPress={() => setPathTab(c.key)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.pathTabEmoji}>{c.emoji}</Text>
                        <Text style={[s.pathTabText, isActive && s.pathTabTextActive]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Content for the active path */}
                {(() => {
                  const c    = COURSES.find(x => x.key === pathTab)!;
                  const list = modules.filter(m => m.course === c.key);

                  if (list.length === 0) {
                    return (
                      <View style={s.emptyWrap}>
                        <Text style={s.emptyEmoji}>📭</Text>
                        <Text style={s.emptyText}>No modules available.</Text>
                      </View>
                    );
                  }

                  const done = list.filter(m => m.completed).length;
                  const pct  = list.length > 0 ? done / list.length : 0;

                  return (
                    <View style={s.section}>
                      {/* Course header */}
                      <View style={[s.courseHeader, { backgroundColor: c.light, borderColor: c.border }]}>
                        <Text style={s.courseEmoji}>{c.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.courseLabel, { color: c.color }]}>{c.label}</Text>
                          <View style={s.progressRow}>
                            <View style={s.progressTrack}>
                              <View style={[s.progressFill, { backgroundColor: c.color, width: `${pct * 100}%` as any }]} />
                            </View>
                            <Text style={[s.progressCount, { color: c.color }]}>{done}/{list.length}</Text>
                          </View>
                        </View>
                        {done === list.length && list.length > 0 && (
                          <View style={[s.doneBadge, { backgroundColor: c.color }]}>
                            <Text style={s.doneBadgeText}>✓ Done</Text>
                          </View>
                        )}
                      </View>

                      {/* Module rows */}
                      <View style={s.list}>
                        {list.map((m, idx) => (
                          <View key={m.id}>
                            {/* ── Module status row ── */}
                            <View style={[
                              s.row,
                              m.completed
                                ? { borderColor: c.border }
                                : s.rowPending,
                            ]}>
                              <View style={[s.rowAccent, { backgroundColor: m.completed ? c.color : '#e2e8f0' }]} />
                              <View style={[s.numWrap, { backgroundColor: m.completed ? c.color : '#e2e8f0' }]}>
                                {m.completed
                                  ? <Text style={s.checkIcon}>✓</Text>
                                  : <Text style={[s.numText, { color: '#94a3b8' }]}>{idx + 1}</Text>
                                }
                              </View>
                              <View style={s.rowBody}>
                                <Text style={[s.rowTitle, !m.completed && { color: '#94a3b8' }]}>
                                  {m.title}
                                </Text>
                                <Text style={[s.statusText, { color: m.completed ? c.color : '#cbd5e1' }]}>
                                  {m.completed ? '✓ Completed' : 'Pending'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* ── Quizzes tab ── */}
            {tab === 'quizzes' && (
              <View>
                {/* Path tab switcher */}
                <View style={s.pathTabs}>
                  {COURSES.map(c => {
                    const isActive = pathTab === c.key;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        style={[
                          s.pathTab,
                          isActive && { backgroundColor: c.color, borderColor: c.color },
                        ]}
                        onPress={() => setPathTab(c.key)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.pathTabEmoji}>{c.emoji}</Text>
                        <Text style={[s.pathTabText, isActive && s.pathTabTextActive]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Content for the active path */}
                {(() => {
                  const c = COURSES.find(x => x.key === pathTab)!;
                  const map = new Map<number, QuizResult[]>();
                  scores.filter(sc => sc.course === c.key).forEach(sc => {
                    if (!map.has(sc.moduleId)) map.set(sc.moduleId, []);
                    map.get(sc.moduleId)!.push(sc);
                  });
                  const groups = Array.from(map.entries()).map(([moduleId, attempts]) => ({
                    moduleId,
                    moduleTitle: attempts[0].moduleTitle,
                    attempts: [...attempts].sort((a, b) => a.attempt - b.attempt),
                  }));

                  if (groups.length === 0) {
                    return (
                      <View style={s.emptyWrap}>
                        <Text style={s.emptyEmoji}>🏆</Text>
                        <Text style={s.emptyText}>No quizzes taken yet.</Text>
                      </View>
                    );
                  }

                  return (
                    <View style={s.section}>
                      {/* Course header */}
                      <View style={[s.courseHeader, { backgroundColor: c.light, borderColor: c.border }]}>
                        <Text style={s.courseEmoji}>{c.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.courseLabel, { color: c.color }]}>{c.label}</Text>
                          <Text style={[s.courseCount, { color: c.color }]}>
                            {groups.length} {groups.length === 1 ? 'quiz' : 'quizzes'}
                          </Text>
                        </View>
                      </View>

                      <View style={s.list}>
                        {groups.map(group => {
                          const bestPct   = Math.max(...group.attempts.map(a => a.percent));
                          const isExpanded = expandedGroups.has(group.moduleId);
                          const latestAttempt = [...group.attempts].sort((a, b) => b.attempt - a.attempt)[0];
                          const latestOk = latestAttempt.percent >= 75;
                          return (
                            <View key={group.moduleId} style={s.moduleBlock}>
                              {/* Module title bar — tappable to expand/collapse */}
                              <TouchableOpacity
                                style={[s.moduleBar, { backgroundColor: c.light }]}
                                onPress={() => toggleGroup(group.moduleId)}
                                activeOpacity={0.75}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={s.moduleBarTitle} numberOfLines={1}>{group.moduleTitle}</Text>
                                  {!isExpanded && (
                                    <Text style={[s.moduleBarLatest, { color: latestOk ? c.color : '#dc2626' }]}>
                                      Latest: {latestAttempt.percent}% ({latestAttempt.score}/{latestAttempt.total}) · Attempt {latestAttempt.attempt}
                                    </Text>
                                  )}
                                </View>
                                <View style={[s.moduleBarCountPill, { backgroundColor: c.color }]}>
                                  <Text style={s.moduleBarCountText}>
                                    {group.attempts.length} {group.attempts.length === 1 ? 'attempt' : 'attempts'}
                                  </Text>
                                </View>
                                <View style={[s.moduleBarToggle, { backgroundColor: isExpanded ? c.color : c.border }]}>
                                  <Ionicons
                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                    size={13}
                                    color={isExpanded ? '#fff' : c.color}
                                  />
                                </View>
                              </TouchableOpacity>

                              {/* Attempt rows — collapsed by default, expand on tap */}
                              {isExpanded && [...group.attempts].reverse().map(score => {
                                const ok     = score.percent >= 75;
                                const isBest = score.percent === bestPct;
                                return (
                                  <TouchableOpacity
                                    key={`${score.moduleId}-${score.attempt}`}
                                    style={[s.attemptRow, { borderTopColor: ok ? c.border : '#fecaca' }]}
                                    activeOpacity={0.75}
                                    onPress={() => router.push({
                                      pathname: '/(app)/quiz-result-detail',
                                      params: {
                                        moduleTitle: score.moduleTitle,
                                        attempt:     String(score.attempt),
                                        score:       String(score.score),
                                        total:       String(score.total),
                                        percent:     String(score.percent),
                                        takenAt:     score.takenAt,
                                        course:      score.course,
                                      },
                                    })}
                                  >
                                    {/* Score badge */}
                                    <View style={[s.badge, {
                                      backgroundColor: ok ? c.light : '#fef2f2',
                                      borderColor:     ok ? c.border : '#fecaca',
                                    }]}>
                                      <Text style={[s.badgePct, { color: ok ? c.color : '#dc2626' }]}>
                                        {score.percent}%
                                      </Text>
                                      <Text style={[s.badgeFrac, { color: ok ? c.color : '#fca5a5' }]}>
                                        {score.score}/{score.total}
                                      </Text>
                                    </View>

                                    {/* Info */}
                                    <View style={{ flex: 1 }}>
                                      <View style={s.attemptLabelRow}>
                                        <Text style={s.attemptLabel}>Attempt {score.attempt}</Text>
                                        {isBest && group.attempts.length > 1 && (
                                          <View style={[s.bestBadge, { backgroundColor: c.color }]}>
                                            <Text style={s.bestBadgeText}>★ Best</Text>
                                          </View>
                                        )}
                                        {!ok && (
                                          <View style={s.failBadge}>
                                            <Text style={s.failBadgeText}>Below 75%</Text>
                                          </View>
                                        )}
                                      </View>
                                      <Text style={s.attemptDate}>
                                        {new Date(score.takenAt).toLocaleDateString('en-US', {
                                          month: 'short', day: 'numeric', year: 'numeric',
                                        })}
                                      </Text>
                                    </View>

                                    <View style={s.rowRight}>
                                      <Text style={{ fontSize: 16 }}>{ok ? '✅' : '❌'}</Text>
                                      <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* ── Videos tab ── */}
            {tab === 'videos' && (
              <View>
                {/* Path tab switcher */}
                <View style={s.pathTabs}>
                  {COURSES.map(c => {
                    const isActive = pathTab === c.key;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        style={[
                          s.pathTab,
                          isActive && { backgroundColor: c.color, borderColor: c.color },
                        ]}
                        onPress={() => setPathTab(c.key)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.pathTabEmoji}>{c.emoji}</Text>
                        <Text style={[s.pathTabText, isActive && s.pathTabTextActive]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {(() => {
                  const c    = COURSES.find(x => x.key === pathTab)!;
                  const list = modules.filter(m => m.course === c.key && m.exercise_video);

                  if (list.length === 0) {
                    return (
                      <View style={s.emptyWrap}>
                        <Text style={s.emptyEmoji}>🎬</Text>
                        <Text style={s.emptyText}>No exercise videos submitted yet.</Text>
                      </View>
                    );
                  }

                  return (
                    <View style={s.section}>
                      {/* Course header */}
                      <View style={[s.courseHeader, { backgroundColor: c.light, borderColor: c.border }]}>
                        <Text style={s.courseEmoji}>{c.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.courseLabel, { color: c.color }]}>{c.label}</Text>
                          <Text style={[s.progressCount, { color: c.color, marginTop: 3 }]}>
                            {list.length} video{list.length !== 1 ? 's' : ''} submitted
                          </Text>
                        </View>
                      </View>

                      <View style={s.list}>
                        {list.map(m => (
                          <View key={m.id}>
                            {/* Module label row */}
                            <View style={[s.videoModuleHeader, { backgroundColor: c.light, borderColor: c.border }]}>
                              <View style={[s.numWrap, { backgroundColor: c.color }]}>
                                <Text style={s.checkIcon}>▶</Text>
                              </View>
                              <Text style={[s.rowTitle, { color: c.color, flex: 1 }]} numberOfLines={2}>
                                {m.title}
                              </Text>
                            </View>
                            {/* Video card — collapsible */}
                            <ExerciseVideoCard
                              url={m.exercise_video!.url}
                              uploadedAt={m.exercise_video!.uploaded_at}
                              accentColor={c.color}
                              accentBorder={c.border}
                              accentLight={c.light}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })()}
              </View>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════════════════
   Exercise Video Card — teacher view, always expanded
══════════════════════════════════════════════════════ */
function ExerciseVideoCardExpanded({ url, uploadedAt, accentColor, accentBorder, accentLight }: {
  url: string;
  uploadedAt: string;
  accentColor: string;
  accentBorder: string;
  accentLight: string;
}) {
  const directUrl = toDirectUrl(url);
  const dateStr = new Date(uploadedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <View style={[ev.card, { borderColor: accentBorder, backgroundColor: '#fff', borderTopWidth: 1.5, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
      <View style={[ev.player, { height: VIDEO_HEIGHT }]}>
        <WebView
          source={{ html: buildVideoHtml(directUrl) }}
          style={{ flex: 1, backgroundColor: '#000' }}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
        />
      </View>
      <View style={[ev.footer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Text style={[ev.footerText, { color: accentColor }]}>
          📅 Submitted {dateStr}
        </Text>
        <View style={[ev.submittedBadge, { backgroundColor: accentLight, borderColor: accentBorder }]}>
          <Text style={[ev.submittedBadgeText, { color: accentColor }]}>✓ Submitted</Text>
        </View>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   Exercise Video Card — teacher view of student upload
══════════════════════════════════════════════════════ */
const VIDEO_HEIGHT = Math.round((Dimensions.get('window').width - 32) * (9 / 16));

function buildVideoHtml(src: string): string {
  const safe = src.replace(/"/g, '&quot;');
  return `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      html,body{width:100%;height:100%;background:#000;overflow:hidden;}
      video{display:block;width:100%;height:100%;object-fit:contain;}
    </style></head><body>
    <video src="${safe}" controls playsinline preload="metadata"></video>
  </body></html>`;
}

function ExerciseVideoCard({ url, uploadedAt, accentColor, accentBorder, accentLight }: {
  url: string;
  uploadedAt: string;
  accentColor: string;
  accentBorder: string;
  accentLight: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const directUrl = toDirectUrl(url);
  const dateStr = new Date(uploadedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <View style={[ev.card, { borderColor: accentBorder, backgroundColor: accentLight }]}>
      {/* Collapsed header — tap to expand/collapse */}
      <TouchableOpacity
        style={ev.header}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.8}
      >
        <View style={[ev.iconWrap, { backgroundColor: accentColor }]}>
          <Text style={ev.icon}>🎬</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ev.title, { color: accentColor }]}>Exercise Video</Text>
          <Text style={ev.sub}>Submitted {dateStr}</Text>
        </View>
        <View style={[ev.chevronWrap, { backgroundColor: accentColor }]}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Expanded — show video player */}
      {expanded && (
        <View>
          <View style={ev.divider} />
          <View style={[ev.player, { height: VIDEO_HEIGHT }]}>
            <WebView
              source={{ html: buildVideoHtml(directUrl) }}
              style={{ flex: 1, backgroundColor: '#000' }}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              originWhitelist={['*']}
              mixedContentMode="always"
            />
          </View>
          <View style={ev.footer}>
            <Text style={[ev.footerText, { color: accentColor }]}>
              📅 Uploaded on {dateStr}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const ev = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  icon:    { fontSize: 15 },
  title:   { fontSize: 12, fontWeight: '800' },
  sub:     { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  chevronWrap: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  chevron:  { fontSize: 10, color: '#fff', fontWeight: '900' },
  divider:  { height: 1, backgroundColor: 'rgba(0,0,0,0.07)' },
  player:   { width: '100%', backgroundColor: '#0f172a' },
  footer: {
    paddingHorizontal: 12, paddingVertical: 8,
  },
  footerText: { fontSize: 11, fontWeight: '600' },
  submittedBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  submittedBadgeText: { fontSize: 10, fontWeight: '700' },
});

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f0fdf4' },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* ── Top bar ── */
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1b5e20', paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, width: 72 },
  backText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle:  { fontSize: 17, fontWeight: '900', color: '#ffffff' },
  topSub:    { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  /* ── Student profile card (below top bar) ── */
  profileCard: {
    backgroundColor: '#1b5e20',
    paddingHorizontal: 18, paddingBottom: 20, paddingTop: 4,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    shadowColor: '#1b5e20', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  profileCardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileCardAvatar: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  profileCardInitials: { fontSize: 22, fontWeight: '900', color: '#fff' },
  profileCardInfo: { flex: 1 },
  profileCardName:  { fontSize: 18, fontWeight: '900', color: '#fff' },
  profileCardMeta:  { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '600' },

  /* ── Tab switcher ── */
  tabs: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e8f5e9',
  },
  tab: {
    flex: 1, borderRadius: 14, paddingVertical: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#c5e1a5',
  },
  tabActive:          { backgroundColor: '#1b5e20', borderColor: '#1b5e20' },
  tabActiveGreen:     { backgroundColor: '#1b5e20', borderColor: '#1b5e20' },
  tabActiveViolet:    { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  tabText:            { fontSize: 11, fontWeight: '700', color: '#4a7c59' },
  tabTextActive:      { color: '#ffffff' },
  tabTextActiveGreen: { color: '#ffffff' },
  tabTextActiveViolet:{ color: '#ffffff' },

  section: { marginBottom: 4 },

  /* ── Course header ── */
  courseHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 14, marginTop: 14, marginBottom: 8,
    borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 13,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 5, elevation: 2,
  },
  courseEmoji:   { fontSize: 26 },
  courseLabel:   { fontSize: 15, fontWeight: '900' },
  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  progressTrack: { flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3 },
  progressCount: { fontSize: 11, fontWeight: '800', minWidth: 32 },
  doneBadge:     { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  doneBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  /* ── List ── */
  list: { paddingHorizontal: 14, gap: 8 },

  /* ── Lesson rows ── */
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5,
    backgroundColor: '#ffffff', overflow: 'hidden',
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  rowAccent:  { width: 4, alignSelf: 'stretch' },
  rowPending: { borderColor: '#e2e8f0', backgroundColor: '#fafafa' },
  numWrap:    { width: 34, height: 34, borderRadius: 10, flexShrink: 0, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  checkIcon:  { fontSize: 14, fontWeight: '900', color: '#ffffff' },
  numText:    { fontSize: 12, fontWeight: '800' },
  rowBody:    { flex: 1, paddingVertical: 12, paddingLeft: 10 },
  rowTitle:   { fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 18 },
  statusText: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  videoChip: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  videoChipText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  videoModuleHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    paddingHorizontal: 14, paddingVertical: 11,
  },

  /* ── Quiz course sections ── */
  courseCount: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  /* ── Quiz module blocks ── */
  moduleBlock: {
    borderRadius: 16, borderWidth: 1.5, borderColor: '#e2e8f0',
    overflow: 'hidden', backgroundColor: '#ffffff',
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 5, elevation: 2,
  },
  moduleBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  moduleBarTitle: { fontSize: 12, fontWeight: '800', color: '#0f172a', flex: 1 },
  moduleBarLatest: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  moduleBarCountPill: {
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    flexShrink: 0,
  },
  moduleBarCountText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  moduleBarToggle: {
    width: 24, height: 24, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  moduleBarCount: { fontSize: 10, color: '#fff', fontWeight: '700', marginLeft: 8 },

  attemptRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  badge: {
    width: 46, height: 46, borderRadius: 12, borderWidth: 1.5, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  badgePct:  { fontSize: 13, fontWeight: '900' },
  badgeFrac: { fontSize: 9, fontWeight: '700' },

  attemptLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  attemptLabel:    { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  bestBadge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  bestBadgeText:   { fontSize: 9, fontWeight: '800', color: '#fff' },
  failBadge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
  },
  failBadgeText: { fontSize: 9, fontWeight: '700', color: '#dc2626' },
  attemptDate:   { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  rowRight:      { alignItems: 'center', gap: 3 },
  rowChevron:    { fontSize: 16, color: '#cbd5e1', fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyEmoji:{ fontSize: 44 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },

  /* ── Path tab switcher (inside tabs) ── */
  pathTabs: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 14, marginTop: 14, marginBottom: 4,
  },
  pathTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 14, paddingVertical: 10,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#c5e1a5',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  pathTabEmoji: { fontSize: 16 },
  pathTabText: { fontSize: 13, fontWeight: '700', color: '#4a7c59' },
  pathTabTextActive: { color: '#ffffff' },
});
