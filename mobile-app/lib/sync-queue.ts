/**
 * Offline quiz submission queue.
 *
 * When a student completes a quiz while offline, the submission is stored
 * here. When the app comes back online (on dashboard focus or app foreground),
 * flushQueue() is called to replay all pending submissions to the server.
 *
 * AsyncStorage key:  "pending_quiz_submissions"
 * Value:             JSON array of PendingSubmission[]
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API } from './api';
import { getToken } from './auth';
import { fetchWithTimeout } from './request';
import { saveQuizScore, markModuleViewed, type QuizScore } from './progress';

const QUEUE_KEY = 'pending_quiz_submissions';

export type PendingSubmission = {
  /** Unique ID so we can deduplicate on retry */
  id: string;
  moduleId: number;
  moduleTitle: string;
  course: 'pathfit1' | 'pathfit2';
  answers: Record<number, 'a' | 'b' | 'c' | 'd'>;
  /** Local grading result — used for offline display */
  localScore: QuizScore;
  createdAt: string;
};

/* ─── Queue helpers ─────────────────────────────────── */

export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as PendingSubmission[]) : [];
}

async function saveQueue(items: PendingSubmission[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/** Add a new pending submission (deduplicates by moduleId — keeps best score). */
export async function enqueuePendingSubmission(
  userId: number,
  sub: PendingSubmission,
): Promise<void> {
  const queue = await getPendingSubmissions();
  const idx   = queue.findIndex(q => q.moduleId === sub.moduleId);
  if (idx >= 0) {
    // Keep the higher-scoring attempt
    if (sub.localScore.percent >= queue[idx].localScore.percent) {
      queue[idx] = sub;
    }
  } else {
    queue.push(sub);
  }
  await saveQueue(queue);

  // Save score locally for display purposes — but do NOT mark the module as
  // viewed. Progress is only confirmed once the server accepts the submission.
  await saveQuizScore(userId, sub.localScore);
}

/** How many submissions are waiting to be synced. */
export async function pendingCount(): Promise<number> {
  return (await getPendingSubmissions()).length;
}

/* ─── Flush ─────────────────────────────────────────── */

export type FlushResult = {
  synced: number;
  failed: number;
};

/**
 * Attempt to submit all queued quiz answers to the server.
 * Successfully synced items are removed from the queue.
 * Items that still fail (e.g. server error) remain for the next attempt.
 */
export async function flushQueue(userId: number): Promise<FlushResult> {
  const queue = await getPendingSubmissions();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const token = await getToken();
  if (!token) return { synced: 0, failed: queue.length };

  // Don't attempt if offline — will retry on next focus
  const { isOnline } = await import('./offline');
  if (!(await isOnline())) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: PendingSubmission[] = [];

  for (const sub of queue) {
    try {
      const res = await fetchWithTimeout(
        `${API}/modules/${sub.moduleId}/quiz/submit`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ answers: sub.answers }),
        },
        15000,
      );

      if (res.ok) {
        const data = await res.json();
        // Update local cache with authoritative server result
        await saveQuizScore(userId, {
          moduleId:    sub.moduleId,
          moduleTitle: sub.moduleTitle,
          course:      sub.course,
          score:       data.score,
          total:       data.total,
          percent:     data.percent,
          takenAt:     sub.createdAt,
        });
        if (data.percent >= 75) {
          await markModuleViewed(userId, sub.moduleId);
        }
        synced++;
      } else {
        remaining.push(sub);
        failed++;
      }
    } catch {
      remaining.push(sub);
      failed++;
    }
  }

  await saveQueue(remaining);
  return { synced, failed };
}
