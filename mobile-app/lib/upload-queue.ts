/**
 * Offline exercise-video upload queue.
 *
 * When a student picks a video while offline (or the upload fails due to
 * connectivity), the file reference is stored here.  When the app detects
 * a network connection again (on focus / foreground / manual retry) the
 * queue is flushed by calling `flushUploadQueue()`.
 *
 * AsyncStorage key:  "pending_video_uploads"
 * Value:             JSON array of PendingVideoUpload[]
 *
 * Note: only the *local URI* is stored, not the video bytes themselves, so
 * the file must still exist on-device when the flush runs.  Expo's image
 * picker URIs persist until the user manually clears app data or the OS
 * reclaims storage, so this is fine in practice.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API, LARAVEL_VHOST } from './api';
import { getToken } from './auth';
import { isOnline } from './offline';

const QUEUE_KEY = 'pending_video_uploads';

/* ─── Types ──────────────────────────────────────────── */

export type PendingVideoUpload = {
  /** Stable local identifier — used to deduplicate (one pending per module). */
  id: string;
  moduleId: string;
  /** Local file URI returned by expo-image-picker. */
  uri: string;
  /** Safe filename including extension, e.g. "exercise.mp4". */
  name: string;
  /** MIME type, e.g. "video/mp4". */
  type: string;
  /** ISO timestamp when the student picked the video. */
  queuedAt: string;
};

export type FlushUploadResult = {
  synced: number;
  failed: number;
};

/* ─── Queue helpers ──────────────────────────────────── */

export async function getPendingUploads(): Promise<PendingVideoUpload[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as PendingVideoUpload[]) : [];
}

async function saveQueue(items: PendingVideoUpload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/**
 * Add (or replace) a pending upload for the given module.
 * Only one pending upload per module is kept — the latest pick wins.
 */
export async function enqueuePendingUpload(item: PendingVideoUpload): Promise<void> {
  const queue = await getPendingUploads();
  const idx   = queue.findIndex(q => q.moduleId === item.moduleId);
  if (idx >= 0) {
    queue[idx] = item;
  } else {
    queue.push(item);
  }
  await saveQueue(queue);
}

/** Remove a pending upload by its ID (after successful sync). */
export async function dequeuePendingUpload(id: string): Promise<void> {
  const queue = await getPendingUploads();
  await saveQueue(queue.filter(q => q.id !== id));
}

/** How many uploads are queued. */
export async function pendingUploadCount(): Promise<number> {
  return (await getPendingUploads()).length;
}

/** Returns true if `moduleId` has a pending (queued) upload. */
export async function hasQueuedUpload(moduleId: string): Promise<boolean> {
  const queue = await getPendingUploads();
  return queue.some(q => q.moduleId === moduleId);
}

/* ─── Flush ──────────────────────────────────────────── */

type UploadListener = (moduleId: string) => void;

/** Registered listeners that are notified when an upload succeeds. */
const _successListeners = new Set<UploadListener>();

export function addUploadSuccessListener(fn: UploadListener): () => void {
  _successListeners.add(fn);
  return () => _successListeners.delete(fn);
}

function notifySuccess(moduleId: string) {
  _successListeners.forEach(fn => {
    try { fn(moduleId); } catch { /* ignore */ }
  });
}

/**
 * Attempt to upload all queued videos to the server.
 *
 * - Items that succeed are removed from the queue.
 * - Items that fail (connectivity or server error) remain for the next attempt.
 * - Calls `onProgress(moduleId, 0–1)` during each upload so the UI can
 *   show a live progress indicator.
 */
export async function flushUploadQueue(
  onProgress?: (moduleId: string, progress: number) => void,
): Promise<FlushUploadResult> {
  const queue = await getPendingUploads();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const token = await getToken();
  if (!token) return { synced: 0, failed: queue.length };

  if (!(await isOnline())) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: PendingVideoUpload[] = [];

  for (const item of queue) {
    try {
      await new Promise<void>((resolve, reject) => {
        const formData = new FormData();
        formData.append('video', { uri: item.uri, name: item.name, type: item.type } as any);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API}/modules/${item.moduleId}/exercise/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Accept', 'application/json');
        if (Platform.OS !== 'web') {
          xhr.setRequestHeader('Host', LARAVEL_VHOST);
        }

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress?.(item.moduleId, Math.min(e.loaded / e.total, 1));
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const body = JSON.parse(xhr.responseText);
              reject(new Error(body?.message ?? `Server error ${xhr.status}`));
            } catch {
              reject(new Error(`Server error ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });

      // Success — remove from queue and notify listeners
      await dequeuePendingUpload(item.id);
      notifySuccess(item.moduleId);
      synced++;
    } catch {
      remaining.push(item);
      failed++;
    }
  }

  // Persist anything that still failed
  if (remaining.length > 0) {
    const currentQueue = await getPendingUploads();
    // Keep items that were not processed in this run (shouldn't happen, but safe)
    const stillQueued = currentQueue.filter(q =>
      remaining.some(r => r.id === q.id),
    );
    await saveQueue(stillQueued);
  }

  return { synced, failed };
}
