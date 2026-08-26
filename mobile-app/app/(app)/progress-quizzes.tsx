import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getUser } from '@/lib/auth';
import { syncProgressFromServer, type QuizScore } from '@/lib/progress';

const COURSES = [
  { key: 'pathfit1', label: 'Pathfit 1', emoji: '🏃', color: '#1b5e20', light: '#e8f5e9', border: '#a5d6a7' },
  { key: 'pathfit2', label: 'Pathfit 2', emoji: '🧘', color: '#2e7d32', light: '#f1f8e9', border: '#c5e1a5' },
] as const;

/* Group a flat list of attempts by moduleId, keeping insertion order of modules */
function groupByModule(scores: QuizScore[]): { moduleId: number; moduleTitle: string; course: string; attempts: QuizScore[] }[] {
  const map = new Map<number, QuizScore[]>();
  for (const s of scores) {
    if (!map.has(s.moduleId)) map.set(s.moduleId, []);
    map.get(s.moduleId)!.push(s);
  }
  return Array.from(map.entries()).map(([moduleId, attempts]) => ({
    moduleId,
    moduleTitle: attempts[0].moduleTitle,
    course:      attempts[0].course,
    attempts:    [...attempts].sort((a, b) => a.attempt - b.attempt),
  }));
}

export default function ProgressQuizzesScreen() {
  const router = useRouter();

  const [scores, setScores]         = useState<QuizScore[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pathTab, setPathTab]       = useState<'pathfit1' | 'pathfit2'>('pathfit1');
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());

  const toggleModule = (moduleId: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const u = await getUser();
      if (!u) return;
      const { scores: s } = await syncProgressFromServer(u.id);
      setScores(s);
    } catch { /* silent */ }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalAttempts = scores.length;

  const navigateToDetail = (score: QuizScore) =>
    router.push({
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
    });

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={s.topTitle}>Quiz Results</Text>
          <Text style={s.topSub}>{totalAttempts} {totalAttempts === 1 ? 'attempt' : 'attempts'} total</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1b5e20" />
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1b5e20" />
          }
        >
          {scores.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyEmoji}>🏆</Text>
              <Text style={s.emptyTitle}>No quizzes taken yet</Text>
              <Text style={s.emptyHint}>Complete a module quiz to see your results here.</Text>
            </View>
          ) : (
            <>
              {/* Path tab switcher */}
              <View style={s.pathTabs}>
                {COURSES.map(c => {
                  const isActive = pathTab === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={[s.pathTab, isActive && { backgroundColor: c.color, borderColor: c.color }]}
                      onPress={() => setPathTab(c.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.pathTabEmoji}>{c.emoji}</Text>
                      <Text style={[s.pathTabText, isActive && s.pathTabTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {(() => {
                const c      = COURSES.find(x => x.key === pathTab)!;
                const groups = groupByModule(scores.filter(sc => sc.course === c.key));

                if (groups.length === 0) {
                  return (
                    <View style={s.emptyWrap}>
                      <Text style={s.emptyEmoji}>🏆</Text>
                      <Text style={s.emptyTitle}>No quizzes taken yet</Text>
                      <Text style={s.emptyHint}>Complete a module quiz to see your results here.</Text>
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

                    {/* One block per module */}
                    <View style={s.list}>
                      {groups.map(group => {
                        const bestPct    = Math.max(...group.attempts.map(a => a.percent));
                        const isExpanded = expandedModules.has(group.moduleId);

                        return (
                          <View key={group.moduleId} style={s.moduleBlock}>
                            {/* Module title bar — tap to expand/collapse */}
                            <TouchableOpacity
                              style={s.moduleBar}
                              onPress={() => toggleModule(group.moduleId)}
                              activeOpacity={0.7}
                            >
                              <Text style={s.moduleBarTitle} numberOfLines={1}>{group.moduleTitle}</Text>
                              <Text style={[s.moduleBarCount, { marginRight: 6 }]}>
                                {group.attempts.length} {group.attempts.length === 1 ? 'attempt' : 'attempts'}
                              </Text>
                              <Text style={[s.toggleArrow, isExpanded && s.toggleArrowUp]}>›</Text>
                            </TouchableOpacity>

                            {/* Attempt rows — newest first, shown only when expanded */}
                            {isExpanded && [...group.attempts].reverse().map((score) => {
                              const ok     = score.percent >= 75;
                              const isBest = score.percent === bestPct;
                              return (
                                <TouchableOpacity
                                  key={`${score.moduleId}-${score.attempt}`}
                                  style={[s.row, { borderColor: ok ? c.border : '#fecaca' }]}
                                  activeOpacity={0.75}
                                  onPress={() => navigateToDetail(score)}
                                >
                                  <View style={[s.badge, {
                                    backgroundColor: ok ? c.light : '#fef2f2',
                                    borderColor:     ok ? c.border : '#fecaca',
                                  }]}>
                                    <Text style={[s.badgePct, { color: ok ? c.color : '#dc2626' }]}>
                                      {score.percent}%
                                    </Text>
                                    <Text style={[s.badgeFraction, { color: ok ? c.color : '#fca5a5' }]}>
                                      {score.score}/{score.total}
                                    </Text>
                                  </View>

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
                                    <Text style={s.rowDate}>
                                      {new Date(score.takenAt).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', year: 'numeric',
                                      })}
                                    </Text>
                                  </View>

                                  <View style={s.rowRight}>
                                    <Text style={{ fontSize: 18 }}>{ok ? '✅' : '❌'}</Text>
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
              })()}
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
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
    borderBottomWidth: 1, borderBottomColor: '#e8f5e9',
  },
  backBtn:   { width: 60 },
  backText:  { fontSize: 16, color: '#1b5e20', fontWeight: '600' },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle:  { fontSize: 16, fontWeight: '800', color: '#1b5e20' },
  topSub:    { fontSize: 11, color: '#a5d6a7', marginTop: 1 },

  /* Course section */
  section: { marginBottom: 6 },

  courseHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 16, marginBottom: 6,
    borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12,
  },
  courseEmoji: { fontSize: 26 },
  courseLabel: { fontSize: 15, fontWeight: '800' },
  courseCount: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  list: { paddingHorizontal: 16, gap: 10 },

  /* Module block */
  moduleBlock: {
    borderRadius: 16, borderWidth: 1.5, borderColor: '#c5e1a5',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#a5d6a7', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 1,
  },
  moduleBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f1f8e9', paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#c5e1a5',
  },
  moduleBarTitle: { fontSize: 12, fontWeight: '800', color: '#1b5e20', flex: 1 },
  moduleBarCount: { fontSize: 10, color: '#a5d6a7', fontWeight: '600', marginLeft: 8 },

  toggleArrow: {
    fontSize: 18, color: '#a5d6a7', fontWeight: '700',
    transform: [{ rotate: '90deg' }],
  },
  toggleArrowUp: {
    transform: [{ rotate: '-90deg' }],
  },

  /* Attempt row */
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderTopWidth: 1, borderTopColor: '#e8f5e9',
    paddingHorizontal: 14, paddingVertical: 12,
  },

  badge: {
    width: 54, height: 54, borderRadius: 14, borderWidth: 1.5, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  badgePct:      { fontSize: 15, fontWeight: '900' },
  badgeFraction: { fontSize: 10, fontWeight: '700' },

  attemptLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  attemptLabel:    { fontSize: 12, fontWeight: '700', color: '#1b5e20' },

  bestBadge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  bestBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  failBadge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
  },
  failBadgeText: { fontSize: 9, fontWeight: '700', color: '#dc2626' },

  rowDate:    { fontSize: 11, color: '#a5d6a7', marginTop: 3 },
  rowRight:   { alignItems: 'center', gap: 2 },
  rowChevron: { fontSize: 16, color: '#cbd5e1', fontWeight: '700' },

  /* Empty */
  emptyWrap: {
    alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 8,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1b5e20' },
  emptyHint:  { fontSize: 13, color: '#a5d6a7', textAlign: 'center', lineHeight: 20 },

  /* Path tab switcher */
  pathTabs: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 16, marginTop: 14, marginBottom: 2,
  },
  pathTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 14, paddingVertical: 10,
    backgroundColor: '#f1f8e9', borderWidth: 1.5, borderColor: '#c5e1a5',
  },
  pathTabEmoji: { fontSize: 16 },
  pathTabText: { fontSize: 13, fontWeight: '700', color: '#4a7c59' },
  pathTabTextActive: { color: '#ffffff' },
});
