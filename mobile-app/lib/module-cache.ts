/**
 * Offline module content cache.
 *
 * When a student opens a module while online the full response
 * (title, contents, quiz questions) is saved to AsyncStorage.
 * When offline the cached version is served instead.
 *
 * Keys:
 *   "module_cache:<moduleId>"   → JSON of the full moduleDetail response
 *   "module_list_cache"         → JSON array of the /modules list
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/* ─── Module list (dashboard) ───────────────────────── */

export type CachedModule = {
  id: number;
  title: string;
  course: string;
  description: string | null;
  cover_url: string | null;
};

export async function saveModuleList(modules: CachedModule[]): Promise<void> {
  await AsyncStorage.setItem('module_list_cache', JSON.stringify(modules));
}

export async function loadModuleList(): Promise<CachedModule[] | null> {
  const raw = await AsyncStorage.getItem('module_list_cache');
  return raw ? (JSON.parse(raw) as CachedModule[]) : null;
}

/* ─── Module detail (viewer) ────────────────────────── */

export type CachedModuleDetail = {
  module: {
    id: number;
    title: string;
    course: string;
    description: string | null;
    cover_url: string | null;
    exercise_video_enabled: boolean;
    exercise_video_label: string | null;
  };
  contents: Array<{
    id: number;
    type: 'text' | 'title' | 'image' | 'video';
    content: string;
    caption: string | null;
    order: number;
  }>;
  quiz: {
    id: number;
    title: string;
    questions: Array<{
      id: number;
      question: string;
      choices: { a: string; b: string; c: string; d: string };
    }>;
  } | null;
};

function detailKey(moduleId: string | number): string {
  return `module_cache:${moduleId}`;
}

export async function saveModuleDetail(
  moduleId: string | number,
  data: CachedModuleDetail,
): Promise<void> {
  await AsyncStorage.setItem(detailKey(moduleId), JSON.stringify(data));
}

export async function loadModuleDetail(
  moduleId: string | number,
): Promise<CachedModuleDetail | null> {
  const raw = await AsyncStorage.getItem(detailKey(moduleId));
  return raw ? (JSON.parse(raw) as CachedModuleDetail) : null;
}

/* ─── Quiz answers cache (for offline grading) ──────── */

/** questionId → correct letter */
export type CachedAnswers = Record<number, 'a' | 'b' | 'c' | 'd'>;

function answersKey(moduleId: string | number): string {
  return `quiz_answers:${moduleId}`;
}

export async function saveQuizAnswers(
  moduleId: string | number,
  answers: CachedAnswers,
): Promise<void> {
  await AsyncStorage.setItem(answersKey(moduleId), JSON.stringify(answers));
}

export async function loadQuizAnswers(
  moduleId: string | number,
): Promise<CachedAnswers | null> {
  const raw = await AsyncStorage.getItem(answersKey(moduleId));
  return raw ? (JSON.parse(raw) as CachedAnswers) : null;
}
