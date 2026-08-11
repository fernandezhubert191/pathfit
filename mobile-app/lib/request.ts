import { Platform } from 'react-native';
import { LARAVEL_VHOST } from './api';

/**
 * A fetch wrapper that:
 *  - Injects the Laravel virtual-host `Host` header so Laragon routes the
 *    request to the correct vhost even when hitting the machine's raw IP.
 *  - Aborts after `ms` milliseconds so the app never hangs on a dead server.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  ms = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  // Merge caller headers with the vhost Host header (native only — web uses
  // the real origin so we leave it alone).
  const extraHeaders: Record<string, string> =
    Platform.OS !== 'web' ? { Host: LARAVEL_VHOST } : {};

  const mergedHeaders = {
    ...extraHeaders,
    ...(options.headers as Record<string, string> | undefined),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers: mergedHeaders,
      signal: controller.signal,
    });
    return res;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Check that the server is running.');
    }
    // Suppress noisy connection errors that are expected when offline
    const msg: string = err?.message ?? '';
    const isOfflineError = msg.includes('NoRouteToHost')
      || msg.includes('Failed to connect')
      || msg.includes('Network request failed')
      || msg.includes('fetch failed');
    if (!isOfflineError) {
      console.error('[fetchWithTimeout] error hitting', url, msg);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
