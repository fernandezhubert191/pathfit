/**
 * Background module pre-cacher.
 *
 * Called after the module list loads while online. Fetches and caches
 * every module's content, images (as base64), quiz questions, and quiz
 * answers — so all content is available offline without the student
 * needing to open each module individually.
 *
 * Runs silently; never throws; never blocks the UI.
 */

import { Platform } from 'react-native';
import { API, LARAVEL_VHOST, toDirectUrl } from './api';
import { getToken } from './auth';
import { fetchWithTimeout } from './request';
import {
  saveModuleDetail,
  saveQuizAnswers,
  loadModuleDetail,
  type CachedModule,
} from './module-cache';

const CACHE_VERSION_KEY = 'bg_cache_version';

/** Fetch an image URL and return a base64 data URI, or null on failure. */
async function toBase64(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { Host: LARAVEL_VHOST, Accept: 'image/*' } },
      20000,
    );
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    let binary   = '';
    const CHUNK  = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK)
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    const mime = res.headers.get('content-type') ?? 'image/jpeg';
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

/** Cache a single module. Returns true if newly cached (or updated). */
async function cacheModule(moduleId: number, token: string): Promise<boolean> {
  try {
    // Fetch module detail
    const res = await fetchWithTimeout(`${API}/modules/${moduleId}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }, 20000);
    if (!res.ok) return false;
    const data = await res.json();

    // Convert image blocks to base64 (native only)
    const contents = await Promise.all(
      (data.contents ?? []).map(async (block: any) => {
        if (block.type !== 'image' || Platform.OS === 'web') return block;
        const b64 = await toBase64(toDirectUrl(block.content));
        return b64 ? { ...block, content: b64 } : block;
      }),
    );

    // Save module detail
    await saveModuleDetail(moduleId, {
      module:   data.module,
      contents,
      quiz:     data.quiz ?? null,
    });

    // Fetch and save correct answers
    if (data.quiz) {
      try {
        const aRes = await fetchWithTimeout(
          `${API}/modules/${moduleId}/quiz/answers`,
          { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
          10000,
        );
        if (aRes.ok) {
          const aData = await aRes.json();
          await saveQuizAnswers(moduleId, aData.answers ?? {});
        }
      } catch { /* non-critical */ }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Pre-cache all modules in the background.
 * Already-cached modules are skipped unless `force` is true.
 * Processes sequentially to avoid hammering the server.
 */
export async function precacheAllModules(
  modules: CachedModule[],
  force = false,
): Promise<void> {
  const token = await getToken();
  if (!token) return;

  for (const mod of modules) {
    // Skip if already cached and not forced
    if (!force) {
      const existing = await loadModuleDetail(mod.id);
      if (existing) continue;
    }
    await cacheModule(mod.id, token);
  }
}
