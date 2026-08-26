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

/* ─── One-time migration: purge base64-bloated cache entries ─────────────
 *
 * Before the SQLITE_FULL fix, image content blocks were stored as full
 * base64 data URIs in AsyncStorage. This migration detects and removes
 * those oversized entries so the device recovers the storage space.
 *
 * The flag "module_cache_v2_migrated" is set after the first run so the
 * scan only happens once.
 * ─────────────────────────────────────────────────────────────────────── */

const MIGRATION_FLAG = 'module_cache_v2_migrated';

export async function purgeBase64ImageCache(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(MIGRATION_FLAG);
    if (done) return; // already ran

    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.startsWith('module_cache:'));

    for (const key of cacheKeys) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;

        // If any content block contains a base64 data URI, the entry is
        // bloated — strip the base64 out by replacing it with an empty
        // string so the module is re-fetched fresh on next open.
        if (raw.includes('"data:image/')) {
          const parsed: CachedModuleDetail = JSON.parse(raw);
          const cleaned = {
            ...parsed,
            contents: parsed.contents.map(block =>
              block.content.startsWith('data:image/')
                ? { ...block, content: '' }   // blank → triggers fresh fetch
                : block,
            ),
          };
          // If every image block is now blank, just delete the whole entry
          // so the module is fetched fresh rather than showing broken images.
          const hasBlankImage = cleaned.contents.some(
            b => b.type === 'image' && b.content === '',
          );
          if (hasBlankImage) {
            await AsyncStorage.removeItem(key);
          } else {
            await AsyncStorage.setItem(key, JSON.stringify(cleaned));
          }
        }
      } catch {
        // If a single entry is corrupt just remove it
        await AsyncStorage.removeItem(key).catch(() => {});
      }
    }

    await AsyncStorage.setItem(MIGRATION_FLAG, '1');
    console.log('[module-cache] base64 purge complete, cleared', cacheKeys.length, 'candidates');
  } catch (e: any) {
    console.warn('[module-cache] migration error:', e?.message);
  }
}
