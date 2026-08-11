import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';import { SafeAreaView } from 'react-native-safe-area-context';

import { API } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { fetchWithTimeout } from '@/lib/request';

/* ── Types ──────────────────────────────────────── */
type ModuleRow = {
  id: number;
  title: string;
  course: string;
  completed: boolean;
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
  { key: 'pathfit1', label: 'Pathfit 1', emoji: '🏃', color: '#1c7ed6', light: '#eff6ff', border: '#bfdbfe' },
  { key: 'pathfit2', label: 'Pathfit 2', emoji: '🧘', color: '#0ca678', light: '#ecfdf5', border: '#a7f3d0' },
] as const;

/* ══════════════════════════════════════════════ */
export default function StudentProgressScreen() {
  const router = useRouter();
  const { studentId, studentName } =    useLocalSearchParams<{ studentId: string; studentName: string }>();

  const [student, setStudent]   = useState<StudentInfo | null>(null);
  const [modules, setModules]   = useState<ModuleRow[]>([]);
  const [scores, setScores]     = useState<QuizResult[]>([]);
  const [tab, setTab]           = useState<'lessons' | 'quizzes'>('lessons');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={s.topTitle} numberOfLines={1}>{student?.name ?? studentName ?? '—'}</Text>
          <Text style={s.topSub}>
            {student?.student_id ?? ''}{student?.section ? ` · Sec ${student.section}` : ''}
          </Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

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
                {modules.length === 0 && (
                  <View style={s.emptyWrap}>
                    <Text style={s.emptyEmoji}>📭</Text>
                    <Text style={s.emptyText}>No modules available.</Text>
                  </View>
                )}
                {COURSES.map(c => {
                  const list    = modules.filter(m => m.course === c.key);
                  if (list.length === 0) return null;
                  const done    = list.filter(m => m.completed).length;
                  const pct     = list.length > 0 ? done / list.length : 0;
                  return (
                    <View key={c.key} style={s.section}>
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
                          <View key={m.id} style={[
                            s.row,
                            m.completed
                              ? { borderColor: c.border, backgroundColor: c.light }
                              : s.rowPending,
                          ]}>
                            <View style={[s.numWrap, { backgroundColor: m.completed ? c.color : '#e2e8f0' }]}>
                              {m.completed
                                ? <Text style={s.checkIcon}>✓</Text>
                                : <Text style={[s.numText, { color: '#94a3b8' }]}>{idx + 1}</Text>
                              }
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.rowTitle, !m.completed && { color: '#94a3b8' }]}>
                                {m.title}
                              </Text>
                            </View>
                            <Text style={[s.statusText, { color: m.completed ? c.color : '#cbd5e1' }]}>
                              {m.completed ? 'Completed' : 'Pending'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Quizzes tab ── */}
            {tab === 'quizzes' && (
              <View>
                {scores.length === 0 ? (
                  <View style={s.emptyWrap}>
                    <Text style={s.emptyEmoji}>🏆</Text>
                    <Text style={s.emptyText}>No quizzes taken yet.</Text>
                  </View>
                ) : (
                  COURSES.map(c => {
                    // Group attempts by module
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
                    if (groups.length === 0) return null;

                    return (
                      <View key={c.key} style={s.section}>
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
                            const bestPct = Math.max(...group.attempts.map(a => a.percent));
                            return (
                              <View key={group.moduleId} style={s.moduleBlock}>
                                {/* Module title bar */}
                                <View style={s.moduleBar}>
                                  <Text style={s.moduleBarTitle} numberOfLines={1}>{group.moduleTitle}</Text>
                                  <Text style={s.moduleBarCount}>
                                    {group.attempts.length} {group.attempts.length === 1 ? 'attempt' : 'attempts'}
                                  </Text>
                                </View>

                                {/* Attempt rows — newest first */}
                                {[...group.attempts].reverse().map(score => {
                                  const ok     = score.percent >= 75;
                                  const isBest = score.percent === bestPct;
                                  return (
                                    <TouchableOpacity
                                      key={`${score.moduleId}-${score.attempt}`}
                                      style={[s.attemptRow, { borderColor: ok ? c.border : '#fecaca' }]}
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
                                        <Text style={s.rowChevron}>›</Text>
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
                  })
                )}
              </View>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn:   { width: 60 },
  backText:  { fontSize: 16, color: '#0ca678', fontWeight: '600' },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle:  { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  topSub:    { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  tabs: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  tab: {
    flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: 'center',
    backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  tabActive:          { backgroundColor: '#eff6ff', borderColor: '#1c7ed6' },
  tabActiveGreen:     { backgroundColor: '#ecfdf5', borderColor: '#0ca678' },
  tabText:            { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabTextActive:      { color: '#1c7ed6' },
  tabTextActiveGreen: { color: '#0ca678' },

  section: { marginBottom: 4 },

  courseHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 14, marginBottom: 6,
    borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12,
  },
  courseEmoji:   { fontSize: 24 },
  courseLabel:   { fontSize: 14, fontWeight: '800' },
  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  progressTrack: { flex: 1, height: 5, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3 },
  progressCount: { fontSize: 11, fontWeight: '700', minWidth: 32 },
  doneBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  doneBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  list: { paddingHorizontal: 16, gap: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  rowPending: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  numWrap:    { width: 32, height: 32, borderRadius: 10, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  checkIcon:  { fontSize: 15, fontWeight: '900', color: '#ffffff' },
  numText:    { fontSize: 12, fontWeight: '800' },
  rowTitle:   { fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 18 },
  statusText: { fontSize: 11, fontWeight: '700' },

  /* Quiz course sections */
  courseCount: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  /* Quiz module blocks */
  moduleBlock: {
    borderRadius: 16, borderWidth: 1.5, borderColor: '#e2e8f0',
    overflow: 'hidden', backgroundColor: '#ffffff',
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 1,
  },
  moduleBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  moduleBarTitle: { fontSize: 12, fontWeight: '800', color: '#0f172a', flex: 1 },
  moduleBarCount: { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginLeft: 8 },

  attemptRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  badge: {
    width: 52, height: 52, borderRadius: 13, borderWidth: 1.5, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  badgePct:  { fontSize: 14, fontWeight: '900' },
  badgeFrac: { fontSize: 10, fontWeight: '700' },

  attemptLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  attemptLabel:    { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  bestBadge:       { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  bestBadgeText:   { fontSize: 9, fontWeight: '800', color: '#fff' },
  failBadge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
  },
  failBadgeText: { fontSize: 9, fontWeight: '700', color: '#dc2626' },
  attemptDate:   { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  rowRight:      { alignItems: 'center', gap: 2 },
  rowChevron:    { fontSize: 16, color: '#cbd5e1', fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyEmoji:{ fontSize: 40 },
  emptyText: { fontSize: 14, color: '#94a3b8' },
});
