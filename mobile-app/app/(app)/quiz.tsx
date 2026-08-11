import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { markModuleViewed, saveQuizScore } from '@/lib/progress';
import { fetchWithTimeout } from '@/lib/request';
import { loadQuizAnswers } from '@/lib/module-cache';
import { enqueuePendingSubmission, flushQueue, type PendingSubmission } from '@/lib/sync-queue';

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

  /* Shuffle once when the quiz starts */
  const shuffle = <T,>(arr: T[]): T[] =>
    [...arr].sort(() => Math.random() - 0.5);

  const [phase, setPhase]           = useState<'intro' | 'quiz' | 'result'>('intro');
  const [shuffled, setShuffled]     = useState<QuizQuestion[]>([]);
  const [answers, setAnswers]       = useState<Record<number, Choice>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<QuizResult | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | null>(null);

  /* ── Auto-sync: when result is pending and we come back online ── */
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
      }
    };
    // Poll every 5 seconds while result is pending
    const timer = setInterval(trySync, 5000);
    trySync(); // immediate first attempt
    return () => { active = false; clearInterval(timer); };
  }, [syncStatus]);

  /* ── Grade locally using cached correct answers ── */
  const gradeLocally = async (): Promise<QuizResult> => {
    const cachedAnswers = await loadQuizAnswers(moduleId ?? '');
    let correct = 0;
    const results = shuffled.map(q => {
      const given      = answers[q.id] ?? null;
      const correctAns = (cachedAnswers?.[q.id] ?? null) as Choice | null;
      const isCorrect  = !!correctAns && given === correctAns;
      if (isCorrect) correct++;
      return {
        id:             q.id,
        correct:        isCorrect,
        correct_answer: correctAns ?? ('?' as any),
        your_answer:    given,
      };
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
        /* ── Online path: submit to server ── */
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
              moduleId:    Number(moduleId),
              moduleTitle: moduleTitle ?? '',
              course:      'pathfit1',
              attempt:     0, // server will assign the real number; synced on next myProgress fetch
              score:       data.score,
              total:       data.total,
              percent:     data.percent,
              takenAt:     new Date().toISOString(),
            });
            if (data.percent >= 75) await markModuleViewed(user.id, Number(moduleId));
          }
        } else {
          Alert.alert('Error', data.message ?? 'Submission failed.');
        }
      } else {
        /* ── Offline path: grade locally + queue for later sync ── */
        if (!user) { Alert.alert('Error', 'Could not identify user.'); return; }

        const takenAt    = new Date().toISOString();
        const localResult = await gradeLocally();

        const pending: PendingSubmission = {
          id:          `${user.id}_${moduleId}_${takenAt}`,
          moduleId:    Number(moduleId),
          moduleTitle: moduleTitle ?? '',
          course:      'pathfit1',
          answers:     answers as Record<number, 'a' | 'b' | 'c' | 'd'>,
          localScore: {
            moduleId:    Number(moduleId),
            moduleTitle: moduleTitle ?? '',
            course:      'pathfit1',
            attempt:     0,
            score:       localResult.score,
            total:       localResult.total,
            percent:     localResult.percent,
            takenAt,
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

  /* ── Retake — reshuffle on every attempt ── */
  const retake = () => {
    setShuffled(shuffle(questions));
    setAnswers({});
    setResult(null);
    setPhase('quiz');
  };

  const answered = Object.keys(answers).length;
  const total    = shuffled.length || questions.length;
  const pct      = total > 0 ? answered / total : 0;

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
        <View style={{ width: 60 }} />
      </View>

      {/* ── Intro ── */}
      {phase === 'intro' && (
        <View style={s.introWrap}>
          <View style={s.introCard}>
            <Text style={s.introEmoji}>📝</Text>
            <Text style={s.introTitle}>{quizTitle}</Text>
            <Text style={s.introSub}>{moduleTitle}</Text>
            <View style={s.introDivider} />
            <View style={s.introStat}>
              <Text style={s.introStatNum}>{questions.length}</Text>
              <Text style={s.introStatLabel}>Questions</Text>
            </View>
            <Text style={s.introHint}>
              Answer all questions and submit to see your score. You can retake anytime.
            </Text>
            <TouchableOpacity style={s.startBtn} onPress={() => { setShuffled(shuffle(questions)); setPhase('quiz'); }} activeOpacity={0.85}>
              <Text style={s.startBtnText}>Start Quiz</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Quiz ── */}
      {phase === 'quiz' && (
        <>
          {/* Progress strip */}
          <View style={s.progressStrip}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${pct * 100}%` as any }]} />
            </View>
            <Text style={s.progressLabel}>{answered}/{total}</Text>
          </View>

          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
            {shuffled.map((q, idx) => (
              <View key={q.id} style={s.questionCard}>
                <View style={s.questionHeader}>
                  <View style={[s.questionNum, answers[q.id] && s.questionNumAnswered]}>
                    <Text style={[s.questionNumText, answers[q.id] && s.questionNumTextAnswered]}>
                      {answers[q.id] ? '✓' : idx + 1}
                    </Text>
                  </View>
                  <Text style={s.questionText}>{q.question}</Text>
                </View>
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
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[s.submitBtn, (submitting || answered < total) && s.submitBtnDisabled]}
              onPress={submit}
              disabled={submitting || answered < total}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitBtnText}>
                    {answered < total
                      ? `${total - answered} questions left`
                      : 'Submit Quiz'}
                  </Text>
              }
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      )}

      {/* ── Result ── */}
      {phase === 'result' && result && (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          {/* Sync status banner */}
          {syncStatus === 'pending' && (
            <View style={s.syncBanner}>
              <Text style={s.syncBannerIcon}>📡</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.syncBannerTitle}>Saved offline — will sync when online</Text>
                <Text style={s.syncBannerSub}>Your answers are queued. Score will be confirmed once you reconnect.</Text>
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
          <View style={[s.scoreCard, {
            backgroundColor: result.percent >= 75 ? '#ecfdf5' : '#fef2f2',
          }]}>
            <Text style={s.scoreEmoji}>
              {result.percent >= 75 ? '🎉' : '😔'}
            </Text>
            <Text style={[s.scorePercent, {
              color: result.percent >= 75 ? '#059669' : '#dc2626',
            }]}>
              {result.percent}%
            </Text>
            <Text style={s.scoreLabel}>{result.score} / {result.total} correct</Text>
            <Text style={[s.scoreStatus, { color: result.percent >= 75 ? '#059669' : '#dc2626' }]}>
              {result.percent >= 75 ? 'Lesson completed ✓' : 'Need 75% to complete lesson'}
            </Text>
            {result.percent >= 75 && (
              <View style={s.completedBadge}>
                <Text style={s.completedBadgeText}>✓  Marked as completed</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={s.resultActions}>
            <TouchableOpacity style={s.retakeBtn} onPress={retake} activeOpacity={0.85}>
              <Text style={s.retakeBtnText}>🔄  Retake Quiz</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.doneBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <Text style={s.doneBtnText}>✓  Done</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

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

  /* Progress strip */
  progressStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1e40af', paddingHorizontal: 16, paddingVertical: 8,
  },
  progressTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: '#60a5fa', borderRadius: 3 },
  progressLabel: { fontSize: 12, color: '#bfdbfe', fontWeight: '700', minWidth: 36, textAlign: 'right' },

  /* Intro */
  introWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  introCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 24,
    padding: 28, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  introEmoji:    { fontSize: 56 },
  introTitle:    { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center', marginTop: 4 },
  introSub:      { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  introDivider:  { width: 40, height: 2, backgroundColor: '#e5e7eb', borderRadius: 1, marginVertical: 8 },
  introStat:     { alignItems: 'center' },
  introStatNum:  { fontSize: 36, fontWeight: '900', color: '#1d4ed8' },
  introStatLabel:{ fontSize: 12, color: '#6b7280', fontWeight: '600', marginTop: -4 },
  introHint: {
    fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 20,
    marginTop: 4, marginBottom: 8,
  },
  startBtn: {
    width: '100%', backgroundColor: '#1d4ed8', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
  },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  /* Question card */
  questionCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  questionHeader: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  questionNum: {
    width: 28, height: 28, borderRadius: 14, flexShrink: 0,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  questionNumAnswered:     { backgroundColor: '#1d4ed8' },
  questionNumText:         { fontSize: 12, fontWeight: '800', color: '#1d4ed8' },
  questionNumTextAnswered: { color: '#fff' },
  questionText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 22 },

  /* Choices */
  choicesGrid: { gap: 8 },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#fafafa',
  },
  choiceSelected:         { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  choiceBadge: {
    width: 26, height: 26, borderRadius: 13, flexShrink: 0,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  choiceBadgeSelected:    { backgroundColor: '#1d4ed8' },
  choiceBadgeText:        { fontSize: 11, fontWeight: '800', color: '#6b7280' },
  choiceBadgeTextSelected:{ color: '#fff' },
  choiceText:             { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  choiceTextSelected:     { color: '#1d4ed8', fontWeight: '600' },

  /* Submit */
  submitBtn: {
    backgroundColor: '#1d4ed8', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
  },
  submitBtnDisabled: { backgroundColor: '#93c5fd' },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  /* Sync banner */
  syncBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fefce8', borderRadius: 14, borderWidth: 1.5, borderColor: '#fde68a',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  syncBannerGreen: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  syncBannerIcon:  { fontSize: 20 },
  syncBannerTitle: { fontSize: 13, fontWeight: '700', color: '#a16207' },
  syncBannerSub:   { fontSize: 11, color: '#a16207', marginTop: 2, lineHeight: 16 },

  /* Score */
  scoreCard: {
    borderRadius: 20, padding: 28, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  scoreEmoji:   { fontSize: 48 },
  scorePercent: { fontSize: 52, fontWeight: '900', marginTop: 6 },
  scoreLabel:   { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  scoreStatus:  { fontSize: 16, fontWeight: '700', marginTop: 4 },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 10, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#dcfce7', borderRadius: 20, borderWidth: 1, borderColor: '#86efac',
  },
  completedBadgeText: { fontSize: 13, fontWeight: '700', color: '#15803d' },

  /* Result actions */
  resultActions: { flexDirection: 'row', gap: 10 },
  retakeBtn: {
    flex: 1, backgroundColor: '#fffbeb', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#fcd34d',
  },
  retakeBtnText: { color: '#d97706', fontWeight: '700', fontSize: 14 },
  doneBtn: {
    flex: 1, backgroundColor: '#1d4ed8', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
