import { Platform } from 'react-native';

/**
 * Laragon virtual host name — matches what's in the PC hosts file.
 * Sent as the Host header so Apache routes to the right vhost.
 * The phone itself cannot resolve this name via DNS.
 */
export const LARAVEL_VHOST = 'system.test';

/**
 * Your machine's local network IP (visible to devices on the same WiFi).
 * Find it with: ipconfig  →  IPv4 Address on your WiFi adapter.
 */
export const LARAVEL_IP = '192.168.1.13';

export const LARAVEL_PORT = 80; // Laragon default

/** Root URL of the Laravel server as seen from the phone (uses LAN IP). */
export const LARAVEL_BASE = LARAVEL_PORT === 80
  ? `http://${LARAVEL_IP}`
  : `http://${LARAVEL_IP}:${LARAVEL_PORT}`;

function buildApiBase(): string {
  if (Platform.OS === 'web') {
    return `http://${LARAVEL_VHOST}/api/mobile`;
  }

  const portSuffix = LARAVEL_PORT === 80 ? '' : `:${LARAVEL_PORT}`;
  const url = `http://${LARAVEL_IP}${portSuffix}/api/mobile`;
  console.log('[API] resolved URL:', url);
  return url;
}

export const API = buildApiBase();

/**
 * Rewrite any URL that contains the vhost hostname to use the machine's
 * real LAN IP instead. Also handles bare /storage/... paths by prepending
 * the IP base. This is needed for Image components which make direct
 * connections and cannot use the Host header trick.
 *
 * e.g. "http://system.test/storage/modules/1/img.jpg"
 *   →  "http://192.168.1.5/storage/modules/1/img.jpg"
 *
 * e.g. "/storage/modules/1/img.jpg"
 *   →  "http://192.168.1.5/storage/modules/1/img.jpg"
 */
export function toDirectUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (Platform.OS === 'web') return url; // web resolves system.test fine
  const portSuffix = LARAVEL_PORT === 80 ? '' : `:${LARAVEL_PORT}`;
  const base = `http://${LARAVEL_IP}${portSuffix}`;

  // Already using the vhost — replace hostname
  if (/^https?:\/\//i.test(url)) {
    return url.replace(
      new RegExp(`https?://${LARAVEL_VHOST}(:\\d+)?`, 'i'),
      base,
    );
  }

  // Bare relative path like /storage/... — prepend IP base
  if (url.startsWith('/')) return base + url;

  // Raw storage path without leading slash e.g. "modules/1/videos/foo.mp4"
  return `${base}/storage/${url}`;
}
