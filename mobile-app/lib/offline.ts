/**
 * Offline video cache manager.
 *
 * Each download is scoped to a user ID so multiple accounts on the same
 * device have completely separate caches.
 *
 * AsyncStorage key:  "offline_video:u<userId>:<sanitised_url>"  → local file URI
 * File path:         <documentDirectory>offline_u<userId>_<sanitised_url>
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';

/* ─── Network ───────────────────────────────────────── */

/** Returns true when the device has any network connection. */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    // Only treat as offline when explicitly disconnected.
    // isInternetReachable can be null (unknown) — treat that as online.
    if (state.isConnected === false) return false;
    return true;
  } catch {
    return true; // assume online if the check itself fails
  }
}

/* ─── Key helpers ───────────────────────────────────── */

function sanitise(url: string): string {
  // Keep only alphanumeric + dot + dash, replace everything else with _
  return url.replace(/[^a-zA-Z0-9.\-]/g, '_').slice(-120);
}

function storageKey(userId: number, url: string): string {
  return `offline_video:u${userId}:${sanitise(url)}`;
}

function localPath(userId: number, url: string): string {
  return `${FileSystem.documentDirectory}offline_u${userId}_${sanitise(url)}`;
}

/* ─── Public API ─────────────────────────────────────── */

export type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error';

/**
 * Check whether a video URL has already been cached locally for this user.
 * Also verifies the file still exists on disk (guards against app reinstall).
 */
export async function getCachedVideoUri(userId: number, url: string): Promise<string | null> {
  const key = storageKey(userId, url);
  const stored = await AsyncStorage.getItem(key);
  if (!stored) return null;

  // Verify file still exists
  const info = await FileSystem.getInfoAsync(stored);
  if (!info.exists) {
    await AsyncStorage.removeItem(key);
    return null;
  }
  return stored;
}

/** Active download tasks, keyed by "userId:url" — allows cancellation. */
const _activeTasks = new Map<string, FileSystem.DownloadResumable>();

function taskKey(userId: number, url: string): string {
  return `${userId}:${url}`;
}

/**
 * Get the remote file size in bytes without downloading.
 * Returns null if the server doesn't send Content-Length.
 */
export async function getRemoteFileSize(
  url: string,
  headers: Record<string, string> = {},
): Promise<number | null> {
  try {
    const res = await fetch(url, { method: 'HEAD', headers });
    const len = res.headers.get('content-length');
    return len ? parseInt(len, 10) : null;
  } catch {
    return null;
  }
}

/** Format bytes to a human-readable string (e.g. "45.2 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Get the size of a locally cached file in bytes for this user. Returns null if not found. */
export async function getCachedFileSize(userId: number, url: string): Promise<number | null> {
  const key    = storageKey(userId, url);
  const stored = await AsyncStorage.getItem(key);
  if (!stored) return null;
  const info = await FileSystem.getInfoAsync(stored, { size: true });
  if (!info.exists) return null;
  return (info as FileSystem.FileInfo & { size?: number }).size ?? null;
}

/**
 * Download a video from `url` to local storage for the given user.
 * Calls `onProgress(0–1)` during download.
 * Returns the local file URI on success.
 */
export async function downloadVideo(
  userId: number,
  url: string,
  headers: Record<string, string>,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const dest = localPath(userId, url);
  const key  = taskKey(userId, url);

  // Remove stale file if present
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) await FileSystem.deleteAsync(dest, { idempotent: true });

  const task = FileSystem.createDownloadResumable(
    url,
    dest,
    { headers },
    (snap) => {
      const p = snap.totalBytesExpectedToWrite > 0
        ? snap.totalBytesWritten / snap.totalBytesExpectedToWrite
        : 0;
      onProgress?.(p);
    },
  );

  _activeTasks.set(key, task);

  try {
    const result = await task.downloadAsync();
    if (!result) throw new Error('Download failed');
    await AsyncStorage.setItem(storageKey(userId, url), result.uri);
    return result.uri;
  } finally {
    _activeTasks.delete(key);
  }
}

/**
 * Cancel an in-progress download for the given user + URL.
 * Cleans up the partial file.
 */
export async function cancelDownload(userId: number, url: string): Promise<void> {
  const key  = taskKey(userId, url);
  const task = _activeTasks.get(key);
  if (task) {
    try { await task.cancelAsync(); } catch { /* ignore */ }
    _activeTasks.delete(key);
  }
  // Clean up partial file
  const dest = localPath(userId, url);
  await FileSystem.deleteAsync(dest, { idempotent: true });
}

/**
 * Delete a cached video for the given user.
 */
export async function deleteCachedVideo(userId: number, url: string): Promise<void> {
  const sKey = storageKey(userId, url);
  const dest = localPath(userId, url);
  await AsyncStorage.removeItem(sKey);
  await FileSystem.deleteAsync(dest, { idempotent: true });
}
