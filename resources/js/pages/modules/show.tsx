import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Download,
    ExternalLink,
    Play,
    Upload,
    Video,
    Youtube,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/* ─── Types ─────────────────────────────────────────── */
type BlockType = 'text' | 'title' | 'image' | 'video';
type Block = { id: number; type: BlockType; content: string; caption: string | null; order: number };
type QuizQuestion = {
    id: number;
    question: string;
    choices: { a: string; b: string; c: string; d: string };
};
type QuizData = { id: number; title: string; questions: QuizQuestion[] } | null;
type ModuleMeta = {
    id: number;
    title: string;
    course: string;
    description: string | null;
    cover_url: string | null;
    is_active: boolean;
    exercise_video_enabled: boolean;
};
type StudentVideoEntry = {
    student_id: number;
    name: string;
    student_no: string | null;
    section: string | null;
    video_url: string;
    uploaded_at: string;
};
type MyExerciseVideo = {
    video_url: string;
    uploaded_at: string;
} | null;

type Props = {
    module: ModuleMeta;
    contents: Block[];
    quiz: QuizData;
    isCompleted: boolean;
    userRole: 'teacher' | 'student' | string;
    studentVideos: StudentVideoEntry[] | null;
    myExerciseVideo: MyExerciseVideo;
};

const COURSE_LABELS: Record<string, string> = { pathfit1: 'Pathfit 1', pathfit2: 'Pathfit 2' };
const COURSE_COLORS: Record<string, string> = {
    pathfit1: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    pathfit2: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
};

/* ─── YouTube / Vimeo embed detector ───────────────── */
function toEmbed(url: string): { src: string; type: 'youtube' | 'vimeo'; watchUrl: string } | null {
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    if (yt) return {
        src: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`,
        type: 'youtube',
        watchUrl: `https://www.youtube.com/watch?v=${yt[1]}`,
    };
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return {
        src: `https://player.vimeo.com/video/${vm[1]}?title=0&byline=0&portrait=0`,
        type: 'vimeo',
        watchUrl: `https://vimeo.com/${vm[1]}`,
    };
    return null;
}

/* ─── Bold renderer ─────────────────────────────────── */
function renderBold(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
            ? <strong key={i}>{part.slice(2, -2)}</strong>
            : <span key={i}>{part}</span>
    );
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
                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <img
                src={src}
                alt={caption ?? ''}
                className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            />
            {caption && <p className="mt-4 text-center text-sm text-white/70 max-w-xl">{caption}</p>}
        </div>
    );
}

/* ─── Video Player ──────────────────────────────────── */
function VideoPlayer({ block }: { block: Block }) {
    const embed = toEmbed(block.content);

    if (embed) {
        return (
            <figure className="flex flex-col gap-3">
                {block.caption && (
                    <figcaption className="text-center text-sm font-medium text-muted-foreground italic">
                        {block.caption}
                    </figcaption>
                )}
                <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-black/10">
                    <div className="aspect-video">
                        <iframe
                            src={embed.src}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                            title={block.caption ?? 'Video'}
                        />
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Open in YouTube / Vimeo to save offline */}
                    <a
                        href={embed.watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-rose-700 transition-colors"
                    >
                        {embed.type === 'youtube' ? (
                            <Youtube className="size-3.5" />
                        ) : (
                            <ExternalLink className="size-3.5" />
                        )}
                        {embed.type === 'youtube' ? 'Watch on YouTube' : 'Watch on Vimeo'}
                    </a>
                    <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        <ExternalLink className="size-3" />
                        {embed.type === 'youtube' ? 'YouTube' : 'Vimeo'}
                    </span>
                </div>
                {embed.type === 'youtube' && (
                    <p className="text-xs text-muted-foreground text-center">
                        To watch offline, open on YouTube and tap <strong>Download</strong> (requires YouTube app).
                    </p>
                )}
            </figure>
        );
    }

    /* Uploaded video file — allow download for offline viewing */
    const filename = block.content.split('/').pop() ?? 'video';
    return (
        <figure className="flex flex-col gap-3">
            {block.caption && (
                <figcaption className="text-center text-sm font-medium text-muted-foreground italic">
                    {block.caption}
                </figcaption>
            )}
            <div className="overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-black/10">
                <video
                    src={block.content}
                    controls
                    className="aspect-video w-full bg-black"
                    preload="metadata"
                    playsInline
                    style={{ display: 'block' }}
                >
                    Your browser does not support the video tag.
                </video>
            </div>
            <div className="flex justify-end">
                <a
                    href={block.content}
                    download={filename}
                    className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700 transition-colors"
                >
                    <Download className="size-3.5" />
                    Download for offline
                </a>
            </div>
        </figure>
    );
}

/* ─── Content Block ─────────────────────────────────── */
function ContentBlock({ block }: { block: Block }) {
    const [lightbox, setLightbox] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);

    if (block.type === 'title') {
        return (
            <h2 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
                {block.content}
            </h2>
        );
    }

    if (block.type === 'text') {
        return (
            <p className="text-base leading-8 text-foreground whitespace-pre-wrap">
                {renderBold(block.content)}
            </p>
        );
    }

    if (block.type === 'image') {
        return (
            <>
                <figure className="flex flex-col items-center gap-3">
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
                        <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
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
    }

    if (block.type === 'video') {
        return <VideoPlayer block={block} />;
    }

    return null;
}

/* ─── Table of Contents ─────────────────────────────── */
function TableOfContents({ blocks }: { blocks: Block[] }) {
    const titles = blocks.filter((b) => b.type === 'title');
    const [open, setOpen] = useState(false);

    if (titles.length === 0) return null;

    return (
        <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
            >
                <span className="flex items-center gap-2">
                    <BookOpen className="size-4 text-muted-foreground" />
                    Contents
                </span>
                {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>
            {open && (
                <ol className="flex flex-col gap-0.5 border-t border-border px-4 py-3">
                    {titles.map((b, idx) => (
                        <li key={b.id} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <span className="mr-2 text-xs font-bold">{idx + 1}.</span>
                            {b.content}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

/* ─── Quiz Section (read-only for viewer) ───────────── */
function QuizPreview({ quiz }: { quiz: QuizData }) {
    if (!quiz || quiz.questions.length === 0) return null;

    const [expanded, setExpanded] = useState(false);

    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/10 overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-4 hover:bg-amber-100/40 dark:hover:bg-amber-950/20 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/50">
                        <BookOpen className="size-4 text-amber-600 dark:text-amber-400" />
                    </span>
                    <div className="text-left">
                        <p className="text-sm font-semibold">{quiz.title}</p>
                        <p className="text-xs text-muted-foreground">{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''} · Passing: 75%</p>
                    </div>
                </div>
                {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>

            {expanded && (
                <div className="border-t border-amber-200 dark:border-amber-900/40 px-5 py-4 flex flex-col gap-4">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                        Complete this module on the mobile app to take the quiz.
                    </p>
                    {quiz.questions.map((q, idx) => (
                        <div key={q.id} className="rounded-lg border border-border bg-background p-4">
                            <p className="mb-3 text-sm font-medium leading-relaxed">
                                <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                    {idx + 1}
                                </span>
                                {q.question}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {(['a', 'b', 'c', 'd'] as const).map((letter) => (
                                    <div key={letter} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                        <span className="font-bold uppercase opacity-60">{letter}.</span>
                                        <span className="flex-1 truncate">{q.choices[letter]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Student: My Exercise Video Section
═══════════════════════════════════════════════════ */
function MyExerciseVideoSection({ myExerciseVideo }: { myExerciseVideo: MyExerciseVideo }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 dark:border-violet-900/40 dark:bg-violet-950/10 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="flex w-full items-center justify-between px-5 py-4 hover:bg-violet-100/40 dark:hover:bg-violet-950/20 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/50">
                        <Video className="size-4 text-violet-600 dark:text-violet-400" />
                    </span>
                    <div className="text-left">
                        <p className="text-sm font-semibold">My Exercise Video</p>
                        <p className="text-xs text-muted-foreground">
                            {myExerciseVideo
                                ? `Submitted ${new Date(myExerciseVideo.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                : 'No video uploaded yet — use the mobile app to submit'}
                        </p>
                    </div>
                </div>
                {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>

            {open && (
                <div className="border-t border-violet-200 dark:border-violet-900/40 px-5 py-4">
                    {myExerciseVideo ? (
                        <div className="flex flex-col gap-3">
                            <div className="overflow-hidden rounded-xl bg-black shadow-lg ring-1 ring-black/10">
                                <video
                                    src={myExerciseVideo.video_url}
                                    controls
                                    className="aspect-video w-full bg-black"
                                    preload="metadata"
                                    playsInline
                                />
                            </div>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                    <CheckCircle2 className="size-3.5" />
                                    Submitted
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    To replace, upload a new video from the mobile app.
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-950/40">
                                <Upload className="size-6 text-violet-500" />
                            </span>
                            <p className="text-sm font-medium">No exercise video yet</p>
                            <p className="text-xs text-muted-foreground max-w-xs">
                                Open the module on the mobile app and tap <strong>Upload Exercise Video</strong> after passing the quiz.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Teacher: Student Exercise Videos Section
═══════════════════════════════════════════════════ */
const SEC_COLORS: Record<string, string> = {
    A: 'bg-violet-100 text-violet-700',
    B: 'bg-sky-100 text-sky-700',
    C: 'bg-emerald-100 text-emerald-700',
    D: 'bg-amber-100 text-amber-700',
};

function StudentVideosSection({ studentVideos }: { studentVideos: StudentVideoEntry[] }) {
    const [open, setOpen]         = useState(true);
    const [active, setActive]     = useState<number | null>(null);

    return (
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/10 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="flex w-full items-center justify-between px-5 py-4 hover:bg-sky-100/40 dark:hover:bg-sky-950/20 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950/50">
                        <Video className="size-4 text-sky-600 dark:text-sky-400" />
                    </span>
                    <div className="text-left">
                        <p className="text-sm font-semibold">Student Exercise Videos</p>
                        <p className="text-xs text-muted-foreground">
                            {studentVideos.length === 0
                                ? 'No submissions yet'
                                : `${studentVideos.length} submission${studentVideos.length !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                </div>
                {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>

            {open && (
                <div className="border-t border-sky-200 dark:border-sky-900/40 divide-y divide-sky-100 dark:divide-sky-900/30">
                    {studentVideos.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-10 text-center px-5">
                            <span className="flex size-12 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-950/40">
                                <Video className="size-6 text-sky-400" />
                            </span>
                            <p className="text-sm font-medium text-muted-foreground">No students have submitted a video yet.</p>
                        </div>
                    ) : (
                        studentVideos.map(sv => (
                            <StudentVideoRow
                                key={sv.student_id}
                                entry={sv}
                                expanded={active === sv.student_id}
                                onToggle={() => setActive(prev => prev === sv.student_id ? null : sv.student_id)}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function StudentVideoRow({
    entry, expanded, onToggle,
}: {
    entry: StudentVideoEntry;
    expanded: boolean;
    onToggle: () => void;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Pause video when row collapses
    useEffect(() => {
        if (!expanded && videoRef.current) {
            videoRef.current.pause();
        }
    }, [expanded]);

    const dateStr = new Date(entry.uploaded_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });

    return (
        <div className="bg-background">
            {/* Row header */}
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/40 transition-colors"
            >
                {/* Avatar */}
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-xs font-bold text-white">
                    {entry.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">
                        {entry.student_no ?? '—'}
                        {entry.section && (
                            <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${SEC_COLORS[entry.section] ?? 'bg-muted text-muted-foreground'}`}>
                                Sec {entry.section}
                            </span>
                        )}
                    </p>
                </div>

                {/* Date + chevron */}
                <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:block text-xs text-muted-foreground">{dateStr}</span>
                    <span className="flex size-6 items-center justify-center rounded-md bg-muted">
                        {expanded
                            ? <ChevronUp className="size-3.5 text-muted-foreground" />
                            : <ChevronDown className="size-3.5 text-muted-foreground" />}
                    </span>
                </div>
            </button>

            {/* Video player */}
            {expanded && (
                <div className="px-5 pb-5 flex flex-col gap-3">
                    <div className="overflow-hidden rounded-xl bg-black shadow-lg ring-1 ring-black/10">
                        <video
                            ref={videoRef}
                            src={entry.video_url}
                            controls
                            className="aspect-video w-full bg-black"
                            preload="metadata"
                            playsInline
                        />
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <CheckCircle2 className="size-3.5" />
                            Submitted {dateStr}
                        </span>
                        <a
                            href={entry.video_url}
                            download
                            className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-sky-700 transition-colors"
                        >
                            <Download className="size-3.5" />
                            Download
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════ */
export default function ModuleShow({ module: mod, contents, quiz, isCompleted, userRole, studentVideos, myExerciseVideo }: Props) {
    const { currentTeam } = usePage().props;
    const teamSlug = (currentTeam as { slug: string } | null)?.slug ?? '';

    const courseLabel = COURSE_LABELS[mod.course] ?? mod.course;
    const courseColor = COURSE_COLORS[mod.course] ?? 'bg-muted text-muted-foreground';

    const videoCount = contents.filter((b) => b.type === 'video').length;

    return (
        <>
            <Head title={mod.title} />

            <div className="flex flex-1 flex-col overflow-y-auto bg-background">
                <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">

                    {/* ── Back nav ── */}
                    <div className="mb-8 flex items-center justify-between">
                        <Link
                            href={`/${teamSlug}/modules`}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="size-4" />
                            Back to Modules
                        </Link>

                        <div className="flex items-center gap-2">
                            {isCompleted && (
                                <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                    <CheckCircle2 className="size-3.5" />
                                    Completed
                                </span>
                            )}
                            {userRole === 'teacher' && (
                                <Link
                                    href={`/${teamSlug}/modules/${mod.id}/edit`}
                                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                                >
                                    Edit module
                                    <ExternalLink className="size-3" />
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* ── Cover image ── */}
                    {mod.cover_url && (
                        <div className="mb-8 overflow-hidden rounded-2xl shadow-lg">
                            <img
                                src={mod.cover_url}
                                alt={mod.title}
                                className="w-full object-cover max-h-72"
                            />
                        </div>
                    )}

                    {/* ── Module header ── */}
                    <header className="mb-8 border-b border-border pb-8">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${courseColor}`}>
                                {courseLabel}
                            </span>
                            {videoCount > 0 && (
                                <span className="flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                                    <Play className="size-3" />
                                    {videoCount} video{videoCount !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{mod.title}</h1>
                        {mod.description && (
                            <p className="mt-3 text-lg text-muted-foreground">{mod.description}</p>
                        )}
                    </header>

                    {/* ── Table of contents ── */}
                    <div className="mb-8">
                        <TableOfContents blocks={contents} />
                    </div>

                    {/* ── Content blocks ── */}
                    {contents.length === 0 ? (
                        <p className="text-center text-muted-foreground italic py-16">
                            This module has no content yet.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-8">
                            {contents.map((block) => (
                                <ContentBlock key={block.id} block={block} />
                            ))}
                        </div>
                    )}

                    {/* ── Quiz preview ── */}
                    {quiz && (
                        <div className="mt-12">
                            <QuizPreview quiz={quiz} />
                        </div>
                    )}

                    {/* ── Student: my exercise video ── */}
                    {userRole === 'student' && isCompleted && mod.exercise_video_enabled && (
                        <div className="mt-12">
                            <MyExerciseVideoSection myExerciseVideo={myExerciseVideo} />
                        </div>
                    )}

                    {/* ── Student: locked upload hint ── */}
                    {userRole === 'student' && !isCompleted && mod.exercise_video_enabled && (
                        <div className="mt-10 rounded-xl border border-border bg-muted/30 p-5 flex items-center gap-4">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">🔒</span>
                            <div>
                                <p className="text-sm font-semibold">Exercise Video Upload Locked</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Pass the quiz (≥ 75%) on the mobile app to unlock exercise video submission.</p>
                            </div>
                        </div>
                    )}

                    {/* ── Teacher: student exercise videos ── */}
                    {(userRole === 'teacher' || userRole === 'admin') && mod.exercise_video_enabled && (
                        <div className="mt-12">
                            <StudentVideosSection studentVideos={studentVideos ?? []} />
                        </div>
                    )}
                </article>
            </div>
        </>
    );
}

ModuleShow.layout = (props: { currentTeam?: { slug: string } | null }) => ({
    breadcrumbs: [
        {
            title: 'Modules',
            href: props.currentTeam ? `/${props.currentTeam.slug}/modules` : '/',
        },
        { title: 'Lesson', href: '#' },
    ],
});
