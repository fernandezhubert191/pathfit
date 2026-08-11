import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    BookCopy,
    CheckCircle2,
    ExternalLink,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2,
    XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { dashboard } from '@/routes';

type Course = 'pathfit1' | 'pathfit2';

type ModuleRow = {
    id: number;
    title: string;
    course: Course;
    description: string | null;
    is_active: boolean;
    created_at: string;
};

type Props = {
    modules: ModuleRow[];
};

const COURSE_CONFIG: Record<Course, { label: string; color: string; bg: string; iconBg: string }> = {
    pathfit1: {
        label: 'Pathfit 1',
        color: 'text-indigo-700 dark:text-indigo-300',
        bg: 'bg-indigo-50 dark:bg-indigo-950/40',
        iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    },
    pathfit2: {
        label: 'Pathfit 2',
        color: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    },
};

export default function ModulesIndex({ modules }: Props) {
    const { currentTeam } = usePage().props;
    const teamSlug = (currentTeam as { slug: string } | null)?.slug ?? '';
    const flash = (usePage().props as { flash?: { success?: string; error?: string } }).flash;

    const [createCourse, setCreateCourse] = useState<Course | null>(null);
    const [editTarget, setEditTarget] = useState<ModuleRow | null>(null);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const pathfit1 = modules.filter((m) => m.course === 'pathfit1');
    const pathfit2 = modules.filter((m) => m.course === 'pathfit2');

    const handleDelete = (mod: ModuleRow) => {
        if (confirm(`Delete "${mod.title}"? This cannot be undone.`)) {
            router.delete(`/${teamSlug}/modules/${mod.id}`, { preserveScroll: true });
        }
    };

    const handleToggle = (mod: ModuleRow) => {
        router.patch(
            `/${teamSlug}/modules/${mod.id}`,
            { title: mod.title, course: mod.course, description: mod.description, is_active: !mod.is_active },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title="Modules" />

            <div className="flex flex-1 flex-col gap-6 p-6">

                {/* Page header */}
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Modules</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage course modules for Pathfit 1 and Pathfit 2.
                    </p>
                </div>

                {/* Two course containers */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {(['pathfit1', 'pathfit2'] as Course[]).map((course) => {
                        const cfg = COURSE_CONFIG[course];
                        const courseModules = course === 'pathfit1' ? pathfit1 : pathfit2;

                        return (
                            <div
                                key={course}
                                className="flex flex-col rounded-xl border border-border bg-card shadow-sm"
                            >
                                {/* Container header */}
                                <div className={`flex items-center justify-between rounded-t-xl border-b border-border px-5 py-4 ${cfg.bg}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`flex size-8 items-center justify-center rounded-lg ${cfg.iconBg}`}>
                                            <BookCopy className={`size-4 ${cfg.color}`} />
                                        </div>
                                        <div>
                                            <h2 className={`text-sm font-semibold ${cfg.color}`}>
                                                {cfg.label}
                                            </h2>
                                            <p className="text-xs text-muted-foreground">
                                                {courseModules.length} {courseModules.length === 1 ? 'module' : 'modules'}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5 text-xs"
                                        onClick={() => setCreateCourse(course)}
                                    >
                                        <Plus className="size-3.5" />
                                        Add module
                                    </Button>
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/30">
                                                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Title</th>
                                                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                                                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                                                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Added</th>
                                                <th className="px-3 py-2.5" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {courseModules.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-5 py-10 text-center">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <BookCopy className="size-8 text-muted-foreground/25" />
                                                            <p className="text-sm text-muted-foreground">
                                                                No modules yet.
                                                            </p>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-xs"
                                                                onClick={() => setCreateCourse(course)}
                                                            >
                                                                <Plus className="mr-1 size-3" />
                                                                Add first module
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                courseModules.map((mod) => (
                                                    <tr
                                                        key={mod.id}
                                                        className="hover:bg-muted/20 transition-colors"
                                                    >
                                                        {/* Title */}
                                                        <td className="px-5 py-3 font-medium">
                                                            {mod.title}
                                                        </td>

                                                        {/* Description */}
                                                        <td className="max-w-[160px] truncate px-5 py-3 text-xs text-muted-foreground">
                                                            {mod.description ?? (
                                                                <span className="italic opacity-40">—</span>
                                                            )}
                                                        </td>

                                                        {/* Status */}
                                                        <td className="px-5 py-3">
                                                            {mod.is_active ? (
                                                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                                                                    <CheckCircle2 className="size-3" />
                                                                    Active
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <XCircle className="size-3" />
                                                                    Inactive
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Added */}
                                                        <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
                                                            {mod.created_at}
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="px-3 py-3">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="size-7">
                                                                        <MoreHorizontal className="size-3.5" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem
                                                                        onClick={() => router.visit(`/${teamSlug}/modules/${mod.id}`)}
                                                                    >
                                                                        <ExternalLink className="mr-2 size-3.5" />
                                                                        View lesson
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        onClick={() => router.visit(`/${teamSlug}/modules/${mod.id}/edit`)}
                                                                    >
                                                                        <ExternalLink className="mr-2 size-3.5" />
                                                                        Open editor
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem onClick={() => setEditTarget(mod)}>
                                                                        <Pencil className="mr-2 size-3.5" />
                                                                        Edit
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleToggle(mod)}>
                                                                        {mod.is_active ? (
                                                                            <>
                                                                                <XCircle className="mr-2 size-3.5" />
                                                                                Deactivate
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <CheckCircle2 className="mr-2 size-3.5" />
                                                                                Activate
                                                                            </>
                                                                        )}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleDelete(mod)}
                                                                        className="text-destructive focus:text-destructive"
                                                                    >
                                                                        <Trash2 className="mr-2 size-3.5" />
                                                                        Delete
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Create dialog — preset course */}
            {createCourse && (
                <ModuleFormDialog
                    open={!!createCourse}
                    onClose={() => setCreateCourse(null)}
                    teamSlug={teamSlug}
                    mode="create"
                    defaultCourse={createCourse}
                />
            )}

            {/* Edit dialog */}
            {editTarget && (
                <ModuleFormDialog
                    open={!!editTarget}
                    onClose={() => setEditTarget(null)}
                    teamSlug={teamSlug}
                    mode="edit"
                    module={editTarget}
                    defaultCourse={editTarget.course}
                />
            )}
        </>
    );
}

// ── Form dialog ────────────────────────────────────────────────────────────────

function ModuleFormDialog({
    open,
    onClose,
    teamSlug,
    mode,
    module,
    defaultCourse,
}: {
    open: boolean;
    onClose: () => void;
    teamSlug: string;
    mode: 'create' | 'edit';
    module?: ModuleRow;
    defaultCourse: Course;
}) {
    const { data, setData, post, patch, processing, errors, reset } = useForm({
        title:       module?.title ?? '',
        course:      (module?.course ?? defaultCourse) as Course,
        description: module?.description ?? '',
        is_active:   module?.is_active ?? true,
    });

    useEffect(() => {
        setData({
            title:       module?.title ?? '',
            course:      (module?.course ?? defaultCourse) as Course,
            description: module?.description ?? '',
            is_active:   module?.is_active ?? true,
        });
    }, [module?.id, defaultCourse]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === 'create') {
            post(`/${teamSlug}/modules`, {
                preserveScroll: true,
                onSuccess: () => { reset(); onClose(); },
            });
        } else {
            patch(`/${teamSlug}/modules/${module!.id}`, {
                preserveScroll: true,
                onSuccess: () => onClose(),
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Add module' : 'Edit module'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? `Adding to ${COURSE_CONFIG[defaultCourse].label}`
                            : 'Update the module details below.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-4 py-2">

                    {/* Course selector — shown only when editing (can move between courses) */}
                    {mode === 'edit' && (
                        <div className="grid gap-1.5">
                            <Label>Course</Label>
                            <Select
                                value={data.course}
                                onValueChange={(v) => setData('course', v as Course)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pathfit1">Pathfit 1</SelectItem>
                                    <SelectItem value="pathfit2">Pathfit 2</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Title */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="mod-title">Module title</Label>
                        <Input
                            id="mod-title"
                            placeholder="e.g. Introduction to Physical Fitness"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            autoFocus
                        />
                        {errors.title && (
                            <p className="text-xs text-destructive">{errors.title}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="mod-desc">
                            Description{' '}
                            <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea
                            id="mod-desc"
                            placeholder="Brief description of this module…"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            rows={3}
                        />
                        {errors.description && (
                            <p className="text-xs text-destructive">{errors.description}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            {mode === 'create' ? 'Add module' : 'Save changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

ModulesIndex.layout = (props: { currentTeam?: { slug: string } | null }) => ({
    breadcrumbs: [
        {
            title: 'User Management',
            href: props.currentTeam ? dashboard(props.currentTeam.slug) : '/',
        },
        {
            title: 'Modules',
            href: props.currentTeam ? `/${props.currentTeam.slug}/modules` : '/',
        },
    ],
});
