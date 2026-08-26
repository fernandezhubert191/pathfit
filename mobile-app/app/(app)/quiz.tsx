import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { isOnline } from '@/lib/offline';
import { getQuizScores, markModuleViewed, saveQuizScore } from '@/lib/progress';
import { fetchWithTimeout } from '@/lib/request';
import { loadQuizAnswers } from '@/lib/module-cache';
import { enqueuePendingSubmission, flushQueue, type PendingSubmission } from '@/lib/sync-queue';
import type { QuizScore } from '@/lib/progress';

/* ── Types ─────────────────────────────────────────── */
type Choice = 'a' | 'b' | 'c' | 'd';

type QuizQuestion = {
  id: number;
  question: string;
  choices: { a: string; b: string; c: string; d: string };
};

type QuizResult = {
  score: number;
  total: number;
  percent: number;
  results: Array<{
    id: number;
    correct: boolean;
    correct_answer: Choice;
    your_answer: Choice | null;
  }>;
};

/* ── Circular progress ring ─────────────────────────── */
function ScoreRing({ percent, passed }: { percent: number; passed: boolean }) {
  const size   = 140;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circum = 2 * Math.PI * radius;
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: percent / 100,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const dashOffset = animVal.interpolate({
    inputRange:  [0, 1],
    outputRange: [circum, 0],
  });

  const color = passed ? '#059669' : percent >= 50 ? '#d97706' : '#dc2626';
  const bg    = passed ? '#ecfdf5' : percent >= 50 ? '#fffbeb' : '#fef2f2';

  return (
    <View style={[ringS.wrap, { backgroundColor: bg, width: size, height: size, borderRadius: size / 2 }]}>
      {/* SVG-like ring using border trick */}
      <View style={[ringS.track, {
        width: size, height: size, borderRadius: size / 2,
        borderWidth: stroke, borderColor: passed ? '#d1fae5' : percent >= 50 ? '#fef3c7' : '#fee2e2',
      }]} />
      <View style={ringS.inner}>
        <Text style={[ringS.pct, { color }]}>{percent}<Text style={ringS.pctSign}>%</Text></Text>
        <Text style={[ringS.label, { color }]}>{passed ? 'Passed' : 'Try again'}</Text>
      </View>
    </View>
  );
}
const ringS = StyleSheet.create({
  wrap:  { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  track: { position: 'absolute' },
  inner: { alignItems: 'center' },
  pct:   { fontSize: 34, fontWeight: '900', lineHeight: 38 },
  pctSign: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});

/* ══════════════════════════════════════════════════════
   Quiz Screen
══════════════════════════════════════════════════════ */
export default function QuizScreen() {
  const router = useRouter();
  const { moduleId, moduleTitle, quizTitle, questionsJson } =
    useLocalSearchParams<{
      moduleId: string;
      moduleTitle: string;
      quizTitle: string;
      questionsJson: string;
    }>();

  const questions: QuizQuestion[] = JSON.parse(questionsJson ?? '[]');

  const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  const [phase, setPhase]           = useState<'intro' | 'quiz' | 'result'>('intro');
  const [shuffled, setShuffled]     = useState<QuizQuestion[]>([]);
  const [current, setCurrent]       = useState(0);           // active question index
  const [answers, setAnswers]       = useState<Record<number, Choice>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<QuizResult | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | null>(null);
  const [bestScore, setBestScore]   = useState<QuizScore | null>(null);
  const slideAnim                   = useRef(new Animated.Value(0)).current;

  /* ── Load best score for intro ── */
  useEffect(() => {
    getUser().then(u => {
      if (!u) return;
      getQuizScores(u.id).then(scores => {
        const mine = scores.filter(s => String(s.moduleId) === String(moduleId));
        if (mine.length > 0) {
          setBestScore(mine.reduce((a, b) => (a.percent >= b.percent ? a : b)));
        }
      });
    });
  }, [moduleId]);

  /* ── Auto-sync when pending ── */
  useEffect(() => {
    if (syncStatus !== 'pending') return;
    let active = true;
    const trySync = async () => {
      const online = await isOnline();
      if (!online || !active) return;
      const user = await getUser();
      if (!user) return;
      const { synced } = await flushQueue(user.id);
      if (synced > 0 && active) {
        setSyncStatus('synced');
        // Refresh local progress cache after successful flush
        import('@/lib/progress').then(({ syncProgressFromServer }) =>
          syncProgressFromServer(user.id).catch(() => {})
        );
      }
    };
    const timer = setInterval(trySync, 5000);
    trySync();
    return () => { active = false; clearInterval(timer); };
  }, [syncStatus]);

  /* ── Slide animation between questions ── */
  const animateTo = (next: number) => {
    const dir = next > current ? 60 : -60;
    slideAnim.setValue(dir);
    setCurrent(next);
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true,
      tension: 180, friction: 18,
    }).start();
  };

  /* ── Grade locally ── */
  const gradeLocally = async (): Promise<QuizResult> => {
    const cachedAnswers = await loadQuizAnswers(moduleId ?? '');
    let correct = 0;
    const results = shuffled.map(q => {
      const given      = answers[q.id] ?? null;
      const correctAns = (cachedAnswers?.[q.id] ?? null) as Choice | null;
      const isCorrect  = !!correctAns && given === correctAns;
      if (isCorrect) correct++;
      return { id: q.id, correct: isCorrect, correct_answer: correctAns ?? ('?' as any), your_answer: given };
    });
    const total   = shuffled.length;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { score: correct, total, percent, results };
  };

  /* ── Submit ── */
  const submit = async () => {
    const unanswered = shuffled.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      Alert.alert('Incomplete', `Please answer all ${shuffled.length} questions first.`);
      return;
    }
    setSubmitting(true);
    try {
      const online = await isOnline();
      const user   = await getUser();

      if (online) {
        const token = await getToken();
        const res = await fetchWithTimeout(`${API}/modules/${moduleId}/quiz/submit`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ answers }),
        });
        const data = await res.json();
        if (res.ok) {
          setResult(data);
          setSyncStatus('synced');
          setPhase('result');
          if (user) {
            await saveQuizScore(user.id, {
              moduleId: Number(moduleId), moduleTitle: moduleTitle ?? '',
              course: 'pathfit1', attempt: 0,
              score: data.score, total: data.total, percent: data.percent,
              takenAt: new Date().toISOString(),
            });
            if (data.percent >= 75) {
              await markModuleViewed(user.id, Number(moduleId));
            }
            // Sync full progress from server so dashboards reflect
            // the new completion/score immediately on next focus
            import('@/lib/progress').then(({ syncProgressFromServer }) =>
              syncProgressFromServer(user.id).catch(() => {})
            );
          }
        } else {
          const msg = data.message ?? 'Submission failed.';
          const isVideoRequired = res.status === 403 && msg.toLowerCase().includes('exercise video');
          Alert.alert(
            isVideoRequired ? '🎬 Video Required' : 'Submission Failed',
            isVideoRequired
              ? 'You must upload your exercise video before taking this quiz. Go back and upload it first.'
              : msg,
          );
        }
      } else {
        if (!user) { Alert.alert('Error', 'Could not identify user.'); return; }
        const takenAt     = new Date().toISOString();
        const localResult = await gradeLocally();
        const pending: PendingSubmission = {
          id: `${user.id}_${moduleId}_${takenAt}`,
          moduleId: Number(moduleId), moduleTitle: moduleTitle ?? '',
          course: 'pathfit1', answers: answers as Record<number, 'a' | 'b' | 'c' | 'd'>,
          localScore: {
            moduleId: Number(moduleId), moduleTitle: moduleTitle ?? '',
            course: 'pathfit1', attempt: 0,
            score: localResult.score, total: localResult.total, percent: localResult.percent, takenAt,
          },
          createdAt: takenAt,
        };
        await enqueuePendingSubmission(user.id, pending);
        setResult(localResult);
        setSyncStatus('pending');
        setPhase('result');
      }
    } catch (err: any) {
      Alert.alert('Connection error', err?.message ?? 'Cannot reach server.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Retake ── */
  const retake = () => {
    const s = shuffle(questions);
    setShuffled(s);
    setAnswers({});
    setResult(null);
    setCurrent(0);
    slideAnim.setValue(0);
    setPhase('quiz');
  };

  const total    = shuffled.length || questions.length;
  const answered = Object.keys(answers).length;

  /* ────────────────────────────────────────────────────
     Render
  ──────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={s.topTitle} numberOfLines={1}>{quizTitle}</Text>
          <Text style={s.topSub} numberOfLines={1}>{moduleTitle}</Text>
        </View>
        {phase === 'quiz'
          ? <View style={s.topCounter}>
              <Text style={s.topCounterText}>{current + 1}/{total}</Text>
            </View>
          : <View style={{ width: 60 }} />
        }
      </View>

      {/* ════════ INTRO ════════ */}
      {phase === 'intro' && (
        <View style={s.introWrap}>
          <View style={s.introCard}>
            <Text style={s.introEmoji}>📝</Text>
            <Text style={s.introTitle}>{quizTitle}</Text>
            <Text style={s.introSub}>{moduleTitle}</Text>

            <View style={s.introDivider} />

            {/* Stats row */}
            <View style={s.introStatsRow}>
              <View style={s.introStat}>
                <Text style={s.introStatNum}>{questions.length}</Text>
                <Text style={s.introStatLabel}>Questions</Text>
              </View>
              <View style={s.introStatDivider} />
              <View style={s.introStat}>
                <Text style={s.introStatNum}>75%</Text>
                <Text style={s.introStatLabel}>To pass</Text>
              </View>
              {bestScore && (
                <>
                  <View style={s.introStatDivider} />
                  <View style={s.introStat}>
                    <Text style={[s.introStatNum, { color: bestScore.percent >= 75 ? '#059669' : '#d97706' }]}>
                      {bestScore.percent}%
                    </Text>
                    <Text style={s.introStatLabel}>Best score</Text>
                  </View>
                </>
              )}
            </View>

            {bestScore && (
              <View style={[s.introBestBanner, {
                backgroundColor: bestScore.percent >= 75 ? '#ecfdf5' : '#fffbeb',
                borderColor:     bestScore.percent >= 75 ? '#6ee7b7' : '#fcd34d',
              }]}>
                <Text style={{ fontSize: 14 }}>{bestScore.percent >= 75 ? '🏆' : '💪'}</Text>
                <Text style={[s.introBestText, { color: bestScore.percent >= 75 ? '#059669' : '#d97706' }]}>
                  {bestScore.percent >= 75
                    ? `You passed with ${bestScore.percent}% — retake to beat your score!`
                    : `Last attempt: ${bestScore.percent}% — you need ${75 - bestScore.percent}% more to pass.`}
                </Text>
              </View>
            )}

            <Text style={s.introHint}>
              Answer one question at a time. You can go back to change answers before submitting.
            </Text>

            <TouchableOpacity
              style={s.startBtn}
              onPress={() => { setShuffled(shuffle(questions)); setCurrent(0); setPhase('quiz'); }}
              activeOpacity={0.85}
            >
              <Text style={s.startBtnText}>{bestScore ? '🔁  Retake Quiz' : '▶  Start Quiz'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ════════ QUIZ ════════ */}
      {phase === 'quiz' && shuffled.length > 0 && (
        <View style={s.quizWrap}>
          {/* Top progress bar */}
          <View style={s.progressStrip}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(answered / total) * 100}%` as any }]} />
            </View>
            <Text style={s.progressLabel}>{answered}/{total} answered</Text>
          </View>

          {/* Question dots */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.dotsScroll}
            contentContainerStyle={s.dotsRow}
          >
            {shuffled.map((q, i) => (
              <TouchableOpacity
                key={q.id}
                onPress={() => animateTo(i)}
                style={[
                  s.dot,
                  i === current && s.dotActive,
                  answers[q.id] && i !== current && s.dotDone,
                ]}
              >
                <Text style={[
                  s.dotText,
                  i === current && s.dotTextActive,
                  answers[q.id] && i !== current && s.dotTextDone,
                ]}>
                  {answers[q.id] ? '✓' : i + 1}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Animated question card */}
          <Animated.View style={[s.questionOuter, { transform: [{ translateX: slideAnim }] }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.questionScroll}>
              {(() => {
                const q = shuffled[current];
                return (
                  <View style={s.questionCard}>
                    {/* Question header */}
                    <View style={s.questionHeader}>
                      <View style={[s.questionNum, answers[q.id] && s.questionNumAnswered]}>
                        <Text style={[s.questionNumText, answers[q.id] && s.questionNumTextAnswered]}>
                          {answers[q.id] ? '✓' : current + 1}
                        </Text>
                      </View>
                      <Text style={s.questionText}>{q.question}</Text>
                    </View>

                    {/* Choices */}
                    <View style={s.choicesGrid}>
                      {(['a', 'b', 'c', 'd'] as Choice[]).map(letter => {
                        const selected = answers[q.id] === letter;
                        return (
                          <TouchableOpacity
                            key={letter}
                            style={[s.choice, selected && s.choiceSelected]}
                            onPress={() => setAnswers(prev => ({ ...prev, [q.id]: letter }))}
                            activeOpacity={0.75}
                          >
                            <View style={[s.choiceBadge, selected && s.choiceBadgeSelected]}>
                              <Text style={[s.choiceBadgeText, selected && s.choiceBadgeTextSelected]}>
                                {letter.toUpperCase()}
                              </Text>
                            </View>
                            <Text style={[s.choiceText, selected && s.choiceTextSelected]} numberOfLines={3}>
                              {q.choices[letter]}
                            </Text>
                            {selected && <Text style={s.choiceCheck}>✓</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}
            </ScrollView>
          </Animated.View>

          {/* Prev / Next / Submit row */}
          <View style={s.navRow}>
            <TouchableOpacity
              style={[s.navBtn, s.navBtnSecondary, current === 0 && s.navBtnDisabled]}
              onPress={() => animateTo(current - 1)}
              disabled={current === 0}
              activeOpacity={0.8}
            >
              <Text style={[s.navBtnText, s.navBtnTextSecondary]}>‹ Prev</Text>
            </TouchableOpacity>

            {current < total - 1 ? (
              <TouchableOpacity
                style={s.navBtn}
                onPress={() => animateTo(current + 1)}
                activeOpacity={0.85}
              >
                <Text style={s.navBtnText}>Next ›</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.navBtn, s.navBtnSubmit, (submitting || answered < total) && s.navBtnDisabled]}
                onPress={submit}
                disabled={submitting || answered < total}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.navBtnText}>
                      {answered < total ? `${total - answered} left` : 'Submit ✓'}
                    </Text>
                }
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ════════ RESULT ════════ */}
      {phase === 'result' && result && (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

          {/* Sync banner */}
          {syncStatus === 'pending' && (
            <View style={s.syncBanner}>
              <Text style={s.syncBannerIcon}>📡</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.syncBannerTitle}>Saved offline — will sync when online</Text>
                <Text style={s.syncBannerSub}>Your answers are queued and will be confirmed once you reconnect.</Text>
              </View>
            </View>
          )}
          {syncStatus === 'synced' && (
            <View style={[s.syncBanner, s.syncBannerGreen]}>
              <Text style={s.syncBannerIcon}>✅</Text>
              <Text style={[s.syncBannerTitle, { color: '#15803d' }]}>Synced to server</Text>
            </View>
          )}

          {/* Score hero */}
          <View style={s.scoreHero}>
            <ScoreRing percent={result.percent} passed={result.percent >= 75} />
            <View style={s.scoreInfo}>
              <Text style={s.scoreCount}>{result.score} / {result.total} correct</Text>
              <Text style={[s.scoreStatus, { color: result.percent >= 75 ? '#059669' : '#dc2626' }]}>
                {result.percent >= 75 ? '🎉 Lesson completed!' : '📚 Need 75% to pass'}
              </Text>
              {result.percent >= 75 && (
                <View style={s.completedBadge}>
                  <Text style={s.completedBadgeText}>✓  Marked as completed</Text>
                </View>
              )}
            </View>
          </View>

          {/* Actions */}
          <View style={s.resultActions}>
            <TouchableOpacity style={s.retakeBtn} onPress={retake} activeOpacity={0.85}>
              <Text style={s.retakeBtnText}>🔄  Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.doneBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <Text style={s.doneBtnText}>✓  Done</Text>
            </TouchableOpacity>
          </View>



          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  /* Top bar */
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1d4ed8', paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn:  { width: 60 },
  backText: { fontSize: 16, color: '#93c5fd', fontWeight: '600' },
  topCenter:{ flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
  topSub:   { fontSize: 11, color: '#bfdbfe', marginTop: 1 },
  topCounter: {
    width: 60, alignItems: 'flex-end',
  },
  topCounterText: { fontSize: 12, fontWeight: '700', color: '#bfdbfe' },

  /* ── INTRO ── */
  introWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  introCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 24,
    padding: 24, alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  introEmoji: { fontSize: 52, marginBottom: 4 },
  introTitle: { fontSize: 19, fontWeight: '800', color: '#111827', textAlign: 'center' },
  introSub:   { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  introDivider: { width: 40, height: 2, backgroundColor: '#e5e7eb', borderRadius: 1, marginVertical: 4 },

  introStatsRow:    { flexDirection: 'row', alignItems: 'center', gap: 0 },
  introStat:        { alignItems: 'center', paddingHorizontal: 20 },
  introStatNum:     { fontSize: 28, fontWeight: '900', color: '#1d4ed8' },
  introStatLabel:   { fontSize: 11, color: '#6b7280', fontWeight: '600', marginTop: -2 },
  introStatDivider: { width: 1, height: 36, backgroundColor: '#e5e7eb' },

  introBestBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    width: '100%', borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  introBestText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },

  introHint: {
    fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 18, marginTop: 2,
  },
  startBtn: {
    width: '100%', backgroundColor: '#1d4ed8', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
  },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  /* ── QUIZ ── */
  quizWrap: { flex: 1 },

  progressStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1e40af', paddingHorizontal: 16, paddingVertical: 8,
  },
  progressTrack: {
    flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill:  { height: '100%', backgroundColor: '#60a5fa', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: '#bfdbfe', fontWeight: '700' },

  dotsScroll: { maxHeight: 44, flexGrow: 0 },
  dotsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, gap: 6,
  },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  dotActive:       { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  dotDone:         { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  dotText:         { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  dotTextActive:   { color: '#fff' },
  dotTextDone:     { color: '#15803d' },

  questionOuter: { flex: 1 },
  questionScroll: { padding: 14, paddingBottom: 8 },

  questionCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  questionHeader: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
  questionNum: {
    width: 30, height: 30, borderRadius: 15, flexShrink: 0,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  questionNumAnswered:     { backgroundColor: '#1d4ed8' },
  questionNumText:         { fontSize: 13, fontWeight: '800', color: '#1d4ed8' },
  questionNumTextAnswered: { color: '#fff' },
  questionText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827', lineHeight: 23 },

  choicesGrid: { gap: 10 },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#fafafa',
  },
  choiceSelected:          { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  choiceBadge: {
    width: 28, height: 28, borderRadius: 14, flexShrink: 0,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  choiceBadgeSelected:     { backgroundColor: '#1d4ed8' },
  choiceBadgeText:         { fontSize: 12, fontWeight: '800', color: '#6b7280' },
  choiceBadgeTextSelected: { color: '#fff' },
  choiceText:              { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  choiceTextSelected:      { color: '#1d4ed8', fontWeight: '600' },
  choiceCheck:             { fontSize: 14, color: '#1d4ed8', fontWeight: '800' },

  /* Prev / Next / Submit */
  navRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  navBtn: {
    flex: 1, backgroundColor: '#1d4ed8', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  navBtnSecondary: { backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  navBtnSubmit:    { backgroundColor: '#059669' },
  navBtnDisabled:  { opacity: 0.4 },
  navBtnText:      { color: '#fff', fontWeight: '800', fontSize: 14 },
  navBtnTextSecondary: { color: '#475569' },

  /* ── RESULT ── */
  scoreHero: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  scoreInfo:    { flex: 1, gap: 4 },
  scoreCount:   { fontSize: 15, fontWeight: '700', color: '#374151' },
  scoreStatus:  { fontSize: 14, fontWeight: '700' },
  completedBadge: {
    marginTop: 6, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#dcfce7', borderRadius: 20, borderWidth: 1, borderColor: '#86efac',
    alignSelf: 'flex-start',
  },
  completedBadgeText: { fontSize: 12, fontWeight: '700', color: '#15803d' },

  resultActions: { flexDirection: 'row', gap: 10 },
  retakeBtn: {
    flex: 1, backgroundColor: '#fffbeb', borderRadius: 14, paddingVertical: 13,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#fcd34d',
  },
  retakeBtnText: { color: '#d97706', fontWeight: '700', fontSize: 14 },
  doneBtn: {
    flex: 1, backgroundColor: '#1d4ed8', borderRadius: 14, paddingVertical: 13,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  /* Sync banners */
  syncBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fefce8', borderRadius: 14, borderWidth: 1.5, borderColor: '#fde68a',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  syncBannerGreen: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  syncBannerIcon:  { fontSize: 20 },
  syncBannerTitle: { fontSize: 13, fontWeight: '700', color: '#a16207' },
  syncBannerSub:   { fontSize: 11, color: '#a16207', marginTop: 2, lineHeight: 16 },
});
