import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ScrollView, StatusBar, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* ─────────────────────────────────────────────────────
   Quiz Result Detail Screen
   Accepts params:
     moduleTitle  – name of the module
     quizTitle    – name of the quiz (optional, falls back to moduleTitle)
     score        – number of correct answers
     total        – total questions
     percent      – 0-100
     takenAt      – ISO date string
     course       – 'pathfit1' | 'pathfit2'
   ───────────────────────────────────────────────────── */
export default function QuizResultDetailScreen() {
  const router = useRouter();
  const {
    moduleTitle,
    quizTitle,
    attempt,
    score,
    total,
    percent,
    takenAt,
    course,
  } = useLocalSearchParams<{
    moduleTitle: string;
    quizTitle?: string;
    attempt?: string;
    score: string;
    total: string;
    percent: string;
    takenAt: string;
    course: string;
  }>();

  const pct      = Number(percent ?? 0);
  const sc       = Number(score   ?? 0);
  const tot      = Number(total   ?? 0);
  const passed   = pct >= 75;
  const isP2     = course === 'pathfit2';

  const accentColor  = passed ? (isP2 ? '#0ca678' : '#1c7ed6') : '#dc2626';
  const lightBg      = passed ? (isP2 ? '#ecfdf5'  : '#eff6ff') : '#fef2f2';
  const borderColor  = passed ? (isP2 ? '#a7f3d0'  : '#bfdbfe') : '#fecaca';
  const courseLabel  = isP2   ? 'Pathfit 2' : 'Pathfit 1';
  const courseEmoji  = isP2   ? '🧘' : '🏃';

  const displayDate = takenAt
    ? new Date(takenAt).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : '—';
  const displayTime = takenAt
    ? new Date(takenAt).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  /* ── Circular progress ring via border trick ── */
  const ringDeg     = Math.round((pct / 100) * 360);
  const ringColor   = accentColor;

  const wrong  = tot - sc;
  const missedPct = tot > 0 ? Math.round((wrong / tot) * 100) : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={[s.backText, { color: accentColor }]}>‹ Back</Text>
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={s.topTitle}>Quiz Result</Text>
          <Text style={s.topSub}>{courseEmoji} {courseLabel}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}>

        {/* ── Score hero ── */}
        <View style={[s.heroCard, { backgroundColor: lightBg, borderColor }]}>
          {/* Big percent circle */}
          <View style={s.circleWrap}>
            <View style={[s.circleOuter, { borderColor: passed ? borderColor : '#fecaca' }]}>
              <View style={[s.circleInner, { backgroundColor: lightBg }]}>
                <Text style={[s.circlePercent, { color: accentColor }]}>{pct}%</Text>
                <Text style={[s.circleFraction, { color: accentColor }]}>{sc}/{tot}</Text>
              </View>
            </View>
          </View>

          {/* Status badge */}
          <View style={[s.statusBadge, { backgroundColor: passed ? accentColor : '#dc2626' }]}>
            <Text style={s.statusBadgeText}>
              {passed ? '✓  Passed' : '✕  Failed'}
            </Text>
          </View>

          {/* Module & quiz name */}
          <Text style={s.heroModule} numberOfLines={2}>{moduleTitle}</Text>
          {quizTitle && quizTitle !== moduleTitle && (
            <Text style={s.heroQuizName} numberOfLines={1}>{quizTitle}</Text>
          )}
          {attempt && Number(attempt) > 0 && (
            <Text style={s.heroAttempt}>Attempt #{attempt}</Text>
          )}

          {/* Date taken */}
          <Text style={s.heroDate}>{displayDate}{displayTime ? `  ·  ${displayTime}` : ''}</Text>
        </View>

        {/* ── Stats row ── */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { borderColor, backgroundColor: lightBg }]}>
            <Text style={[s.statNum, { color: accentColor }]}>{sc}</Text>
            <Text style={s.statLabel}>Correct</Text>
          </View>
          <View style={[s.statCard, { borderColor: '#fecaca', backgroundColor: '#fef2f2' }]}>
            <Text style={[s.statNum, { color: '#dc2626' }]}>{wrong}</Text>
            <Text style={s.statLabel}>Wrong</Text>
          </View>
          <View style={[s.statCard, { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' }]}>
            <Text style={[s.statNum, { color: '#475569' }]}>{tot}</Text>
            <Text style={s.statLabel}>Total</Text>
          </View>
        </View>

        {/* ── Score breakdown bar ── */}
        <View style={s.breakdownCard}>
          <Text style={s.breakdownTitle}>Score Breakdown</Text>

          {/* Correct bar */}
          <View style={s.barRow}>
            <Text style={[s.barLabel, { color: accentColor }]}>Correct</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, {
                width: `${pct}%` as any,
                backgroundColor: accentColor,
              }]} />
            </View>
            <Text style={[s.barPct, { color: accentColor }]}>{pct}%</Text>
          </View>

          {/* Wrong bar */}
          <View style={s.barRow}>
            <Text style={[s.barLabel, { color: '#dc2626' }]}>Wrong</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, {
                width: `${missedPct}%` as any,
                backgroundColor: '#fca5a5',
              }]} />
            </View>
            <Text style={[s.barPct, { color: '#dc2626' }]}>{missedPct}%</Text>
          </View>

          {/* Pass threshold line indicator */}
          <View style={s.thresholdRow}>
            <View style={s.thresholdLine} />
            <Text style={s.thresholdText}>75% required to pass</Text>
            <View style={s.thresholdLine} />
          </View>
        </View>

        {/* ── Result message ── */}
        <View style={[s.messageCard, {
          backgroundColor: passed ? lightBg : '#fef2f2',
          borderColor:     passed ? borderColor : '#fecaca',
        }]}>
          <Text style={s.messageEmoji}>{passed ? (pct === 100 ? '🏆' : '🎉') : '📚'}</Text>
          <Text style={[s.messageTitle, { color: accentColor }]}>
            {passed
              ? pct === 100 ? 'Perfect Score!' : 'Great job!'
              : 'Keep practicing'}
          </Text>
          <Text style={s.messageBody}>
            {passed
              ? `You scored ${pct}% and completed this lesson. ${pct >= 90 ? 'Excellent work!' : 'Well done!'}`
              : `You scored ${pct}%. A score of 75% or higher is needed to mark this lesson as complete.`}
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

  /* Top bar */
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn:   { width: 60 },
  backText:  { fontSize: 16, fontWeight: '600' },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle:  { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  topSub:    { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  /* Hero */
  heroCard: {
    borderRadius: 20, borderWidth: 1.5,
    padding: 24, alignItems: 'center', gap: 8,
  },

  circleWrap: { marginBottom: 4 },
  circleOuter: {
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 6, alignItems: 'center', justifyContent: 'center',
  },
  circleInner: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center',
  },
  circlePercent:  { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  circleFraction: { fontSize: 13, fontWeight: '700', marginTop: -2, opacity: 0.75 },

  statusBadge: {
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 6,
  },
  statusBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  heroModule:   { fontSize: 15, fontWeight: '700', color: '#0f172a', textAlign: 'center', lineHeight: 22 },
  heroQuizName: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  heroAttempt:  { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  heroDate:     { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  /* Stats row */
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, borderRadius: 16, borderWidth: 1.5,
    paddingVertical: 16, alignItems: 'center', gap: 3,
  },
  statNum:   { fontSize: 26, fontWeight: '900' },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },

  /* Breakdown */
  breakdownCard: {
    backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1,
    borderColor: '#e2e8f0', padding: 16, gap: 12,
  },
  breakdownTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 2 },

  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { fontSize: 11, fontWeight: '700', width: 48 },
  barTrack: {
    flex: 1, height: 8, backgroundColor: '#e2e8f0',
    borderRadius: 4, overflow: 'hidden',
  },
  barFill:  { height: '100%', borderRadius: 4 },
  barPct:   { fontSize: 11, fontWeight: '800', width: 34, textAlign: 'right' },

  thresholdRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2,
  },
  thresholdLine: { flex: 1, height: 1, backgroundColor: '#cbd5e1' },
  thresholdText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },

  /* Message */
  messageCard: {
    borderRadius: 16, borderWidth: 1.5,
    padding: 20, alignItems: 'center', gap: 6,
  },
  messageEmoji: { fontSize: 36 },
  messageTitle: { fontSize: 16, fontWeight: '800' },
  messageBody:  {
    fontSize: 13, color: '#475569', textAlign: 'center',
    lineHeight: 20, marginTop: 2,
  },
});
