import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Image, Modal,
  Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';

import { API, LARAVEL_VHOST, LARAVEL_IP, LARAVEL_PORT, toDirectUrl } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { fetchWithTimeout } from '@/lib/request';
import {
  isOnline, getCachedVideoUri, downloadVideo, cancelDownload, deleteCachedVideo,
  getRemoteFileSize, getCachedFileSize, formatBytes,
  type DownloadStatus,
} from '@/lib/offline';
import { saveModuleDetail, loadModuleDetail, saveQuizAnswers } from '@/lib/module-cache';
import { getQuizScores, type QuizScore } from '@/lib/progress';
import {
  enqueuePendingUpload, hasQueuedUpload, dequeuePendingUpload,
  flushUploadQueue, addUploadSuccessListener,
  type PendingVideoUpload,
} from '@/lib/upload-queue';

/* ── Types ─────────────────────────────────────────── */
type ContentBlock = {
  id: number;
  type: 'text' | 'title' | 'image' | 'video';
  content: string;
  /** Authenticated range-request stream URL returned by the backend for uploaded videos. */
  stream_url?: string | null;
  caption: string | null;
  order: number;
};
type QuizQuestion = {
  id: number; question: string;
  choices: { a: string; b: string; c: string; d: string };
};
type QuizData = { id: number; title: string; questions: QuizQuestion[] };

/* ── YouTube / Vimeo / Google Drive embed helper ─────── */
function toEmbed(url: string): string | null {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  // Google Drive share link → preview embed
  // https://drive.google.com/file/d/FILE_ID/view?usp=...
  const gd = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (gd) return `https://drive.google.com/file/d/${gd[1]}/preview`;
  return null;
}

/* ── Bold text renderer ─────────────────────────────── */
function BoldText({ text, style }: { text: string; style?: object }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <Text key={i} style={{ fontWeight: '700' }}>{part.slice(2, -2)}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

/* ── Network banner ─────────────────────────────────── */
function OfflineBanner() {
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineBannerIcon}>📡</Text>
      <Text style={styles.offlineBannerText}>Offline — showing cached content</Text>
    </View>
  );
}

/* ── Quiz card ──────────────────────────────────────── */
function QuizCard({
  quiz,
  bestScore,
  onPress,
  videoRequired,
}: {
  quiz: QuizData;
  bestScore: QuizScore | null;
  onPress: () => void;
  videoRequired?: boolean;
}) {
  const hasTaken = bestScore !== null;
  const pct      = hasTaken ? bestScore!.percent : 0;
  const passed   = hasTaken && pct >= 75;

  // Locked — video upload required first
  if (videoRequired) {
    return (
      <View style={[styles.quizCard, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
        <View style={[styles.quizCardIcon, { backgroundColor: '#94a3b8' }]}>
          <Text style={styles.quizCardEmoji}>🔒</Text>
        </View>
        <View style={styles.quizCardInfo}>
          <Text style={[styles.quizCardTitle, { color: '#64748b' }]} numberOfLines={1}>
            {quiz.title}
          </Text>
          <Text style={[styles.quizCardSub, { color: '#94a3b8', opacity: 1 }]}>
            Upload your exercise video first to unlock.
          </Text>
        </View>
        <View style={[styles.quizCardArrow, { backgroundColor: '#e2e8f0' }]}>
          <Text style={[styles.quizCardArrowText, { color: '#94a3b8' }]}>🔒</Text>
        </View>
      </View>
    );
  }

  const accent  = passed ? '#059669' : hasTaken ? '#d97706' : '#1d4ed8';
  const bgLight = passed ? '#ecfdf5' : hasTaken ? '#fffbeb' : '#eff6ff';
  const border  = passed ? '#6ee7b7' : hasTaken ? '#fcd34d' : '#93c5fd';
  const barBg   = passed ? '#d1fae5' : hasTaken ? '#fef3c7' : '#dbeafe';

  return (
    <TouchableOpacity
      style={[styles.quizCard, { backgroundColor: bgLight, borderColor: border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Icon */}
      <View style={[styles.quizCardIcon, { backgroundColor: accent }]}>
        <Text style={styles.quizCardEmoji}>📝</Text>
      </View>

      {/* Middle — title + bar */}
      <View style={styles.quizCardInfo}>
        <Text style={[styles.quizCardTitle, { color: accent }]} numberOfLines={1}>
          {quiz.title}
        </Text>
        {hasTaken ? (
          <View style={styles.quizBarRow}>
            <View style={[styles.quizBarTrack, { backgroundColor: barBg }]}>
              <View style={[styles.quizBarFill, { backgroundColor: accent, width: `${pct}%` as any }]} />
            </View>
            <Text style={[styles.quizBarPct, { color: accent }]}>{pct}%</Text>
          </View>
        ) : (
          <Text style={[styles.quizCardSub, { color: accent, opacity: 0.7 }]}>
            {quiz.questions.length} {quiz.questions.length === 1 ? 'question' : 'questions'}
          </Text>
        )}
      </View>

      {/* CTA arrow */}
      <View style={[styles.quizCardArrow, { backgroundColor: accent }]}>
        <Text style={styles.quizCardArrowText}>{hasTaken ? '🔁' : '›'}</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ══════════════════════════════════════════════════════
   Main Screen
══════════════════════════════════════════════════════ */
export default function ModuleViewer() {
  const router  = useRouter();
  const { id, role } = useLocalSearchParams<{ id: string; role?: string }>();
  const isTeacher = role === 'teacher';

  const [loading, setLoading]         = useState(true);
  const [contents, setContents]       = useState<ContentBlock[]>([]);
  const [quiz, setQuiz]               = useState<QuizData | null>(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [online, setOnline]           = useState(true);
  const [userId, setUserId]           = useState<number | null>(null);
  const [bestScore, setBestScore]     = useState<QuizScore | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [exerciseVideoEnabled, setExerciseVideoEnabled] = useState(false);
  const [hasExerciseVideo, setHasExerciseVideo]         = useState<boolean | null>(null);
  const [exerciseVideoLabel, setExerciseVideoLabel]     = useState('');
  /** True when there is a video queued for upload but not yet on the server. */
  const [hasPendingUpload, setHasPendingUpload]         = useState(false);

  const refreshBestScore = useCallback(async (uid: number) => {
    const scores = await getQuizScores(uid);
    const moduleScores = scores.filter(s => String(s.moduleId) === String(id));
    if (moduleScores.length > 0) {
      const best = moduleScores.reduce((a, b) => (a.percent >= b.percent ? a : b));
      setBestScore(best);
      setIsCompleted(best.percent >= 75);
    } else {
      setBestScore(null);
      setIsCompleted(false);
    }
  }, [id]);

  useEffect(() => {
    isOnline().then(setOnline);
    getUser().then(u => {
      if (u) {
        setUserId(u.id);
        refreshBestScore(u.id);
      }
    });
    // Check if there's already a pending upload queued for this module
    hasQueuedUpload(id).then(setHasPendingUpload);
  }, [id]);

  useFocusEffect(useCallback(() => {
    if (userId !== null) refreshBestScore(userId);
  }, [userId, refreshBestScore]));

  // Re-check exercise video status every time screen comes into focus
  // so the quiz lock/unlock updates instantly after an upload.
  useFocusEffect(useCallback(() => {
    if (!exerciseVideoEnabled) return;
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetchWithTimeout(`${API}/modules/${id}/exercise/video`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (res.ok && active) {
          const data = await res.json();
          setHasExerciseVideo(data.video !== null);
        }
      } catch { /* silent — keep previous state */ }
    })();
    return () => { active = false; };
  }, [id, exerciseVideoEnabled]));

  useEffect(() => {
    (async () => {
      const token  = await getToken();
      const online = await isOnline();

      if (!token) { router.replace('/'); return; }

      // Try to load from server when online
      if (online) {
        try {
          const res = await fetchWithTimeout(`${API}/modules/${id}`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            console.log(`[ModuleViewer] module ${id} — server returned ${data.contents?.length ?? 0} blocks`);
            setModuleTitle(data.module?.title ?? '');
            setContents(data.contents ?? []);
            setQuiz(data.quiz ?? null);
            setExerciseVideoEnabled(data.module?.exercise_video_enabled ?? false);
            setExerciseVideoLabel(data.module?.exercise_video_label ?? '');
            if (data.has_exercise_video !== null && data.has_exercise_video !== undefined) {
              setHasExerciseVideo(data.has_exercise_video);
            }

            // Cache the module structure (text, titles, video URLs, image URLs).
            // Images are NOT converted to base64 — storing large binary blobs in
            // AsyncStorage fills SQLite and causes SQLITE_FULL errors on the device.
            // Images load directly from the server when online; videos use the
            // separate file-system download cache for offline playback.
            const contents = data.contents ?? [];
            if (contents.length > 0) {
              await saveModuleDetail(id, {
                module:   data.module,
                contents: contents,
                quiz:     data.quiz ?? null,
              }).catch((e: any) => {
                console.warn(`[ModuleViewer] cache write failed: ${e?.message}`);
              });
            }

            // Cache correct answers separately for offline grading
            if (data.quiz) {
              try {
                const aRes = await fetchWithTimeout(`${API}/modules/${id}/quiz/answers`, {
                  headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
                });
                if (aRes.ok) {
                  const aData = await aRes.json();
                  await saveQuizAnswers(id, aData.answers ?? {});
                }
              } catch { /* non-critical — grading falls back to server */ }
            }

            setLoading(false);
            return;
          } else {
            // Server returned a non-2xx status — log it so we can diagnose
            const body = await res.text().catch(() => '');
            console.warn(`[ModuleViewer] module ${id} — HTTP ${res.status}: ${body.slice(0, 200)}`);
            // 401 means token is expired/invalid — redirect to login
            if (res.status === 401) {
              router.replace('/');
              return;
            }
          }
        } catch (err: any) {
          console.warn(`[ModuleViewer] module ${id} — fetch error: ${err?.message}`);
        }
      }

      // Offline or server failed — try local cache
      const cached = await loadModuleDetail(id);
      if (cached) {
        console.log(`[ModuleViewer] module ${id} — using cache (${cached.contents?.length ?? 0} blocks, online=${online})`);
        setModuleTitle(cached.module?.title ?? '');
        setContents(cached.contents ?? []);
        setQuiz(cached.quiz ?? null);
        setExerciseVideoEnabled(cached.module?.exercise_video_enabled ?? false);
        setExerciseVideoLabel(cached.module?.exercise_video_label ?? '');
        // When loading from cache we don't know if the server has a video.
        // If there's a queued upload the quiz stays locked until it syncs;
        // otherwise assume no video so the quiz is correctly locked.
        const pending = await hasQueuedUpload(id);
        setHasPendingUpload(pending);
        if (!pending) setHasExerciseVideo(false);
        setLoading(false);
        return;
      }

      // Nothing available
      Alert.alert(
        'No cached content',
        'This module has not been loaded while online yet. Connect to WiFi and open the module to cache it.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
      setLoading(false);
    })();
  }, [id]);

  const openQuiz = () => {
    if (!quiz) return;
    router.push({
      pathname: '/(app)/quiz',
      params: {
        moduleId: id, moduleTitle,
        quizTitle: quiz.title,
        questionsJson: JSON.stringify(quiz.questions),
      },
    });
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {!online && <OfflineBanner />}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{moduleTitle}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={styles.moduleTitle}>{moduleTitle}</Text>
        </View>

        {contents.length === 0 ? (
          <View style={styles.emptyBlocks}>
            <Text style={styles.emptyText}>This module has no content yet.</Text>
          </View>
        ) : (
          contents.map(block => (
            <ContentBlockView key={block.id} block={block} online={online} isTeacher={isTeacher} userId={userId ?? 0} />
          ))
        )}

        {/* Exercise video upload — students only, before quiz */}
        {!isTeacher && (
          <ExerciseVideoPanel
            moduleId={id}
            moduleTitle={exerciseVideoLabel.trim() || moduleTitle}
            isCompleted={isCompleted}
            exerciseVideoEnabled={exerciseVideoEnabled}
            online={online}
            onVideoStatusChange={setHasExerciseVideo}
            onQueueChanged={setHasPendingUpload}
            onProgressRefresh={() => { if (userId !== null) refreshBestScore(userId); }}
          />
        )}

        {quiz && !isTeacher && (
          <QuizCard
            quiz={quiz}
            bestScore={bestScore}
            onPress={openQuiz}
            videoRequired={exerciseVideoEnabled && (
              // Lock when: no video confirmed on server, state unknown, or upload is still pending
              hasExerciseVideo !== true || hasPendingUpload
            )}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Fullscreen image modal ─────────────────────────── */
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Returns the correct 16:9 video height for the current screen width. */
function useVideoHeight() {
  const [height, setHeight] = useState(() =>
    Math.round((Dimensions.get('window').width - 32) * (9 / 16)),
  );
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setHeight(Math.round((window.width - 32) * (9 / 16)));
    });
    return () => sub.remove();
  }, []);
  return height;
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, { headers: { Host: LARAVEL_VHOST, Accept: 'image/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function FullscreenImageModal({ uri, visible, onClose }: { uri: string; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fsOverlay}>
        <TouchableOpacity style={styles.fsClose} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.fsCloseText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fsDismiss} activeOpacity={1} onPress={onClose}>
          <Image source={{ uri }} style={styles.fsImage} resizeMode="contain" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function ImageBlock({ block }: { block: ContentBlock }) {
  const [src, setSrc]             = useState<string | null>(null);
  const [failed, setFailed]       = useState(false);
  const [errMsg, setErrMsg]       = useState('');
  const [fs, setFs]               = useState(false);
  const [imgHeight, setImgHeight] = useState<number>(220);



  useEffect(() => {
    if (Platform.OS === 'web') { setSrc(block.content); return; }
    // Already a base64 data URI (from offline cache) — use directly
    if (block.content.startsWith('data:')) { setSrc(block.content); return; }
    fetchImageAsBase64(toDirectUrl(block.content))
      .then(setSrc)
      .catch((e: any) => { setErrMsg(e?.message ?? 'error'); setFailed(true); });
  }, [block.content]);

  // Resolve natural image dimensions and compute the fitted height
  useEffect(() => {
    if (!src) return;
    const containerWidth = SCREEN_WIDTH - 32; // matches mediaBlock marginHorizontal: 16
    Image.getSize(
      src,
      (w, h) => {
        if (w > 0) {
          const ratio      = h / w;
          const fitted     = Math.round(containerWidth * ratio);
          // clamp: never taller than 75 % of screen, never shorter than 120 px
          const maxHeight  = Math.round(Dimensions.get('window').height * 0.75);
          setImgHeight(Math.min(Math.max(fitted, 120), maxHeight));
        }
      },
      () => { /* keep default 220 on error */ },
    );
  }, [src]);

  return (
    <View style={styles.mediaBlock}>
      <View style={[styles.imageWrapper, { height: failed || !src ? 220 : imgHeight }]}>
        {failed ? (
          <View style={styles.mediaError}>
            <Text style={styles.mediaErrorIcon}>🖼️</Text>
            <Text style={styles.mediaErrorText}>Image could not be loaded</Text>
            <Text style={styles.mediaErrorSub}>{errMsg}</Text>
          </View>
        ) : !src ? (
          <View style={styles.mediaLoading}>
            <ActivityIndicator color="#3b82f6" />
            <Text style={styles.mediaLoadingText}>Loading image…</Text>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.92} onPress={() => setFs(true)} style={{ flex: 1 }}>
            <Image source={{ uri: src }} style={styles.imageBlock} resizeMode="contain" />
            <View style={styles.imageExpandBadge}><Text style={styles.imageExpandIcon}>⛶</Text></View>
          </TouchableOpacity>
        )}
      </View>


      {block.caption ? <Text style={styles.caption}>{block.caption}</Text> : null}
      {src && <FullscreenImageModal uri={src} visible={fs} onClose={() => setFs(false)} />}
    </View>
  );
}

/* ── Shared download panel component ───────────────── */
type DownloadPanelProps = {
  status: 'saved' | DownloadStatus;
  progress: number;
  remoteSize: number | null;
  cachedSize: number | null;
  online: boolean;
  onDownload: () => void;
  onCancel: () => void;
  onRemove: () => void;
};

function DownloadPanel({ status, progress, remoteSize, cachedSize, online, onDownload, onCancel, onRemove }: DownloadPanelProps) {
  if (status === 'saved') {
    return (
      <View style={styles.dlPanel}>
        <View style={styles.dlSavedRow}>
          <View style={styles.dlSavedLeft}>
            <View style={styles.dlSavedIconWrap}>
              <Text style={styles.dlSavedIcon}>✓</Text>
            </View>
            <View>
              <Text style={styles.dlSavedTitle}>Saved for offline</Text>
              {cachedSize != null && (
                <Text style={styles.dlSavedSub}>{formatBytes(cachedSize)} on device</Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.dlRemoveBtn} onPress={onRemove} activeOpacity={0.75}>
            <Text style={styles.dlRemoveText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (status === 'downloading') {
    const pct = Math.round(progress * 100);
    return (
      <View style={styles.dlPanel}>
        <View style={styles.dlProgressHeader}>
          <Text style={styles.dlProgressTitle}>Downloading…</Text>
          <View style={styles.dlProgressMeta}>
            <Text style={styles.dlProgressPct}>{pct}%</Text>
            {remoteSize != null && (
              <Text style={styles.dlProgressBytes}>
                {formatBytes(Math.round(progress * remoteSize))} / {formatBytes(remoteSize)}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.dlTrack}>
          <View style={[styles.dlFill, { width: `${pct}%` as any }]} />
        </View>
        <TouchableOpacity style={styles.dlCancelBtn} onPress={onCancel} activeOpacity={0.75}>
          <Text style={styles.dlCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <TouchableOpacity style={[styles.dlPanel, styles.dlPanelError]} onPress={onDownload} activeOpacity={0.82}>
        <Text style={styles.dlErrorIcon}>⚠️</Text>
        <View>
          <Text style={styles.dlErrorTitle}>Download failed — tap to retry</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // idle — compact single row
  return (
    <TouchableOpacity
      style={[styles.dlPanel, styles.dlPanelIdle, !online && styles.dlPanelDisabled]}
      onPress={onDownload}
      disabled={!online}
      activeOpacity={0.82}
    >
      <View style={[styles.dlIdleIconWrap, !online && styles.dlIdleIconWrapDisabled]}>
        <Text style={styles.dlIdleIcon}>↓</Text>
      </View>
      <Text style={[styles.dlIdleTitle, !online && styles.dlIdleTitleDisabled]}>
        {online
          ? (remoteSize != null ? `Download  ·  ${formatBytes(remoteSize)}` : 'Download to watch offline')
          : 'Go online to download'}
      </Text>
    </TouchableOpacity>
  );
}

/* ── Shared delete confirmation modal ───────────────── */
function DeleteModal({ visible, onKeep, onDelete }: { visible: boolean; onKeep: () => void; onDelete: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep} statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalIconWrap}>
            <Text style={styles.modalIcon}>🗑️</Text>
          </View>
          <Text style={styles.modalTitle}>Remove download?</Text>
          <Text style={styles.modalSub}>
            This video will be removed from your device.{'\n'}You can re-download it any time when online.
          </Text>
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.modalKeepBtn} onPress={onKeep} activeOpacity={0.8}>
              <Text style={styles.modalKeepText}>Keep</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalDeleteBtn} onPress={onDelete} activeOpacity={0.8}>
              <Text style={styles.modalDeleteText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Uploaded video block (download / offline playback) ── */
function UploadedVideoBlock({ block, online, isTeacher, userId }: {
  block: ContentBlock; online: boolean; isTeacher: boolean; userId: number;
}) {
  // Prefer the authenticated stream URL (supports HTTP range requests and
  // bypasses Apache vhost routing issues on LAN). Fall back to the direct
  // storage URL rewritten to the LAN IP for legacy cached content.
  const rawUrl = block.stream_url
    ? block.stream_url.replace(
        new RegExp(`https?://${LARAVEL_VHOST}(:\\d+)?`, 'i'),
        LARAVEL_PORT === 80 ? `http://${LARAVEL_IP}` : `http://${LARAVEL_IP}:${LARAVEL_PORT}`,
      )
    : toDirectUrl(block.content);

  // True when the URL goes through the authenticated /api/mobile/video/stream endpoint
  const isStreamUrl = !!block.stream_url;

  const headers: Record<string, string> = Platform.OS !== 'web' ? { Host: LARAVEL_VHOST } : {};

  const videoHeight = useVideoHeight();

  const [cachedUri, setCachedUri]       = useState<string | null>(null);
  const [authToken, setAuthToken]       = useState<string | null>(null);
  const authTokenRef                    = useRef<string | null>(null);
  const [dlStatus, setDlStatus]         = useState<DownloadStatus>('idle');
  const [progress, setProgress]         = useState(0);
  const [checking, setChecking]         = useState(true);
  const [remoteSize, setRemoteSize]     = useState<number | null>(null);
  const [cachedSize, setCachedSize]     = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load auth token so we can pass it to the stream WebView.
  // Loaded inside the cache-check useEffect below (for stream URLs) so the
  // token is always ready before checking=false triggers the render.

  // Check cache on mount and fetch remote file size
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // For stream URLs, load the token first so it's ready when we render.
      // Store in both a ref (synchronous read) and state (triggers re-render if needed).
      if (isStreamUrl && Platform.OS !== 'web') {
        const tok = await getToken();
        if (!cancelled && tok) {
          authTokenRef.current = tok;
          setAuthToken(tok);
        }
      }

      const uri = await getCachedVideoUri(userId, rawUrl);
      if (cancelled) return;
      setCachedUri(uri);

      if (uri) {
        const sz = await getCachedFileSize(userId, rawUrl);
        if (!cancelled) setCachedSize(sz);
      } else if (online) {
        // Fetch size header in background — don't block render
        if (isStreamUrl) {
          const tok = authTokenRef.current ?? await getToken();
          const sizeHeaders: Record<string, string> = tok ? { Authorization: `Bearer ${tok}` } : {};
          getRemoteFileSize(rawUrl, sizeHeaders).then(sz => {
            if (!cancelled) setRemoteSize(sz);
          });
        } else {
          getRemoteFileSize(rawUrl, headers).then(sz => {
            if (!cancelled) setRemoteSize(sz);
          });
        }
      }
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [rawUrl, userId]);

  const playUri = cachedUri ?? (online ? rawUrl : null);

  /**
   * Build a self-contained HTML5 video page for the WebView.
   *
   * For authenticated stream URLs: the token is appended to the URL as
   * ?token=... so the <video> tag can stream directly with range request
   * support. This is far more efficient than fetch+blob (which loads the
   * entire video into memory and can't seek).
   *
   * For direct storage URLs (legacy / no stream_url) and cached file://
   * URIs: the <video> tag loads the URL directly.
   */
  function buildVideoHtml(videoSrc: string, token?: string | null): string {
    // For stream URLs, append the token as a query param so <video> can auth
    const src = (token && videoSrc.includes('/video/stream'))
      ? `${videoSrc}${videoSrc.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      : videoSrc;

    const safeSrc = src.replace(/"/g, '&quot;');
    return `<!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        html,body{width:100%;height:100%;background:#000;overflow:hidden;}
        video{display:block;width:100%;height:100%;object-fit:contain;}
      </style></head><body>
      <video src="${safeSrc}" controls playsinline preload="metadata"></video>
    </body></html>`;
  }

  const startDownload = async () => {
    if (!online) { Alert.alert('Offline', 'Connect to WiFi to download this video.'); return; }
    setDlStatus('downloading');
    setProgress(0);
    try {
      const token = await getToken();
      const dlHeaders: Record<string, string> = {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const uri = await downloadVideo(userId, rawUrl, dlHeaders, p => setProgress(p));
      setCachedUri(uri);
      setDlStatus('done');
      const sz = await getCachedFileSize(userId, rawUrl);
      setCachedSize(sz);
    } catch (e: any) {
      // Don't show error for user-initiated cancellations
      const msg: string = e?.message ?? '';
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('abort')) {
        setDlStatus('idle');
      } else {
        setDlStatus('error');
        Alert.alert('Download failed', msg || 'Unknown error');
      }
    }
  };

  const handleCancel = async () => {
    await cancelDownload(userId, rawUrl);
    setDlStatus('idle');
    setProgress(0);
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    await deleteCachedVideo(userId, rawUrl);
    setCachedUri(null);
    setCachedSize(null);
    setDlStatus('idle');
  };

  if (checking) {
    return (
      <View style={styles.mediaBlock}>
        <View style={[styles.videoShell, { height: videoHeight }]}>
          <View style={styles.videoPlaceholder}>
            <ActivityIndicator color="#60a5fa" size="large" />
            <Text style={styles.videoPlaceholderHint}>Checking download…</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mediaBlock}>
      {/* ── Video player ── */}
      {playUri ? (
        <View style={[styles.videoShell, { height: videoHeight }]}>
          {Platform.OS === 'web' ? (
            // @ts-ignore
            <video
              src={playUri}
              controls
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
            />
          ) : cachedUri ? (
            <WebView
              source={{ html: buildVideoHtml(cachedUri) }}
              style={styles.webviewFill}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              originWhitelist={['*']}
              allowFileAccess
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
            />
          ) : (
            <WebView
              source={{ html: buildVideoHtml(rawUrl, isStreamUrl ? (authTokenRef.current ?? authToken) : null) }}
              style={styles.webviewFill}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              originWhitelist={['*']}
              mixedContentMode="always"
            />
          )}
        </View>
      ) : (
        <View style={[styles.videoShell, { height: videoHeight }]}>
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoPlaceholderIcon}>📥</Text>
            <Text style={styles.videoPlaceholderTitle}>Not downloaded</Text>
            <Text style={styles.videoPlaceholderHint}>Connect to Wi-Fi and download to watch offline.</Text>
          </View>
        </View>
      )}

      {/* ── Download panel (students only, native only) ── */}
      {Platform.OS !== 'web' && !isTeacher && (
        <DownloadPanel
          status={cachedUri ? 'saved' : dlStatus}
          progress={progress}
          remoteSize={remoteSize}
          cachedSize={cachedSize}
          online={online}
          onDownload={startDownload}
          onCancel={handleCancel}
          onRemove={() => setConfirmDelete(true)}
        />
      )}

      {block.caption ? <Text style={styles.caption}>{block.caption}</Text> : null}

      <DeleteModal
        visible={confirmDelete}
        onKeep={() => setConfirmDelete(false)}
        onDelete={handleDelete}
      />
    </View>
  );
}

/* ── Embed (YouTube / Vimeo / Google Drive) video block ── */
function EmbedVideoBlock({ block, online, isTeacher, userId }: {
  block: ContentBlock; online: boolean; isTeacher: boolean; userId: number;
}) {
  const embed = toEmbed(block.content)!;
  const videoHeight = useVideoHeight();

  // Detect Google Drive so we can offer offline download
  const isDrive = block.content.includes('drive.google.com');

  // For Drive, extract the direct download URL
  // drive.google.com/file/d/FILE_ID/... → uc?export=download&id=FILE_ID
  const driveDownloadUrl: string | null = (() => {
    if (!isDrive) return null;
    const m = block.content.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
    return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : null;
  })();

  /* ── Drive download state (mirrors UploadedVideoBlock) ── */
  const [cachedUri, setCachedUri]         = useState<string | null>(null);
  const [dlStatus, setDlStatus]           = useState<DownloadStatus>('idle');
  const [progress, setProgress]           = useState(0);
  const [checking, setChecking]           = useState(isDrive);
  const [remoteSize, setRemoteSize]       = useState<number | null>(null);
  const [cachedSize, setCachedSize]       = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isDrive || !driveDownloadUrl) return;
    let cancelled = false;
    (async () => {
      const uri = await getCachedVideoUri(userId, driveDownloadUrl);
      if (cancelled) return;
      setCachedUri(uri);
      if (uri) {
        const sz = await getCachedFileSize(userId, driveDownloadUrl);
        if (!cancelled) setCachedSize(sz);
      } else if (online) {
        getRemoteFileSize(driveDownloadUrl).then(sz => {
          if (!cancelled) setRemoteSize(sz);
        });
      }
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [driveDownloadUrl, userId, isDrive]);

  const startDriveDownload = async () => {
    if (!online || !driveDownloadUrl) return;
    setDlStatus('downloading');
    setProgress(0);
    try {
      const uri = await downloadVideo(userId, driveDownloadUrl, {}, p => setProgress(p));
      setCachedUri(uri);
      setDlStatus('done');
      const sz = await getCachedFileSize(userId, driveDownloadUrl);
      setCachedSize(sz);
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('abort')) {
        setDlStatus('idle');
      } else {
        setDlStatus('error');
        Alert.alert('Download failed', msg || 'Unknown error');
      }
    }
  };

  const handleCancelDrive = async () => {
    if (!driveDownloadUrl) return;
    await cancelDownload(userId, driveDownloadUrl);
    setDlStatus('idle');
    setProgress(0);
  };

  const handleDeleteDrive = async () => {
    if (!driveDownloadUrl) return;
    setConfirmDelete(false);
    await deleteCachedVideo(userId, driveDownloadUrl);
    setCachedUri(null);
    setCachedSize(null);
    setDlStatus('idle');
  };

  /* ── Web platform ── */
  if (Platform.OS === 'web') {
    return (
      <View style={styles.mediaBlock}>
        {/* @ts-ignore */}
        <iframe
          src={embed}
          style={{ width: '100%', height: 220, border: 'none', borderRadius: 12 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {block.caption ? <Text style={styles.caption}>{block.caption}</Text> : null}
      </View>
    );
  }

  /* ── Offline, cached Drive file ── */
  if (!online && isDrive && cachedUri) {
    return (
      <View style={styles.mediaBlock}>
        <View style={[styles.videoShell, { height: videoHeight }]}>
          <WebView
            source={{ html: buildCachedDriveHtml(cachedUri) }}
            style={styles.webviewFill}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            originWhitelist={['*']}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
          />
        </View>
        {block.caption ? <Text style={styles.caption}>{block.caption}</Text> : null}
        {renderDriveDownloadBar()}
      </View>
    );
  }

  /* ── Offline, no cache ── */
  if (!online) {
    return (
      <View style={styles.mediaBlock}>
        <View style={[styles.videoShell, { height: videoHeight }]}>
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoPlaceholderIcon}>🌐</Text>
            <Text style={styles.videoPlaceholderTitle}>Internet required</Text>
            <Text style={styles.videoPlaceholderHint}>
              {isDrive
                ? 'Download this video while online to watch offline.'
                : 'YouTube / Vimeo videos need an active connection.'}
            </Text>
          </View>
        </View>
        {block.caption ? <Text style={styles.caption}>{block.caption}</Text> : null}
      </View>
    );
  }

  // YouTube: append playsinline/rel/autoplay params; Drive/Vimeo: use URL as-is
  const isYoutube = embed.includes('youtube.com');
  const iframeSrc = isYoutube ? `${embed}?playsinline=1&rel=0&autoplay=0` : embed;

  /** Embed HTML — works for both the inline shell and the fullscreen modal */
  function buildEmbedHtml(fullscreen = false): string {
    const bg = 'background:#000;';
    return `<!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        html,body{width:100%;height:100%;${bg}overflow:hidden;}
        iframe{
          position:absolute;top:0;left:0;
          width:100%;height:100%;
          border:none;
        }
      </style></head><body>
      <iframe
        src="${iframeSrc}"
        allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;fullscreen"
        allowfullscreen
        webkitallowfullscreen
        mozallowfullscreen
      ></iframe>
    </body></html>`;
  }

  const [fsVisible, setFsVisible] = useState(false);

  const EmbedPlayer = ({ style }: { style?: object }) => (
    <WebView
      source={{ html: buildEmbedHtml() }}
      style={[styles.webviewFill, style]}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      originWhitelist={['*']}
    />
  );

  /* ── Drive download bar renderer (used in both online and offline+cached) ── */
  function renderDriveDownloadBar() {
    if (isTeacher || !isDrive || !driveDownloadUrl) return null;
    if (checking) return null;
    return (
      <DownloadPanel
        status={cachedUri ? 'saved' : dlStatus}
        progress={progress}
        remoteSize={remoteSize}
        cachedSize={cachedSize}
        online={online}
        onDownload={startDriveDownload}
        onCancel={handleCancelDrive}
        onRemove={() => setConfirmDelete(true)}
      />
    );
  }

  return (
    <View style={styles.mediaBlock}>
      {/* ── Inline player shell ── */}
      <View style={[styles.videoShell, { height: videoHeight }]}>
        {cachedUri ? (
          <WebView
            source={{ html: buildCachedDriveHtml(cachedUri) }}
            style={styles.webviewFill}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            originWhitelist={['*']}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
          />
        ) : (
          <EmbedPlayer />
        )}

        {/* Fullscreen button — bottom-right corner */}
        {(Platform.OS as string) !== 'web' && (
          <TouchableOpacity
            style={styles.fsBtn}
            onPress={() => setFsVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.fsBtnIcon}>⛶</Text>
          </TouchableOpacity>
        )}
      </View>

      {block.caption ? <Text style={styles.caption}>{block.caption}</Text> : null}

      {(Platform.OS as string) !== 'web' && renderDriveDownloadBar()}

      <DeleteModal
        visible={confirmDelete}
        onKeep={() => setConfirmDelete(false)}
        onDelete={handleDeleteDrive}
      />

      {/* ── Fullscreen modal ── */}
      <Modal
        visible={fsVisible}
        animationType="fade"
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setFsVisible(false)}
      >
        <View style={styles.fsModalBg}>
          {cachedUri ? (
            <WebView
              source={{ html: buildCachedDriveHtml(cachedUri) }}
              style={StyleSheet.absoluteFill}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              originWhitelist={['*']}
              allowFileAccess
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
            />
          ) : (
            <WebView
              source={{ html: buildEmbedHtml(true) }}
              style={StyleSheet.absoluteFill}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              originWhitelist={['*']}
            />
          )}

          {/* Close button */}
          <TouchableOpacity
            style={styles.fsModalClose}
            onPress={() => setFsVisible(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.fsModalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

/** Inline HTML for playing a locally cached video file (file:// URI). */
function buildCachedDriveHtml(fileUri: string): string {
  const safeSrc = fileUri.replace(/"/g, '&quot;');
  return `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      html,body{width:100%;height:100%;background:#000;overflow:hidden;}
      video{display:block;width:100%;height:100%;object-fit:contain;}
    </style></head><body>
    <video src="${safeSrc}" controls playsinline preload="metadata"></video>
  </body></html>`;
}

/* ── VideoBlock router ───────────────────────────────── */
function VideoBlock({ block, online, isTeacher, userId }: {
  block: ContentBlock; online: boolean; isTeacher: boolean; userId: number;
}) {
  if (toEmbed(block.content)) return <EmbedVideoBlock block={block} online={online} isTeacher={isTeacher} userId={userId} />;
  return <UploadedVideoBlock block={block} online={online} isTeacher={isTeacher} userId={userId} />;
}

/* ── Content block dispatcher ───────────────────────── */
function ContentBlockView({ block, online, isTeacher, userId }: {
  block: ContentBlock; online: boolean; isTeacher: boolean; userId: number;
}) {
  if (block.type === 'title')
    return <View style={styles.titleBlock}><Text style={styles.titleBlockText}>{block.content}</Text></View>;
  if (block.type === 'text')
    return <View style={styles.textBlock}><BoldText text={block.content} style={styles.textBlockContent} /></View>;
  if (block.type === 'image') return <ImageBlock block={block} />;
  // Render videos inline at their correct position in the content flow
  if (block.type === 'video') return <VideoBlock block={block} online={online} isTeacher={isTeacher} userId={userId} />;
  return null;
}

/* ══════════════════════════════════════════════════════
   Exercise Video Upload Panel (student-only)
══════════════════════════════════════════════════════ */
type ExerciseVideoInfo = { url: string; uploaded_at: string } | null;

function ExerciseVideoPanel({ moduleId, moduleTitle, isCompleted: _isCompleted, exerciseVideoEnabled, online, onVideoStatusChange, onQueueChanged, onProgressRefresh }: {
  moduleId: string;
  moduleTitle: string;
  isCompleted: boolean;
  exerciseVideoEnabled: boolean;
  online: boolean;
  onVideoStatusChange?: (hasVideo: boolean) => void;
  /** Called when a video is queued for (true) or removed from (false) the offline upload queue. */
  onQueueChanged?: (hasPending: boolean) => void;
  onProgressRefresh?: () => void;
}) {
  const [existing, setExisting]     = useState<ExerciseVideoInfo>(null);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const [deleting, setDeleting]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  /** True when a video has been queued for upload while offline. */
  const [queued, setQueued]         = useState(false);
  /** 0–1 progress while an auto-sync upload is running for this module. */
  const [syncProgress, setSyncProgress] = useState<number | null>(null);

  // ── Load existing video from server ─────────────────
  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetchWithTimeout(`${API}/modules/${moduleId}/exercise/video`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setExisting(data.video);
        onVideoStatusChange?.(data.video !== null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [moduleId, onVideoStatusChange]);

  useEffect(() => { load(); }, [load]);

  // ── Check for any queued (offline) upload on mount ──
  useEffect(() => {
    hasQueuedUpload(moduleId).then(setQueued);
  }, [moduleId]);

  // ── Listen for this module's upload completing (auto-sync) ──
  useEffect(() => {
    const unsub = addUploadSuccessListener((completedModuleId) => {
      if (completedModuleId !== moduleId) return;
      setQueued(false);
      setSyncProgress(null);
      // Reload from server so the submitted badge appears
      load().then(() => onProgressRefresh?.());
      onVideoStatusChange?.(true);
      // Upload is now on the server — clear the pending flag in the parent
      onQueueChanged?.(false);
    });
    return unsub;
  }, [moduleId, load, onVideoStatusChange, onQueueChanged, onProgressRefresh]);

  // ── Attempt to flush queue when we come online ───────
  useFocusEffect(useCallback(() => {
    if (!online) return;
    hasQueuedUpload(moduleId).then(has => {
      if (!has) return;
      // Flush only this module's upload; pass a progress callback
      flushUploadQueue((mid, p) => {
        if (mid === moduleId) setSyncProgress(p);
      });
    });
  }, [online, moduleId]));

  // Don't render anything if the teacher has disabled this feature.
  // This must come AFTER all hooks to avoid violating the Rules of Hooks.
  if (!exerciseVideoEnabled) return null;

  // ── Pick a video and either upload immediately or queue ──
  const pickAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to pick a video.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    const asset = result.assets[0];
    const uri   = asset.uri;

    const rawName = asset.fileName ?? uri.split('/').pop()?.split('?')[0] ?? 'exercise.mp4';
    const name    = rawName.includes('.') ? rawName : `${rawName}.mp4`;

    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const extMimeMap: Record<string, string> = {
      mp4:  'video/mp4',
      m4v:  'video/mp4',
      mov:  'video/quicktime',
      qt:   'video/quicktime',
      webm: 'video/webm',
      ogg:  'video/ogg',
      ogv:  'video/ogg',
      '3gp': 'video/3gpp',
    };
    const type = extMimeMap[ext] ?? asset.mimeType ?? 'video/mp4';

    // ── Offline path: queue for later ───────────────────
    if (!online) {
      const pending: PendingVideoUpload = {
        id:       `${moduleId}_${Date.now()}`,
        moduleId,
        uri,
        name,
        type,
        queuedAt: new Date().toISOString(),
      };
      await enqueuePendingUpload(pending);
      setQueued(true);
      // Notify the parent that there's a pending upload — quiz stays locked
      // until the upload actually reaches the server (do NOT set hasVideo=true here)
      onQueueChanged?.(true);
      Alert.alert(
        'Saved for upload',
        "You're offline. Your video has been saved and will upload automatically when you're back online.",
      );
      return;
    }

    // ── Online path: upload immediately ─────────────────
    setUploading(true);
    setProgress(0);

    try {
      const token = await getToken();

      const formData = new FormData();
      formData.append('video', { uri, name, type } as any);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/modules/${moduleId}/exercise/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Accept', 'application/json');
      if (Platform.OS !== 'web') {
        xhr.setRequestHeader('Host', LARAVEL_VHOST);
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) setProgress(Math.min(e.loaded / e.total, 1));
      });

      await new Promise<void>((resolve, reject) => {
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

      Alert.alert('Uploaded!', 'Your exercise video has been submitted.');
      await load();
      onVideoStatusChange?.(true);
      onProgressRefresh?.();
    } catch (e: any) {
      // Upload failed mid-way — queue it for retry instead of just erroring
      const pending: PendingVideoUpload = {
        id:       `${moduleId}_${Date.now()}`,
        moduleId,
        uri,
        name,
        type,
        queuedAt: new Date().toISOString(),
      };
      await enqueuePendingUpload(pending);
      setQueued(true);
      // Video isn't on the server yet — keep the quiz locked
      onQueueChanged?.(true);
      Alert.alert(
        'Upload failed — queued',
        "Couldn't reach the server. Your video has been saved and will upload automatically when you're back online.",
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  // ── Cancel a queued (offline) upload ────────────────
  const cancelQueued = async () => {
    const uploads = await import('@/lib/upload-queue').then(m => m.getPendingUploads());
    const item = uploads.find(u => u.moduleId === moduleId);
    if (item) await dequeuePendingUpload(item.id);
    setQueued(false);
    onQueueChanged?.(false);
    onVideoStatusChange?.(false);
  };

  const handleDelete = async () => {
    setConfirmDel(false);
    setDeleting(true);
    try {
      const token = await getToken();
      const res = await fetchWithTimeout(`${API}/modules/${moduleId}/exercise/video`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        setExisting(null);
        onVideoStatusChange?.(false);
      } else {
        Alert.alert('Error', 'Could not delete video. Try again.');
      }
    } catch {
      Alert.alert('Error', 'Network error.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Determine what to render ─────────────────────────
  const isSyncing = syncProgress !== null;

  return (
    <View style={xv.wrap}>
      {loading ? (
        <View style={xv.row}>
          <ActivityIndicator size="small" color="#7c3aed" />
          <Text style={xv.sub}>Loading…</Text>
        </View>

      ) : existing ? (
        /* ── Server has a submitted video ── */
        <View style={xv.row}>
          <View style={[xv.iconWrap, { backgroundColor: '#7c3aed' }]}>
            <Text style={xv.iconEmoji}>🎬</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={xv.title} numberOfLines={1}>{moduleTitle}</Text>
            <View style={xv.submittedBadge}>
              <Text style={xv.submittedCheck}>✓ </Text>
              <Text style={xv.submittedText}>
                Submitted {new Date(existing.uploaded_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </Text>
            </View>
          </View>
          {uploading ? (
            <View style={xv.progressPill}>
              <Text style={xv.progressPct}>{Math.min(Math.round(progress * 100), 100)}%</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity style={xv.replaceBtn} onPress={pickAndUpload} activeOpacity={0.8}>
                <Text style={xv.replaceBtnText}>Replace</Text>
              </TouchableOpacity>
              <TouchableOpacity style={xv.deleteBtn} onPress={() => setConfirmDel(true)} disabled={deleting} activeOpacity={0.8}>
                <Text style={xv.deleteBtnText}>{deleting ? '…' : '🗑️'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      ) : queued ? (
        /* ── Queued offline upload ── */
        <View>
          <View style={xv.row}>
            <View style={[xv.iconWrap, { backgroundColor: isSyncing ? '#7c3aed' : '#f59e0b' }]}>
              {isSyncing
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={xv.iconEmoji}>⏳</Text>
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[xv.title, { color: '#92400e' }]} numberOfLines={1}>{moduleTitle}</Text>
              <Text style={[xv.sub, { color: '#b45309' }]}>
                {isSyncing
                  ? `Uploading… ${Math.min(Math.round((syncProgress ?? 0) * 100), 100)}%`
                  : 'Saved — will upload when online'}
              </Text>
            </View>
            {!isSyncing && (
              <TouchableOpacity style={xv.cancelQueueBtn} onPress={cancelQueued} activeOpacity={0.8}>
                <Text style={xv.cancelQueueText}>Cancel</Text>
              </TouchableOpacity>
            )}
            {isSyncing && (
              <View style={xv.progressPill}>
                <Text style={xv.progressPct}>{Math.min(Math.round((syncProgress ?? 0) * 100), 100)}%</Text>
              </View>
            )}
          </View>
          {/* Progress bar shown while syncing */}
          {isSyncing && (
            <View style={xv.syncTrack}>
              <View style={[xv.syncFill, { width: `${Math.min(Math.round((syncProgress ?? 0) * 100), 100)}%` as any }]} />
            </View>
          )}
        </View>

      ) : (
        /* ── No video yet ── */
        <TouchableOpacity
          style={[xv.row, xv.uploadRow, uploading && xv.uploadRowDisabled]}
          onPress={pickAndUpload}
          disabled={uploading}
          activeOpacity={0.82}
        >
          <View style={[xv.iconWrap, { backgroundColor: '#7c3aed' }]}>
            {uploading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={xv.iconEmoji}>{online ? '📤' : '📥'}</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[xv.title, { color: '#4c1d95' }]} numberOfLines={1}>
              {uploading ? `Uploading… ${Math.min(Math.round(progress * 100), 100)}%` : moduleTitle}
            </Text>
            <Text style={xv.sub}>
              {uploading
                ? 'Please wait…'
                : online
                  ? 'Tap to upload exercise video'
                  : 'Tap to save for upload when online'}
            </Text>
          </View>
          {uploading && (
            <View style={xv.progressPill}>
              <Text style={xv.progressPct}>{Math.min(Math.round(progress * 100), 100)}%</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Delete confirmation */}
      <Modal visible={confirmDel} transparent animationType="fade" onRequestClose={() => setConfirmDel(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}><Text style={styles.modalIcon}>🗑️</Text></View>
            <Text style={styles.modalTitle}>Delete exercise video?</Text>
            <Text style={styles.modalSub}>
              Your submitted video will be removed.{'\n'}You can upload a new one any time.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalKeepBtn} onPress={() => setConfirmDel(false)} activeOpacity={0.8}>
                <Text style={styles.modalKeepText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDeleteBtn} onPress={handleDelete} activeOpacity={0.8}>
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────── */
const xv = StyleSheet.create({
  wrap: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#ddd6fe',
    backgroundColor: '#faf5ff',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },

  /* Single horizontal row used by all states */
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  uploadRow:         { backgroundColor: '#f5f3ff' },
  uploadRowDisabled: { backgroundColor: '#f8fafc' },

  /* Left icon pill */
  iconWrap: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 15 },

  /* Text */
  title: { fontSize: 12, fontWeight: '700', color: '#4c1d95', lineHeight: 16 },
  sub:   { fontSize: 10, color: '#94a3b8', marginTop: 1 },

  /* Submitted badge (inline) */
  submittedBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  submittedCheck: { fontSize: 10, color: '#059669', fontWeight: '900' },
  submittedText:  { fontSize: 10, color: '#065f46', fontWeight: '600' },

  /* Replace / delete buttons */
  replaceBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: '#ede9fe', borderRadius: 7,
    borderWidth: 1, borderColor: '#c4b5fd',
  },
  replaceBtnText: { fontSize: 10, fontWeight: '700', color: '#5b21b6' },
  deleteBtn: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#fecdd3',
  },
  deleteBtnText: { fontSize: 12 },

  /* Progress pill (shown while uploading) */
  progressPill: {
    backgroundColor: '#ede9fe', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  progressPct: { fontSize: 10, fontWeight: '800', color: '#7c3aed' },

  /* Queued / offline state */
  cancelQueueBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: '#fef3c7', borderRadius: 7,
    borderWidth: 1, borderColor: '#fde68a',
  },
  cancelQueueText: { fontSize: 10, fontWeight: '700', color: '#92400e' },

  /* Sync progress bar (shown while auto-upload runs) */
  syncTrack: {
    height: 3, marginHorizontal: 12, marginBottom: 8,
    backgroundColor: '#fde68a', borderRadius: 3, overflow: 'hidden',
  },
  syncFill: { height: '100%', backgroundColor: '#f59e0b', borderRadius: 3 },
});

/* ── Styles ─────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },

  /* Offline banner */
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#fde68a',
  },
  offlineBannerIcon: { fontSize: 13 },
  offlineBannerText: { fontSize: 12, color: '#92400e', fontWeight: '600', letterSpacing: 0.1 },

  /* Top bar */
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn:  { width: 60 },
  backText: { fontSize: 16, color: '#3b82f6', fontWeight: '700' },
  topTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a', textAlign: 'center' },

  /* Module title */
  titleSection: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12 },
  moduleTitle:  { fontSize: 23, fontWeight: '800', color: '#0f172a', lineHeight: 31 },

  /* Content blocks */
  textBlock:        { paddingHorizontal: 20, paddingVertical: 8 },
  textBlockContent: { fontSize: 15, color: '#374151', lineHeight: 27 },
  titleBlock:       { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  titleBlockText:   { fontSize: 19, fontWeight: '800', color: '#0f172a', lineHeight: 28 },

  /* Media block wrapper */
  mediaBlock: { marginHorizontal: 16, marginVertical: 12 },

  /* Image */
  imageBlock:   { flex: 1, width: '100%', height: undefined, borderRadius: 14 },
  imageWrapper: { width: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  imageExpandBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  imageExpandIcon: { fontSize: 14, color: '#fff' },

  /* Fullscreen image */
  fsOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  fsDismiss:  { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  fsImage:    { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.85 },
  fsClose: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20,
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
  },
  fsCloseText: { fontSize: 16, color: '#fff', fontWeight: '700' },

  /* Fullscreen button on embed video (bottom-right corner of shell) */
  fsBtn: {
    position: 'absolute', bottom: 8, right: 8, zIndex: 10,
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  fsBtnIcon: { fontSize: 15, color: '#fff' },

  /* Fullscreen modal for embed videos */
  fsModalBg: {
    flex: 1, backgroundColor: '#000',
  },
  fsModalClose: {
    position: 'absolute', top: 44, right: 16, zIndex: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  fsModalCloseText: { fontSize: 15, color: '#fff', fontWeight: '700' },

  /* ── Video shell ── */
  videoShell: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  webviewFill: { flex: 1, backgroundColor: '#000' },

  /* Video placeholder (offline / no cache) */
  videoPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 28,
    backgroundColor: '#0f172a',
  },
  videoPlaceholderIcon:  { fontSize: 40, marginBottom: 4 },
  videoPlaceholderTitle: { fontSize: 15, fontWeight: '800', color: '#e2e8f0', textAlign: 'center' },
  videoPlaceholderHint:  { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  /* ── Download panel ── */
  dlPanel: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  /* Idle state */
  dlPanelIdle: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  dlPanelDisabled: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  dlIdleIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#0ea5e9', alignItems: 'center', justifyContent: 'center',
  },
  dlIdleIconWrapDisabled: { backgroundColor: '#cbd5e1' },
  dlIdleIcon:  { fontSize: 15, color: '#fff', fontWeight: '900' },
  dlIdleTitle: { fontSize: 13, fontWeight: '600', color: '#0369a1', flexShrink: 1 },
  dlIdleTitleDisabled: { color: '#94a3b8' },
  dlIdleSub:   { fontSize: 11, color: '#38bdf8', marginTop: 1 },

  /* Saved state */
  dlSavedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  dlSavedLeft:    { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dlSavedIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center',
  },
  dlSavedIcon:  { fontSize: 12, color: '#059669', fontWeight: '900' },
  dlSavedTitle: { fontSize: 12, fontWeight: '600', color: '#065f46' },
  dlSavedSub:   { fontSize: 10, color: '#6ee7b7', marginTop: 1 },
  dlRemoveBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#fff1f2', borderRadius: 8,
    borderWidth: 1, borderColor: '#fecdd3',
  },
  dlRemoveText: { fontSize: 11, fontWeight: '700', color: '#e11d48' },

  /* Progress state */
  dlProgressHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 9, paddingBottom: 6,
  },
  dlProgressTitle: { fontSize: 12, fontWeight: '700', color: '#0369a1' },
  dlProgressMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dlProgressPct:   { fontSize: 12, fontWeight: '800', color: '#0ea5e9' },
  dlProgressBytes: { fontSize: 10, color: '#94a3b8' },
  dlTrack: {
    height: 4, marginHorizontal: 12, marginBottom: 8,
    backgroundColor: '#e0f2fe', borderRadius: 4, overflow: 'hidden',
  },
  dlFill: { height: '100%', backgroundColor: '#0ea5e9', borderRadius: 4 },
  dlCancelBtn: {
    marginHorizontal: 12, marginBottom: 8, paddingVertical: 7,
    backgroundColor: '#fff1f2', borderRadius: 8,
    borderWidth: 1, borderColor: '#fecdd3', alignItems: 'center',
  },
  dlCancelText: { fontSize: 12, fontWeight: '700', color: '#e11d48' },

  /* Error state */
  dlPanelError: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: '#fff7ed', borderColor: '#fed7aa',
  },
  dlErrorIcon:  { fontSize: 16 },
  dlErrorTitle: { fontSize: 13, fontWeight: '600', color: '#c2410c' },
  dlErrorSub:   { fontSize: 11, color: '#fb923c', marginTop: 1 },

  /* ── Delete modal ── */
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center', justifyContent: 'flex-end', padding: 0,
  },
  modalCard: {
    width: '100%', backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  modalIconWrap: {
    width: 60, height: 60, borderRadius: 20,
    backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  modalIcon:       { fontSize: 30 },
  modalTitle:      { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  modalSub:        { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  modalBtns:       { flexDirection: 'row', gap: 12, width: '100%' },
  modalKeepBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#f1f5f9', alignItems: 'center',
  },
  modalKeepText:   { fontSize: 15, fontWeight: '700', color: '#475569' },
  modalDeleteBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#e11d48', alignItems: 'center',
  },
  modalDeleteText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  /* Loading / error states */
  mediaLoading: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#f1f5f9', minHeight: 120,
  },
  mediaLoadingText: { fontSize: 12, color: '#94a3b8' },
  mediaError: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff1f2', minHeight: 120,
  },
  mediaErrorIcon: { fontSize: 32 },
  mediaErrorText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
  mediaErrorSub:  { fontSize: 10, color: '#fca5a5', textAlign: 'center', paddingHorizontal: 12 },

  caption:     { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

  /* Image URL link */
  imageLinkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 6, paddingHorizontal: 4,
  },
  imageLinkIcon: { fontSize: 12 },
  imageLinkText: {
    flex: 1, fontSize: 11, color: '#3b82f6',
    textDecorationLine: 'underline', letterSpacing: 0.1,
  },
  emptyBlocks: { padding: 24, alignItems: 'center' },
  emptyText:   { fontSize: 14, color: '#94a3b8', fontStyle: 'italic' },

  /* Videos section */
  sectionWrapper: {
    marginTop: 20, marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    paddingHorizontal: 20, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    marginBottom: 4,
  },
  sectionHeaderEmoji: { fontSize: 16 },
  sectionHeaderText: {
    fontSize: 16, fontWeight: '800' as const, color: '#0f172a', flex: 1,
  },
  sectionBadge: {
    backgroundColor: '#1d4ed8', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '700' as const, color: '#fff' },

  /* Quiz card */
  quizCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 16, marginTop: 20, padding: 12,
    borderRadius: 16, borderWidth: 1.5,
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  quizCardIcon:      { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quizCardEmoji:     { fontSize: 20 },
  quizCardInfo:      { flex: 1 },
  quizCardTitle:     { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  quizCardSub:       { fontSize: 11, marginTop: 2 },

  /* Inline score bar */
  quizBarRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  quizBarTrack:      { flex: 1, height: 5, borderRadius: 5, overflow: 'hidden' },
  quizBarFill:       { height: 5, borderRadius: 5 },
  quizBarPct:        { fontSize: 11, fontWeight: '700', minWidth: 30, textAlign: 'right' },

  quizCardArrow:     { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quizCardArrowText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
