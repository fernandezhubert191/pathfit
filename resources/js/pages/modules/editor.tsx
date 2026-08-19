import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowDown, ArrowLeft, ArrowUp,
    Bold, BookOpen, CheckCircle2,
    Edit3, Eye, FileText, Heading2,
    Image as ImageIcon, Loader2, Maximize2, Minimize2,
    Play, Plus, Save, Settings, Trash2, Video, X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/* ─── Types ─────────────────────────────────────────── */
type BlockType = 'text' | 'title' | 'image' | 'video';
type Block = { id: number; type: BlockType; content: string; caption: string | null; order: number };
type ModuleMeta = { id: number; title: string; course: string; description: string | null; cover_url: string | null; is_active: boolean; exercise_video_enabled: boolean; exercise_video_label: string | null };

type QuizQuestion = {
    id: number;
    question: string;
    choice_a: string;
    choice_b: string;
    choice_c: string;
    choice_d: string;
    correct_answer: 'a' | 'b' | 'c' | 'd';
    order: number;
};
type QuizData = { id: number; title: string; questions: QuizQuestion[] } | null;

type Props = { module: ModuleMeta; contents: Block[]; quiz: QuizData };

const COURSE_LABELS: Record<string, string> = { pathfit1: 'Pathfit 1', pathfit2: 'Pathfit 2' };
const COURSE_COLORS: Record<string, string> = {
    pathfit1: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    pathfit2: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
};

/* ─── XSRF helper ──────────────────────────────────── */
const xsrf = () => decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');

async function apiFetch(url: string, opts: RequestInit) {
    return fetch(url, {
        credentials: 'include',
        headers: { 'X-XSRF-TOKEN': xsrf(), Accept: 'application/json', ...((opts.headers as Record<string, string>) ?? {}) },
        ...opts,
    });
}

/* ─── YouTube / Vimeo embed ─────────────────────────── */
function toEmbed(url: string): { src: string; type: 'youtube' | 'vimeo' } | null {
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    if (yt) return { src: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`, type: 'youtube' };
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return { src: `https://player.vimeo.com/video/${vm[1]}?title=0&byline=0&portrait=0`, type: 'vimeo' };
    return null;
}

/* ─── Lightbox ──────────────────────────────────────── */
function Lightbox({ src, caption, onClose }: { src: string; caption: string | null; onClose: () => void }) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
                aria-label="Close"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <img
                src={src}
                alt={caption ?? ''}
                className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            />
            {caption && (
                <p className="mt-4 text-center text-sm text-white/70 max-w-xl">{caption}</p>
            )}
        </div>
    );
}

/* ─── Bold helpers ──────────────────────────────────── */
function insertBold(textarea: HTMLTextAreaElement, text: string, setText: (v: string) => void) {
    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    const sel   = text.slice(start, end);
    const replacement = sel.length > 0 ? `**${sel}**` : '**bold text**';
    const next = text.slice(0, start) + replacement + text.slice(end);
    setText(next);
    setTimeout(() => {
        textarea.focus();
        const newCursor = start + replacement.length;
        textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
}

function renderBold(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
            ? <strong key={i}>{part.slice(2, -2)}</strong>
            : <span key={i}>{part}</span>
    );
}

/* ─── Block type badge ──────────────────────────────── */
const BLOCK_TYPE_CONFIG: Record<BlockType, { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
    title: { label: 'TITLE', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',  Icon: Heading2 },
    text:  { label: 'TEXT',  color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',   Icon: FileText },
    image: { label: 'IMAGE', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', Icon: ImageIcon },
    video: { label: 'VIDEO', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',           Icon: Video },
};

function BlockTypeBadge({ type }: { type: BlockType }) {
    const cfg = BLOCK_TYPE_CONFIG[type];
    return (
        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>
            <cfg.Icon className="size-2.5" />
            {cfg.label}
        </span>
    );
}

/* ═══════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════ */
export default function ModuleEditor({ module: mod, contents: initial, quiz: initialQuiz }: Props) {
    const { currentTeam } = usePage().props;
    const flash = (usePage().props as { flash?: { success?: string; error?: string } }).flash;
    const teamSlug = (currentTeam as { slug: string } | null)?.slug ?? '';
    const base = `/${teamSlug}/modules/${mod.id}`;

    const [blocks, setBlocks]       = useState<Block[]>(initial);
    const [uploading, setUploading] = useState(false);
    const [uploadPct, setUploadPct] = useState(0);
    const [viewMode, setViewMode]   = useState(false);
    const [activeTab, setActiveTab] = useState<'content' | 'quiz' | 'settings'>('content');
    const [contentFullscreen, setContentFullscreen] = useState(false);
    const [addingVideo, setAddingVideo]     = useState(false);
    const [videoUrl, setVideoUrl]           = useState('');
    const [videoCaption, setVideoCaption]   = useState('');
    const [quiz, setQuiz]           = useState<QuizData>(initialQuiz);
    const [exerciseVideoEnabled, setExerciseVideoEnabled] = useState(mod.exercise_video_enabled);
    const [togglingExercise, setTogglingExercise]         = useState(false);
    const [exerciseVideoLabel, setExerciseVideoLabel]     = useState(mod.exercise_video_label ?? '');
    const [savingLabel, setSavingLabel]                   = useState(false);
    const imageRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error)   toast.error(flash.error);
    }, [flash]);

    /* Escape exits content fullscreen */
    useEffect(() => {
        if (!contentFullscreen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setContentFullscreen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [contentFullscreen]);


    /* ── XHR upload with progress ── */
    function xhrUpload(url: string, fd: FormData): Promise<Response> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url);
            xhr.setRequestHeader('X-XSRF-TOKEN', xsrf());
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.withCredentials = true;
            xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100)); };
            xhr.onload  = () => resolve(new Response(xhr.responseText, { status: xhr.status }));
            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(fd);
        });
    }

    const addTextBlock = async () => {
        setUploading(true);
        try {
            const res = await apiFetch(`${base}/blocks/text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'Click here to edit this text…', type: 'text' }) });
            const json = await res.json();
            if (res.ok) setBlocks((b) => [...b, { id: json.id, type: 'text', content: 'Click here to edit this text…', caption: null, order: json.order }]);
        } catch { toast.error('Failed.'); }
        finally { setUploading(false); }
    };

    const addTitleBlock = async () => {
        setUploading(true);
        try {
            const res = await apiFetch(`${base}/blocks/text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'Section Title', type: 'title' }) });
            const json = await res.json();
            if (res.ok) setBlocks((b) => [...b, { id: json.id, type: 'title', content: 'Section Title', caption: null, order: json.order }]);
        } catch { toast.error('Failed.'); }
        finally { setUploading(false); }
    };

    const uploadImage = async (file: File) => {
        const fd = new FormData(); fd.append('image', file);
        setUploading(true); setUploadPct(0);
        try {
            const res = await xhrUpload(`${base}/blocks/image`, fd);
            const json = await res.json();
            if (res.ok) { setBlocks((b) => [...b, { id: json.id, type: 'image', content: json.url, caption: json.caption, order: json.order }]); toast.success('Image added.'); }
            else toast.error(json.message ?? 'Upload failed.');
        } catch { toast.error('Upload failed.'); }
        finally { setUploading(false); setUploadPct(0); }
    };

    const uploadVideoFile = async (file: File) => {
        const fd = new FormData(); fd.append('video', file);
        setUploading(true); setUploadPct(0);
        try {
            const res = await xhrUpload(`${base}/blocks/upload-video`, fd);
            const json = await res.json();
            if (res.ok) { setBlocks((b) => [...b, { id: json.id, type: 'video', content: json.url, caption: null, order: json.order }]); toast.success('Video uploaded.'); }
            else toast.error(json.message ?? 'Upload failed.');
        } catch { toast.error('Upload failed.'); }
        finally { setUploading(false); setUploadPct(0); }
    };

    const submitVideoUrl = async () => {
        if (!videoUrl.trim()) return;
        setUploading(true);
        try {
            const res = await apiFetch(`${base}/blocks/video`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: videoUrl, caption: videoCaption }) });
            const json = await res.json();
            if (res.ok) { setBlocks((b) => [...b, { id: json.id, type: 'video', content: json.url, caption: json.caption, order: json.order }]); setVideoUrl(''); setVideoCaption(''); setAddingVideo(false); toast.success('Video added.'); }
            else toast.error(json.message ?? 'Failed.');
        } catch { toast.error('Failed.'); }
        finally { setUploading(false); }
    };

    const updateBlock = async (blockId: number, content: string, caption?: string) => {
        await apiFetch(`${base}/blocks/${blockId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, caption }) });
        setBlocks((b) => b.map((bl) => bl.id === blockId ? { ...bl, content, caption: caption ?? bl.caption } : bl));
    };

    const deleteBlock = async (blockId: number) => {
        if (!confirm('Delete this block?')) return;
        await apiFetch(`${base}/blocks/${blockId}`, { method: 'DELETE' });
        setBlocks((b) => b.filter((bl) => bl.id !== blockId));
        toast.success('Block deleted.');
    };

    /* ── Move up / down ── */
    const moveBlock = async (index: number, dir: 'up' | 'down') => {
        const newBlocks = [...blocks];
        const target = dir === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= newBlocks.length) return;
        [newBlocks[index], newBlocks[target]] = [newBlocks[target], newBlocks[index]];
        const reordered = newBlocks.map((b, i) => ({ ...b, order: i }));
        setBlocks(reordered);
        await apiFetch(`${base}/blocks/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: reordered.map((b) => b.id) }),
        });
    };

    const toggleExerciseVideo = async () => {
        setTogglingExercise(true);
        try {
            const res = await apiFetch(`${base}/exercise-video/toggle`, { method: 'POST' });
            const json = await res.json();
            if (res.ok) {
                setExerciseVideoEnabled(json.exercise_video_enabled);
                toast.success(
                    json.exercise_video_enabled
                        ? 'Exercise video upload enabled.'
                        : 'Exercise video upload disabled.',
                );
            } else {
                toast.error('Failed to update setting.');
            }
        } catch {
            toast.error('Network error.');
        } finally {
            setTogglingExercise(false);
        }
    };

    const saveExerciseVideoLabel = async (label: string) => {
        setSavingLabel(true);
        try {
            const res = await apiFetch(`${base}/exercise-video/label`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: label.trim() || null }),
            });
            const json = await res.json();
            if (res.ok) {
                setExerciseVideoLabel(json.exercise_video_label ?? '');
                toast.success('Label saved.');
            } else {
                toast.error('Failed to save label.');
            }
        } catch {
            toast.error('Network error.');
        } finally {
            setSavingLabel(false);
        }
    };

    const courseLabel = COURSE_LABELS[mod.course] ?? mod.course;
    const courseColor = COURSE_COLORS[mod.course] ?? 'bg-muted text-muted-foreground';

    return (
        <>
            <Head title={viewMode ? mod.title : `Edit: ${mod.title}`} />
            <div className="flex h-[calc(100svh-4rem)] flex-col overflow-hidden">

                {/* ── Top bar ── */}
                <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
                    <Link href={`/${teamSlug}/modules`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="size-4" /> Back
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-sm font-semibold truncate max-w-[200px]">{mod.title}</span>
                    {/* Course badge */}
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${courseColor}`}>
                        {courseLabel}
                    </span>
                    {/* Block count */}
                    {blocks.length > 0 && (
                        <span className="text-xs text-muted-foreground/60">{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                        <Button size="sm" variant={viewMode ? 'default' : 'outline'} className="gap-1.5 text-xs" onClick={() => setViewMode((v) => !v)}>
                            {viewMode ? <Edit3 className="size-3.5" /> : <Eye className="size-3.5" />}
                            {viewMode ? 'Back to edit' : 'Preview'}
                        </Button>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${mod.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                            {mod.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>

                {/* Upload progress bar */}
                {uploading && (
                    <div className="h-1 w-full bg-muted">
                        <div className="h-1 bg-indigo-500 transition-all duration-200" style={{ width: `${uploadPct || 30}%` }} />
                    </div>
                )}

                {viewMode ? (
                    <ViewMode mod={mod} blocks={blocks} />
                ) : (
                    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">

                        {/* ── Tab bar ── */}
                        <div className="flex shrink-0 items-end gap-0 border-b border-border bg-card px-4">
                            {/* Content tab */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('content')}
                                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                    activeTab === 'content'
                                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                }`}
                            >
                                <FileText className="size-3.5" />
                                Lesson Content
                                {blocks.length > 0 && (
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                        activeTab === 'content'
                                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                        {blocks.length}
                                    </span>
                                )}
                            </button>

                            {/* Quiz tab */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('quiz')}
                                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                    activeTab === 'quiz'
                                        ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                }`}
                            >
                                <BookOpen className="size-3.5" />
                                Quiz Editor
                                {quiz && (
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                        activeTab === 'quiz'
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                        {quiz.questions.length}Q
                                    </span>
                                )}
                            </button>

                            {/* Settings tab */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('settings')}
                                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                    activeTab === 'settings'
                                        ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                }`}
                            >
                                <Settings className="size-3.5" />
                                Video Submission
                                {exerciseVideoEnabled && (
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                        activeTab === 'settings'
                                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                        ON
                                    </span>
                                )}
                            </button>

                            {/* Passing score hint — only on quiz tab */}
                            {activeTab === 'quiz' && quiz && quiz.questions.length > 0 && (
                                <span className="ml-auto self-center pr-2 text-xs text-muted-foreground">
                                    Passing: <span className="font-semibold text-emerald-600">75%</span>
                                </span>
                            )}

                            {/* Fullscreen toggle — only on content tab */}
                            {activeTab === 'content' && (
                                <button
                                    type="button"
                                    onClick={() => setContentFullscreen((v) => !v)}
                                    className="ml-auto self-center mr-2 flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors dark:hover:bg-indigo-950/30"
                                    title={contentFullscreen ? 'Exit fullscreen' : 'Fullscreen editor'}
                                >
                                    {contentFullscreen
                                        ? <><Minimize2 className="size-3.5" /> Exit fullscreen</>
                                        : <><Maximize2 className="size-3.5" /> Fullscreen</>
                                    }
                                </button>
                            )}
                        </div>

                        {/* ══════════════════════════════════════
                            TAB PANEL — Lesson Content
                        ══════════════════════════════════════ */}
                        <div className={`flex flex-col overflow-hidden min-h-0 transition-all ${
                            activeTab === 'content' ? 'flex-1' : 'hidden'
                        } ${
                            contentFullscreen
                                ? 'fixed inset-0 z-50 bg-background'
                                : ''
                        }`}>

                            {/* Fullscreen header bar — only shown in fullscreen mode */}
                            {contentFullscreen && (
                                <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-6 py-3 shadow-sm">
                                    <span className="flex size-6 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-950">
                                        <FileText className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                                    </span>
                                    <span className="text-sm font-semibold">Lesson Content</span>
                                    {blocks.length > 0 && (
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                            {blocks.length} block{blocks.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setContentFullscreen(false)}
                                        className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors dark:hover:bg-indigo-950/30"
                                    >
                                        <Minimize2 className="size-3.5" /> Exit fullscreen
                                    </button>
                                </div>
                            )}

                            {/* Scrollable block canvas */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
                                    {blocks.length === 0 && (
                                        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border py-16 text-center bg-muted/10">
                                            <div className="flex size-14 items-center justify-center rounded-full bg-muted/50">
                                                <FileText className="size-7 text-muted-foreground/30" />
                                            </div>
                                            <div>
                                                <p className="font-semibold">No content yet</p>
                                                <p className="mt-1 text-sm text-muted-foreground">Use the toolbar below to add text, images, or videos.</p>
                                            </div>
                                        </div>
                                    )}
                                    {blocks.map((block, idx) => (
                                        <EditBlock
                                            key={block.id}
                                            block={block}
                                            index={idx}
                                            total={blocks.length}
                                            onUpdate={updateBlock}
                                            onDelete={deleteBlock}
                                            onMove={moveBlock}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* YouTube/Vimeo URL bar */}
                            {addingVideo && (
                                <div className="flex shrink-0 items-center gap-2 border-t border-border bg-amber-50/60 px-4 py-2 dark:bg-amber-950/10">
                                    <Play className="size-3.5 shrink-0 text-amber-500" />
                                    <Input placeholder="Paste YouTube or Vimeo URL" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="h-7 flex-1 text-xs" />
                                    <Input placeholder="Caption (optional)" value={videoCaption} onChange={(e) => setVideoCaption(e.target.value)} className="h-7 w-36 text-xs" />
                                    <Button size="sm" className="h-7 px-3 text-xs" onClick={submitVideoUrl} disabled={uploading || !videoUrl.trim()}>Add</Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setAddingVideo(false)}>✕</Button>
                                </div>
                            )}

                            {/* Add content toolbar */}
                            <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-card px-4 py-2.5">
                                <span className="mr-1 text-xs font-medium text-muted-foreground">Add:</span>
                                <button
                                    type="button"
                                    disabled={uploading}
                                    onClick={addTitleBlock}
                                    title="Add section title"
                                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors border-l-4 border-l-purple-500"
                                >
                                    <Heading2 className="size-3.5 text-purple-500" />
                                    Title
                                </button>
                                <button
                                    type="button"
                                    disabled={uploading}
                                    onClick={addTextBlock}
                                    title="Add text block"
                                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors border-l-4 border-l-indigo-500"
                                >
                                    <FileText className="size-3.5 text-indigo-500" />
                                    Text
                                </button>
                                <button
                                    type="button"
                                    disabled={uploading}
                                    onClick={() => imageRef.current?.click()}
                                    title="Upload image"
                                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors border-l-4 border-l-emerald-500"
                                >
                                    {uploading && uploadPct > 0
                                        ? <><Loader2 className="size-3.5 animate-spin text-emerald-500" />{uploadPct}%</>
                                        : <><ImageIcon className="size-3.5 text-emerald-500" />Image</>
                                    }
                                </button>
                                <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                                <button
                                    type="button"
                                    disabled={uploading}
                                    onClick={() => videoRef.current?.click()}
                                    title="Upload video"
                                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors border-l-4 border-l-rose-500"
                                >
                                    {uploading && uploadPct > 0
                                        ? <><Loader2 className="size-3.5 animate-spin text-rose-500" />{uploadPct}%</>
                                        : <><Video className="size-3.5 text-rose-500" />Video</>
                                    }
                                </button>
                                <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadVideoFile(e.target.files[0])} />
                                <button
                                    type="button"
                                    onClick={() => setAddingVideo((v) => !v)}
                                    title="Embed YouTube / Vimeo"
                                    className={`flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors border-l-4 border-l-amber-500 ${addingVideo ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/20' : ''}`}
                                >
                                    <Play className="size-3.5 text-amber-500" />
                                    Embed
                                </button>
                            </div>
                        </div>

                        {/* ══════════════════════════════════════
                            TAB PANEL — Quiz Editor
                        ══════════════════════════════════════ */}
                        <div className={`flex flex-1 flex-col overflow-hidden min-h-0 ${activeTab === 'quiz' ? '' : 'hidden'}`}>
                            <div className="flex-1 overflow-y-auto">
                                <div className="mx-auto max-w-2xl">
                                    <QuizSection quiz={quiz} base={base} onQuizChange={setQuiz} />
                                </div>
                            </div>
                        </div>

                        {/* ══════════════════════════════════════
                            TAB PANEL — Video Submission
                        ══════════════════════════════════════ */}
                        <div className={`flex flex-1 flex-col overflow-hidden min-h-0 ${activeTab === 'settings' ? '' : 'hidden'}`}>
                            <div className="flex-1 overflow-y-auto">
                                <div className="mx-auto max-w-lg">
                                    <LessonSettingsPanel
                                        exerciseVideoEnabled={exerciseVideoEnabled}
                                        toggling={togglingExercise}
                                        onToggle={toggleExerciseVideo}
                                        exerciseVideoLabel={exerciseVideoLabel}
                                        savingLabel={savingLabel}
                                        onSaveLabel={saveExerciseVideoLabel}
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </>
    );
}

/* ═══════════════════════════════════════════════════
   Video Submission Panel
═══════════════════════════════════════════════════ */
function LessonSettingsPanel({
    exerciseVideoEnabled,
    toggling,
    onToggle,
    exerciseVideoLabel,
    savingLabel,
    onSaveLabel,
}: {
    exerciseVideoEnabled: boolean;
    toggling: boolean;
    onToggle: () => void;
    exerciseVideoLabel: string;
    savingLabel: boolean;
    onSaveLabel: (label: string) => void;
}) {
    const [draft, setDraft] = useState(exerciseVideoLabel);
    const isDirty           = draft.trim() !== exerciseVideoLabel.trim();
    const placeholder       = 'Exercise Video Upload';

    useEffect(() => { setDraft(exerciseVideoLabel); }, [exerciseVideoLabel]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isDirty) return;
        onSaveLabel(draft);
    };

    return (
        <div className="px-4 py-4 flex flex-col gap-3">
                    {/* ── Toggle row ── */}
                    <div className={`flex items-center justify-between gap-4 rounded-xl border p-3.5 transition-colors ${
                        exerciseVideoEnabled
                            ? 'border-violet-200 bg-violet-50/60 dark:border-violet-900/40 dark:bg-violet-950/20'
                            : 'border-border bg-muted/20'
                    }`}>
                        <div className="flex items-center gap-3 min-w-0">
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                exerciseVideoEnabled ? 'bg-violet-600' : 'bg-muted'
                            }`}>
                                <Video className={`size-4 ${exerciseVideoEnabled ? 'text-white' : 'text-muted-foreground'}`} />
                            </span>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold leading-tight truncate">
                                    {exerciseVideoLabel.trim() || placeholder}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                                    {exerciseVideoEnabled
                                        ? 'Students can submit a video before taking the quiz'
                                        : 'Video submission is disabled for this lesson'}
                                </p>
                            </div>
                        </div>

                        {/* Toggle switch */}
                        <button
                            type="button"
                            role="switch"
                            aria-checked={exerciseVideoEnabled}
                            disabled={toggling}
                            onClick={onToggle}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                                exerciseVideoEnabled ? 'bg-violet-600' : 'bg-input'
                            }`}
                        >
                            <span className={`pointer-events-none block size-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                                exerciseVideoEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>

                    {/* ── Rename input (visible when enabled) ── */}
                    {exerciseVideoEnabled && (
                        <form onSubmit={handleSave} className="flex flex-col gap-1.5">
                            <Label className="text-xs text-muted-foreground">Upload section label</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    placeholder={placeholder}
                                    maxLength={80}
                                    className="h-8 text-sm flex-1"
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    variant={isDirty ? 'default' : 'outline'}
                                    disabled={savingLabel || !isDirty}
                                    className="h-8 px-3 text-xs shrink-0 gap-1"
                                >
                                    {savingLabel
                                        ? <Loader2 className="size-3 animate-spin" />
                                        : <Save className="size-3" />
                                    }
                                    {savingLabel ? 'Saving…' : 'Save'}
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-tight">
                                This name appears on the mobile app card. Leave blank to use the default.
                            </p>
                        </form>
                    )}

                    {/* ── Status hint ── */}
                    <p className={`text-[11px] flex items-center gap-1.5 ${exerciseVideoEnabled ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`}>
                        {exerciseVideoEnabled ? (
                            <>
                                <CheckCircle2 className="size-3 shrink-0" />
                                Active — students will see the upload panel on the mobile app.
                            </>
                        ) : (
                            <>
                                <span className="size-3 shrink-0 inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground text-[9px] font-bold">✕</span>
                                Off — the upload panel will not appear on the mobile app.
                            </>
                        )}
                    </p>
                </div>
    );
}

/* ═══════════════════════════════════════════════════
   View Mode
═══════════════════════════════════════════════════ */
function ViewMode({ mod, blocks }: { mod: ModuleMeta; blocks: Block[] }) {
    const courseLabel = COURSE_LABELS[mod.course] ?? mod.course;
    const courseColor = COURSE_COLORS[mod.course] ?? 'bg-muted text-muted-foreground';
    return (
        <div className="flex flex-1 flex-col overflow-y-auto bg-background">
            <article className="mx-auto w-full max-w-3xl px-6 py-10">
                <div className="mb-8 border-b border-border pb-6">
                    <span className={`mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${courseColor}`}>
                        {courseLabel}
                    </span>
                    <h1 className="text-4xl font-bold tracking-tight">{mod.title}</h1>
                    {mod.description && <p className="mt-3 text-lg text-muted-foreground">{mod.description}</p>}
                </div>
                <div className="flex flex-col gap-8">
                    {blocks.length === 0 && <p className="text-center text-muted-foreground italic">This module has no content yet.</p>}
                    {blocks.map((block) => <ViewBlock key={block.id} block={block} />)}
                </div>
            </article>
        </div>
    );
}

function ViewBlock({ block }: { block: Block }) {
    const embed = block.type === 'video' ? toEmbed(block.content) : null;
    const [lightbox, setLightbox] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);

    if (block.type === 'title') return <h2 className="text-2xl font-bold tracking-tight text-foreground mt-4">{block.content}</h2>;
    if (block.type === 'text') return <p className="text-base leading-8 text-foreground whitespace-pre-wrap">{renderBold(block.content)}</p>;

    if (block.type === 'image') return (
        <>
            <figure className="flex flex-col items-center gap-3">
                {/* skeleton shown while loading */}
                {!imgLoaded && (
                    <div className="w-full rounded-xl bg-muted animate-pulse" style={{ aspectRatio: '16/9' }} />
                )}
                <div
                    className={`group relative w-full cursor-zoom-in overflow-hidden rounded-xl shadow-md transition-opacity ${imgLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
                    onClick={() => setLightbox(true)}
                    title="Click to enlarge"
                >
                    <img
                        src={block.content}
                        alt={block.caption ?? ''}
                        className="w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                        onLoad={() => setImgLoaded(true)}
                    />
                    {/* hover overlay hint */}
                    <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                            Enlarge
                        </span>
                    </div>
                </div>
                {block.caption && (
                    <figcaption className="text-sm text-muted-foreground italic text-center">{block.caption}</figcaption>
                )}
            </figure>
            {lightbox && <Lightbox src={block.content} caption={block.caption} onClose={() => setLightbox(false)} />}
        </>
    );

    if (block.type === 'video') return (
        <figure className="flex flex-col gap-3">
            {block.caption && (
                <figcaption className="text-center text-sm font-medium text-muted-foreground italic">{block.caption}</figcaption>
            )}
            <div className="relative w-full overflow-hidden rounded-xl bg-black shadow-lg ring-1 ring-black/10">
                {embed ? (
                    /* YouTube / Vimeo embed */
                    <div className="aspect-video">
                        <iframe
                            src={embed.src}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                            title={block.caption ?? 'Video'}
                        />
                    </div>
                ) : (
                    /* Uploaded video file */
                    <video
                        src={block.content}
                        controls
                        controlsList="nodownload"
                        className="aspect-video w-full bg-black"
                        preload="metadata"
                        playsInline
                        style={{ display: 'block' }}
                    >
                        Your browser does not support the video tag.
                    </video>
                )}
            </div>
        </figure>
    );

    return null;
}

/* ═══════════════════════════════════════════════════
   Edit-mode block renderer
═══════════════════════════════════════════════════ */
function EditBlock({
    block, index, total, onUpdate, onDelete, onMove,
}: {
    block: Block;
    index: number;
    total: number;
    onUpdate: (id: number, content: string, caption?: string) => void;
    onDelete: (id: number) => void;
    onMove: (index: number, dir: 'up' | 'down') => void;
}) {
    const [editing, setEditing] = useState(false);
    const [text, setText]       = useState(block.content);
    const [caption, setCaption] = useState(block.caption ?? '');
    const textareaRef           = useRef<HTMLTextAreaElement>(null);

    // Auto-resize rows: min 6, 1 row per ~80 chars
    const textRows = Math.max(6, Math.ceil(text.length / 80));

    const save = () => { onUpdate(block.id, text, caption || undefined); setEditing(false); };
    const embed = block.type === 'video' ? toEmbed(block.content) : null;

    return (
        <div className={`group relative rounded-xl border bg-card shadow-sm transition-all ${
            editing
                ? 'border-indigo-400 ring-2 ring-indigo-200 dark:ring-indigo-900/60 shadow-md'
                : 'border-border ring-transparent hover:ring-2 hover:ring-border'
        }`}>
            {/* Block header: type badge + controls */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <BlockTypeBadge type={block.type} />
                {editing && (
                    <span className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 ml-1">editing</span>
                )}
                <span className="flex-1" />
                {/* Move up */}
                <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMove(index, 'up')}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
                    title="Move up"
                >
                    <ArrowUp className="size-4" />
                </button>
                {/* Move down */}
                <button
                    type="button"
                    disabled={index === total - 1}
                    onClick={() => onMove(index, 'down')}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
                    title="Move down"
                >
                    <ArrowDown className="size-4" />
                </button>
                {/* Delete */}
                <button
                    type="button"
                    onClick={() => onDelete(block.id)}
                    className="rounded p-1.5 text-destructive/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Delete block"
                >
                    <Trash2 className="size-4" />
                </button>
            </div>

            {/* Block body */}
            <div className="p-4">

            {/* ── TITLE block ── */}
            {block.type === 'title' && (
                editing ? (
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            autoFocus
                            placeholder="Section title…"
                            className="w-full rounded-lg border border-indigo-300 bg-background px-4 py-3 text-2xl font-bold tracking-tight outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 dark:border-indigo-700"
                        />
                        <div className="flex items-center gap-2">
                            <Button onClick={save} className="px-5">Save</Button>
                            <Button variant="ghost" onClick={() => { setEditing(false); setText(block.content); }}>Cancel</Button>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={() => setEditing(true)}
                        className="cursor-text rounded-lg px-4 py-3 text-2xl font-bold tracking-tight hover:bg-muted/40 transition-colors"
                    >
                        {block.content}
                    </div>
                )
            )}

            {/* ── TEXT block ── */}
            {block.type === 'text' && (
                editing ? (
                    <div className="flex flex-col gap-3">
                        {/* Bold toolbar */}
                        <div className="flex items-center gap-1 rounded-t-lg border border-b-0 border-indigo-300 bg-muted/50 px-3 py-2 dark:border-indigo-700">
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    if (textareaRef.current) insertBold(textareaRef.current, text, setText);
                                }}
                                className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                                title="Bold (wraps selection in **text**)"
                            >
                                <Bold className="size-4" />
                                Bold
                            </button>
                            <span className="ml-auto text-xs text-muted-foreground/50">
                                Use **text** for bold
                            </span>
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={textRows}
                            autoFocus
                            className="w-full rounded-b-lg border border-indigo-300 bg-background px-4 py-3 text-base leading-relaxed outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 resize-y dark:border-indigo-700"
                        />
                        <div className="flex items-center gap-2">
                            <Button onClick={save} className="px-5">Save</Button>
                            <Button variant="ghost" onClick={() => { setEditing(false); setText(block.content); }}>Cancel</Button>
                            <span className="ml-auto text-xs text-muted-foreground/60">{text.length} chars</span>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={() => setEditing(true)}
                        className="cursor-text whitespace-pre-wrap rounded-lg px-4 py-3 text-base leading-relaxed hover:bg-muted/40 transition-colors min-h-[72px]"
                    >
                        {renderBold(block.content)}
                    </div>
                )
            )}

            {/* ── IMAGE block ── */}
            {block.type === 'image' && (
                <div className="flex flex-col gap-3">
                    {editing ? (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    placeholder="Add a caption for this image…"
                                    className="h-10 text-sm flex-1"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={save} className="px-5">Save</Button>
                                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <p
                            onClick={() => setEditing(true)}
                            className="cursor-text text-center text-sm italic text-muted-foreground hover:bg-muted/30 rounded py-1.5 transition-colors"
                        >
                            {block.caption ? block.caption : <span className="text-muted-foreground/40">+ Add caption</span>}
                        </p>
                    )}
                    <img src={block.content} alt={block.caption ?? ''} className="w-full rounded-lg shadow-sm" />
                </div>
            )}

            {/* ── VIDEO block ── */}
            {block.type === 'video' && (
                <div className="flex flex-col gap-3">
                    {editing ? (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    placeholder="Add a caption for this video…"
                                    className="h-10 text-sm flex-1"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={save} className="px-5">Save</Button>
                                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <p
                            onClick={() => setEditing(true)}
                            className="cursor-text text-center text-sm italic text-muted-foreground hover:bg-muted/30 rounded py-1.5 transition-colors"
                        >
                            {block.caption ? block.caption : <span className="text-muted-foreground/40">+ Add caption</span>}
                        </p>
                    )}
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-sm">
                        {embed
                            ? <iframe src={embed.src} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen title={block.caption ?? 'Video'} />
                            : <video src={block.content} controls controlsList="nodownload" playsInline className="h-full w-full" preload="metadata" />
                        }
                        {/* Play overlay badge for uploaded files */}
                        {!embed && (
                            <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
                                <Play className="size-3 fill-white" /> Video
                            </div>
                        )}
                    </div>
                </div>
            )}

            </div>{/* end block body */}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Quiz Section
═══════════════════════════════════════════════════ */
const BLANK_QUESTION = {
    question: '',
    choice_a: '',
    choice_b: '',
    choice_c: '',
    choice_d: '',
    correct_answer: 'a' as 'a' | 'b' | 'c' | 'd',
};

const PASSING_SCORE = 75;

function QuizSection({
    quiz,
    base,
    onQuizChange,
}: {
    quiz: QuizData;
    base: string;
    onQuizChange: (q: QuizData) => void;
}) {
    const [creating, setCreating]       = useState(false);
    const [quizTitle, setQuizTitle]     = useState('Module Quiz');
    const [saving, setSaving]           = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [newTitle, setNewTitle]       = useState('');
    const [addingQ, setAddingQ]         = useState(false);
    const [editingQ, setEditingQ]       = useState<QuizQuestion | null>(null);

    const createQuiz = async () => {
        if (!quizTitle.trim()) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${base}/quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: quizTitle }),
            });
            const json = await res.json();
            if (res.ok) { onQuizChange(json.quiz); setCreating(false); toast.success('Quiz created.'); }
            else toast.error(json.message ?? 'Failed to create quiz.');
        } catch { toast.error('Network error.'); }
        finally { setSaving(false); }
    };

    const deleteQuiz = async () => {
        if (!quiz || !confirm('Delete the entire quiz and all its questions? This cannot be undone.')) return;
        try {
            await apiFetch(`${base}/quiz/${quiz.id}`, { method: 'DELETE' });
            onQuizChange(null);
            toast.success('Quiz deleted.');
        } catch { toast.error('Network error.'); }
    };

    const saveTitle = async () => {
        if (!quiz || !newTitle.trim()) return;
        try {
            await apiFetch(`${base}/quiz/${quiz.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle }),
            });
            onQuizChange({ ...quiz, title: newTitle });
            setEditingTitle(false);
            toast.success('Quiz title updated.');
        } catch { toast.error('Failed.'); }
    };

    const onQuestionSaved = (q: QuizQuestion, isEdit: boolean) => {
        if (!quiz) return;
        const updated = isEdit
            ? quiz.questions.map((x) => (x.id === q.id ? q : x))
            : [...quiz.questions, q];
        onQuizChange({ ...quiz, questions: updated });
        setAddingQ(false);
        setEditingQ(null);
    };

    const deleteQuestion = async (qId: number) => {
        if (!quiz || !confirm('Delete this question?')) return;
        try {
            await apiFetch(`${base}/quiz/${quiz.id}/questions/${qId}`, { method: 'DELETE' });
            onQuizChange({ ...quiz, questions: quiz.questions.filter((q) => q.id !== qId) });
            toast.success('Question deleted.');
        } catch { toast.error('Failed.'); }
    };

    return (
        <div className="p-5 pb-16">

            {/* No quiz yet */}
            {!quiz && !creating && (
                <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border py-12 text-center">
                    <span className="text-4xl">📋</span>
                    <div>
                        <p className="font-medium text-foreground">No quiz yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">Add a quiz to test students after they finish this module.</p>
                    </div>
                    <Button size="sm" className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0" onClick={() => setCreating(true)}>
                        <Plus className="size-3.5" /> Add quiz
                    </Button>
                </div>
            )}

            {/* Create quiz form */}
            {!quiz && creating && (
                <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">New quiz</p>
                    <div className="grid gap-1.5">
                        <Label className="text-xs">Quiz title</Label>
                        <Input value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} placeholder="e.g. Module 1 Quiz" autoFocus />
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" disabled={saving || !quizTitle.trim()} onClick={createQuiz} className="bg-amber-500 hover:bg-amber-600 text-white border-0">
                            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                            Create quiz
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
                    </div>
                </div>
            )}

            {/* Existing quiz */}
            {quiz && (
                <div className="flex flex-col gap-4">

                    {/* Quiz title row */}
                    <div className="flex items-center gap-2">
                        {editingTitle ? (
                            <>
                                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-8 max-w-xs text-sm" autoFocus />
                                <Button size="sm" onClick={saveTitle}><Save className="size-3.5" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>Cancel</Button>
                            </>
                        ) : (
                            <>
                                <span className="text-base font-semibold">{quiz.title}</span>
                                <button
                                    type="button"
                                    onClick={() => { setNewTitle(quiz.title); setEditingTitle(true); }}
                                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    title="Rename quiz"
                                >
                                    <Edit3 className="size-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={deleteQuiz}
                                    className="ml-auto rounded p-1 text-destructive hover:bg-destructive/10"
                                    title="Delete quiz"
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Questions list */}
                    {quiz.questions.length === 0 && !addingQ && (
                        <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                            No questions yet. Click "Add question" to start.
                        </p>
                    )}

                    {quiz.questions.map((q, idx) => (
                        editingQ?.id === q.id ? (
                            <QuestionForm
                                key={q.id}
                                initial={q}
                                quizId={quiz.id}
                                base={base}
                                onSaved={(saved) => onQuestionSaved(saved, true)}
                                onCancel={() => setEditingQ(null)}
                            />
                        ) : (
                            <div key={q.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                                <div className="mb-3 flex items-start gap-3">
                                    {/* Large number badge */}
                                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                        {idx + 1}
                                    </span>
                                    <p className="flex-1 text-sm font-medium leading-relaxed">{q.question}</p>
                                    <button
                                        type="button"
                                        onClick={() => setEditingQ(q)}
                                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
                                        title="Edit question"
                                    >
                                        <Edit3 className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deleteQuestion(q.id)}
                                        className="shrink-0 rounded p-1 text-destructive hover:bg-destructive/10"
                                        title="Delete question"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </div>
                                <div className="ml-11 grid grid-cols-2 gap-2">
                                    {(['a', 'b', 'c', 'd'] as const).map((letter) => (
                                        <div
                                            key={letter}
                                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                                                q.correct_answer === letter
                                                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-semibold dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                    : 'border-border bg-muted/30 text-muted-foreground'
                                            }`}
                                        >
                                            <span className="uppercase font-bold opacity-70 shrink-0">{letter}.</span>
                                            <span className="flex-1 truncate">{q[`choice_${letter}` as 'choice_a']}</span>
                                            {q.correct_answer === letter && (
                                                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    ))}

                    {/* Add question form */}
                    {addingQ && (
                        <QuestionForm
                            quizId={quiz.id}
                            base={base}
                            onSaved={(saved) => onQuestionSaved(saved, false)}
                            onCancel={() => setAddingQ(false)}
                        />
                    )}

                    {!addingQ && !editingQ && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-2 border-dashed border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 py-5"
                            onClick={() => setAddingQ(true)}
                        >
                            <Plus className="size-4" /> Add question
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─── Question form (add or edit) ──────────────────── */
const CHOICE_LABELS: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };
const CHOICE_COLORS: Record<string, string> = {
    a: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    b: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    c: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
    d: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

function QuestionForm({
    initial,
    quizId,
    base,
    onSaved,
    onCancel,
}: {
    initial?: QuizQuestion;
    quizId: number;
    base: string;
    onSaved: (q: QuizQuestion) => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState(initial ?? BLANK_QUESTION);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const set = (key: keyof typeof BLANK_QUESTION, value: string) =>
        setForm((f) => ({ ...f, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const url = initial
                ? `${base}/quiz/${quizId}/questions/${initial.id}`
                : `${base}/quiz/${quizId}/questions`;
            const res = await apiFetch(url, {
                method: initial ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const json = await res.json();
            if (res.ok) {
                onSaved(json.question);
                toast.success(initial ? 'Question updated.' : 'Question added.');
            } else {
                const errors = json.errors
                    ? Object.values(json.errors as Record<string, string[]>).flat().join(' ')
                    : json.message ?? 'Failed.';
                toast.error(errors);
            }
        } catch { toast.error('Network error.'); }
        finally { setSaving(false); }
    };

    const correctChoiceText = form[`choice_${form.correct_answer}` as 'choice_a'] || '(not set)';

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/10"
        >
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                {initial ? 'Edit question' : 'New question'}
            </p>

            {/* Question text */}
            <div className="grid gap-1">
                <Label className="text-xs">Question</Label>
                <Textarea
                    value={form.question}
                    onChange={(e) => set('question', e.target.value)}
                    placeholder="Type your question here…"
                    rows={3}
                    required
                />
            </div>

            {/* Choices with A/B/C/D prefix */}
            <div className="grid grid-cols-1 gap-2">
                {(['a', 'b', 'c', 'd'] as const).map((letter) => (
                    <div key={letter} className="flex items-center gap-2 rounded-lg border border-border bg-background overflow-hidden">
                        <span className={`flex shrink-0 items-center justify-center w-9 self-stretch text-xs font-bold ${CHOICE_COLORS[letter]}`}>
                            {CHOICE_LABELS[letter]}
                        </span>
                        <input
                            type="text"
                            value={form[`choice_${letter}` as 'choice_a']}
                            onChange={(e) => set(`choice_${letter}` as 'choice_a', e.target.value)}
                            placeholder={`Option ${CHOICE_LABELS[letter]}`}
                            required
                            className="flex-1 bg-transparent py-2 pr-3 text-sm outline-none placeholder:text-muted-foreground/50"
                        />
                    </div>
                ))}
            </div>

            {/* Correct answer picker — shows letter + text preview */}
            <div className="grid gap-2">
                <Label className="text-xs">Correct answer</Label>
                <div className="flex gap-2">
                    {(['a', 'b', 'c', 'd'] as const).map((letter) => {
                        const choiceText = form[`choice_${letter}` as 'choice_a'];
                        const isSelected = form.correct_answer === letter;
                        return (
                            <button
                                key={letter}
                                type="button"
                                onClick={() => set('correct_answer', letter)}
                                title={choiceText || `Choice ${CHOICE_LABELS[letter]}`}
                                className={`flex flex-col items-center gap-0.5 flex-1 rounded-lg border py-2 px-1 text-xs font-bold uppercase transition-colors ${
                                    isSelected
                                        ? 'border-emerald-500 bg-emerald-500 text-white'
                                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                {letter}
                                {isSelected && choiceText && (
                                    <span className="text-[9px] font-normal normal-case max-w-full truncate opacity-90 px-0.5">
                                        {choiceText.length > 12 ? choiceText.slice(0, 12) + '…' : choiceText}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                {/* Full preview of selected answer */}
                {form.correct_answer && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        <span className="font-semibold">Correct: </span>{correctChoiceText}
                    </p>
                )}
            </div>

            {/* Preview toggle */}
            <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
            >
                <Eye className="size-3.5" />
                {showPreview ? 'Hide preview' : 'Preview question'}
            </button>

            {/* Student-facing preview */}
            {showPreview && (
                <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Student preview</p>
                    <p className="text-sm font-medium leading-relaxed mb-3">{form.question || <span className="italic text-muted-foreground">Question text…</span>}</p>
                    <div className="grid grid-cols-2 gap-2">
                        {(['a', 'b', 'c', 'd'] as const).map((letter) => {
                            const choiceText = form[`choice_${letter}` as 'choice_a'];
                            return (
                                <div key={letter} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs cursor-default">
                                    <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${CHOICE_COLORS[letter]}`}>
                                        {CHOICE_LABELS[letter]}
                                    </span>
                                    <span className={choiceText ? '' : 'italic text-muted-foreground/40'}>
                                        {choiceText || `Option ${CHOICE_LABELS[letter]}`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    {initial ? 'Save changes' : 'Add question'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
            </div>
        </form>
    );
}

ModuleEditor.layout = (props: { currentTeam?: { slug: string } | null }) => ({
    breadcrumbs: [
        { title: 'Modules', href: props.currentTeam ? `/${props.currentTeam.slug}/modules` : '/' },
        { title: 'Editor', href: '#' },
    ],
});
