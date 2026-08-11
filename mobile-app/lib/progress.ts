import AsyncStorage from '@react-native-async-storage/async-storage';
import { API } from './api';
import { getToken } from './auth';
import { fetchWithTimeout } from './request';

/**
 * Tracks which modules a student has completed (≥75% quiz score).
 *
 * Source of truth: server (student_progress table).
 * AsyncStorage is used as a local cache so the UI works offline.
 *
 * Key format: "progress:<userId>"  → JSON array of module IDs (numbers)
 *             "scores:<userId>"    → JSON array of QuizScore objects
 */

function progressKey(userId: number): string {
  return `progress:${userId}`;
}

function scoresKey(userId: number): string {
  return `scores:${userId}`;
}

export type QuizScore = {
  moduleId: number;
  moduleTitle: string;
  course: 'pathfit1' | 'pathfit2';
  attempt: number;
  score: number;
  total: number;
  percent: number;
  takenAt: string; // ISO date string
};

/* ─── Server sync ──────────────────────────────────── */

/**
 * Fetch the student's own progress from the server and merge it into
 * AsyncStorage. Returns the up-to-date viewed set and quiz scores.
 * Falls back to the locally cached values if the request fails.
 */
export async function syncProgressFromServer(userId: number): Promise<{
  viewed: Set<number>;
  scores: QuizScore[];
}> {
  try {
    const token = await getToken();
    if (!token) throw new Error('no token');

    const res = await fetchWithTimeout(`${API}/my-progress`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }, 8000);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    const completedIds: number[] = data.completed_module_ids ?? [];
    const serverScores: QuizScore[] = (data.quiz_results ?? []).map((r: any) => ({
      moduleId:    r.moduleId,
      moduleTitle: r.moduleTitle,
      course:      r.course ?? 'pathfit1',
      attempt:     r.attempt ?? 1,
      score:       r.score,
      total:       r.total,
      percent:     r.percent,
      takenAt:     r.takenAt,
    }));

    // Persist to local cache
    await AsyncStorage.setItem(progressKey(userId), JSON.stringify(completedIds));
    await AsyncStorage.setItem(scoresKey(userId), JSON.stringify(serverScores));

    return { viewed: new Set(completedIds), scores: serverScores };
  } catch {
    // Server unreachable — return whatever is cached locally
    const [v, s] = await Promise.all([
      getViewedModules(userId),
      getQuizScores(userId),
    ]);
    return { viewed: v, scores: s };
  }
}

/* ─── Local cache helpers ──────────────────────────── */

/** Returns the set of completed module IDs from local cache. */
export async function getViewedModules(userId: number): Promise<Set<number>> {
  const raw = await AsyncStorage.getItem(progressKey(userId));
  if (!raw) return new Set();
  return new Set(JSON.parse(raw) as number[]);
}

/**
 * Optimistically marks a module as viewed in local cache.
 * The authoritative record is written server-side on quiz submit.
 */
export async function markModuleViewed(userId: number, moduleId: number): Promise<void> {
  const viewed = await getViewedModules(userId);
  viewed.add(moduleId);
  await AsyncStorage.setItem(progressKey(userId), JSON.stringify([...viewed]));
}

/** Returns all stored quiz scores from local cache, newest first. */
export async function getQuizScores(userId: number): Promise<QuizScore[]> {
  const raw = await AsyncStorage.getItem(scoresKey(userId));
  if (!raw) return [];
  return JSON.parse(raw) as QuizScore[];
}

/**
 * Saves a quiz attempt to local cache.
 * Every attempt is appended; the server is the authoritative source.
 */
export async function saveQuizScore(userId: number, entry: QuizScore): Promise<void> {
  const scores = await getQuizScores(userId);
  scores.unshift(entry);
  await AsyncStorage.setItem(scoresKey(userId), JSON.stringify(scores));
}
