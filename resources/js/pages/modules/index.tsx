import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    BookOpen,
    Edit,
    MoreHorizontal,
    Pencil,
    Plus,
    ToggleLeft,
    ToggleRight,
    Trash2,
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
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import * as modules from '@/routes/modules';
import type { BreadcrumbItem } from '@/types';

type ModuleRow = {
    id: number;
    title: string;
    course: 'pathfit1' | 'pathfit2';
    description: string | null;
    is_active: boolean;
    created_at: string;
};

type Props = {
    modules: ModuleRow[];
};

type ModuleForm = {
    title: string;
    course: string;
    description: string;
};

// ── Create / Edit Sheet ──────────────────────────────────────────
function ModuleSheet({
    module,
    defaultCourse,
    teamSlug,
    open,
    onOpenChange,
}: {
    module: ModuleRow | null;
    defaultCourse: 'pathfit1' | 'pathfit2';
    teamSlug: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const isEdit = module !== null;

    const { data, setData, post, patch, processing, errors, reset, clearErrors } =
        useForm<ModuleForm>({
            title: '',
            course: defaultCourse,
            description: '',
        });

    useEffect(() => {
        if (open) {
            reset();
            clearErrors();
            if (module) {
                setData({
                    title: module.title,
                    course: module.course,
                    description: module.description ?? '',
                });
            } else {
                setData((d) => ({ ...d, course: defaultCourse }));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, module?.id, defaultCourse]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit) {
            patch(modules.update.url({ current_team: teamSlug, module: module.id }), {
                preserveScroll: true,
                onSuccess: () => onOpenChange(false),
            });
        } else {
            post(modules.store.url({ current_team: teamSlug }), {
                preserveScroll: true,
                onSuccess: () => onOpenChange(false),
            });
        }
    };

    const courseLabel = data.course === 'pathfit1' ? 'Pathfit 1' : 'Pathfit 2';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? 'Edit Module' : `New ${courseLabel} Module`}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? `Update details for "${module.title}".`
                            : `Fill in the details to create a new ${courseLabel} module.`}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="mod-title">Title</Label>
                        <Input
                            id="mod-title"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            placeholder="e.g. Introduction to Movement"
                        />
                        {errors.title && (
                            <p className="text-xs text-destructive">{errors.title}</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="mod-description">Description</Label>
                        <Textarea
                            id="mod-description"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Brief description (optional)"
                            rows={3}
                        />
                        {errors.description && (
                            <p className="text-xs text-destructive">{errors.description}</p>
                        )}
                    </div>

                    <DialogFooter className="pt-2">
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={processing}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing
                                ? isEdit ? 'Saving…' : 'Creating…'
                                : isEdit ? 'Save changes' : 'Create module'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Confirm Delete Dialog ────────────────────────────────────────
function ConfirmDeleteDialog({
    module,
    teamSlug,
    open,
    onOpenChange,
}: {
    module: ModuleRow | null;
    teamSlug: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const [busy, setBusy] = useState(false);

    if (!module) return null;

    const handleDelete = () => {
        setBusy(true);
        router.delete(modules.destroy.url({ current_team: teamSlug, module: module.id }), {
            preserveScroll: true,
            onFinish: () => {
                setBusy(false);
                onOpenChange(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Delete module?</DialogTitle>
                    <DialogDescription>
                        This will permanently remove{' '}
                        <span className="font-semibold text-foreground">{module.title}</span> and
                        all its content. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={busy}>
                        {busy ? 'Deleting…' : 'Delete module'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Module Table ─────────────────────────────────────────────────
function ModuleTable({
    rows,
    teamSlug,
    onEdit,
    onDelete,
    onToggleActive,
    onAdd,
    course,
}: {
    rows: ModuleRow[];
    teamSlug: string;
    onEdit: (m: ModuleRow) => void;
    onDelete: (m: ModuleRow) => void;
    onToggleActive: (m: ModuleRow) => void;
    onAdd: () => void;
    course: 'pathfit1' | 'pathfit2';
}) {
    const isPf1 = course === 'pathfit1';
    const accent = isPf1
        ? { header: 'bg-sky-500', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300', btn: 'bg-sky-600 hover:bg-sky-700 text-white border-0' }
        : { header: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', btn: 'bg-emerald-600 hover:bg-emerald-700 text-white border-0' };

    return (
        <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Column header */}
            <div className={`flex items-center justify-between px-4 py-2.5 ${accent.header}`}>
                <div>
                    <h2 className="text-sm font-bold text-white">
                        {isPf1 ? 'Pathfit 1' : 'Pathfit 2'}
                    </h2>
                    <p className="text-xs text-white/70">
                        {rows.length} module{rows.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <Button size="sm" onClick={onAdd} className={`h-7 px-2.5 text-xs ${accent.btn}`}>
                    <Plus className="mr-1 size-3" />
                    Add module
                </Button>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
                {rows.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center px-5">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                            <BookOpen className="size-5 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm text-muted-foreground">No modules yet.</p>
                        <Button variant="outline" size="sm" onClick={onAdd}>
                            <Plus className="mr-1.5 size-3.5" />
                            Create first module
                        </Button>
                    </div>
                ) : (
                    rows.map((m) => (
                        <div
                            key={m.id}
                            className={`group flex items-center gap-3 px-5 py-3.5 transition-colors ${
                                m.is_active
                                    ? isPf1
                                        ? 'bg-sky-50/30 hover:bg-sky-50/60 dark:bg-sky-950/10 dark:hover:bg-sky-950/20'
                                        : 'bg-emerald-50/30 hover:bg-emerald-50/60 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20'
                                    : 'bg-red-50/20 hover:bg-red-50/40 dark:bg-red-950/10 dark:hover:bg-red-950/20 opacity-55'
                            }`}
                        >
                            {/* Icon */}
                            <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                                m.is_active
                                    ? isPf1 ? 'bg-sky-100 dark:bg-sky-950/50' : 'bg-emerald-100 dark:bg-emerald-950/50'
                                    : 'bg-red-100 dark:bg-red-950/30'
                            }`}>
                                <BookOpen className={`size-4 ${
                                    m.is_active
                                        ? isPf1 ? 'text-sky-600 dark:text-sky-400' : 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-red-400 dark:text-red-500'
                                }`} />
                            </div>

                            {/* Title + description */}
                            <div className="min-w-0 flex-1">
                                <Link
                                    href={modules.editor.url({ current_team: teamSlug, module: m.id })}
                                    className="block truncate text-sm font-semibold text-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                    {m.title}
                                </Link>
                                {m.description && (
                                    <p className="truncate text-xs text-muted-foreground">
                                        {m.description}
                                    </p>
                                )}
                            </div>

                            {/* Status pill */}
                            <span className={`hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                m.is_active
                                    ? isPf1
                                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                    : 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                            }`}>
                                <span className={`size-1.5 rounded-full ${
                                    m.is_active
                                        ? isPf1 ? 'bg-sky-500' : 'bg-emerald-500'
                                        : 'bg-red-400'
                                }`} />
                                {m.is_active ? 'Active' : 'Inactive'}
                            </span>

                            {/* Actions */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MoreHorizontal className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuItem asChild>
                                        <Link href={modules.editor.url({ current_team: teamSlug, module: m.id })}>
                                            <Edit className="mr-2 size-4" />
                                            Open editor
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href={modules.show.url({ current_team: teamSlug, module: m.id })}>
                                            <BookOpen className="mr-2 size-4" />
                                            View module
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onEdit(m)}>
                                        <Pencil className="mr-2 size-4" />
                                        Edit details
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => onToggleActive(m)}>
                                        {m.is_active ? (
                                            <>
                                                <ToggleLeft className="mr-2 size-4" />
                                                Deactivate
                                            </>
                                        ) : (
                                            <>
                                                <ToggleRight className="mr-2 size-4 text-emerald-600" />
                                                Activate
                                            </>
                                        )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => onDelete(m)}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="mr-2 size-4" />
                                        Delete module
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────
export default function ModulesIndex({ modules: allModules = [] }: Props) {
    const { currentTeam } = usePage().props;
    const flash = (usePage().props as { flash?: { success?: string; error?: string } }).flash;
    const teamSlug = (currentTeam as { slug: string } | null)?.slug ?? '';

    const [sheetModule, setSheetModule] = useState<ModuleRow | null>(null);
    const [sheetCourse, setSheetCourse] = useState<'pathfit1' | 'pathfit2'>('pathfit1');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [deleteModule, setDeleteModule] = useState<ModuleRow | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const openCreate = (course: 'pathfit1' | 'pathfit2') => {
        setSheetModule(null);
        setSheetCourse(course);
        setSheetOpen(true);
    };

    const openEdit = (m: ModuleRow) => {
        setSheetModule(m);
        setSheetCourse(m.course);
        setSheetOpen(true);
    };

    const openDelete = (m: ModuleRow) => {
        setDeleteModule(m);
        setDeleteOpen(true);
    };

    const handleToggleActive = (m: ModuleRow) => {
        router.patch(
            modules.update.url({ current_team: teamSlug, module: m.id }),
            { title: m.title, course: m.course, description: m.description, is_active: !m.is_active },
            { preserveScroll: true },
        );
    };

    const pf1 = allModules.filter((m) => m.course === 'pathfit1');
    const pf2 = allModules.filter((m) => m.course === 'pathfit2');

    return (
        <>
            <Head title="Modules" />

            <ModuleSheet
                module={sheetModule}
                defaultCourse={sheetCourse}
                teamSlug={teamSlug}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
            <ConfirmDeleteDialog
                module={deleteModule}
                teamSlug={teamSlug}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
            />

            <div className="flex flex-1 flex-col gap-6 p-6 max-w-7xl">

                {/* ── Header ── */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Modules</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage Pathfit 1 and Pathfit 2 learning modules.
                    </p>
                </div>

                {/* ── Two-column layout ── */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <ModuleTable
                        course="pathfit1"
                        rows={pf1}
                        teamSlug={teamSlug}
                        onAdd={() => openCreate('pathfit1')}
                        onEdit={openEdit}
                        onDelete={openDelete}
                        onToggleActive={handleToggleActive}
                    />
                    <ModuleTable
                        course="pathfit2"
                        rows={pf2}
                        teamSlug={teamSlug}
                        onAdd={() => openCreate('pathfit2')}
                        onEdit={openEdit}
                        onDelete={openDelete}
                        onToggleActive={handleToggleActive}
                    />
                </div>
            </div>
        </>
    );
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Modules', href: '#' }];

ModulesIndex.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);
