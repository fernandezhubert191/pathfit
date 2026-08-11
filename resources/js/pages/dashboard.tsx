import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock,
    GraduationCap,
    MoreHorizontal,
    Pencil,
    Search,
    Trash2,
    UserCheck,
    UserX,
    Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PendingInvitationsModal from '@/components/pending-invitations-modal';
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
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { dashboard } from '@/routes';
import * as users from '@/routes/users';
import type { DashboardInvitation } from '@/types';

type UserRow = {
    id: number;
    name: string;
    email: string;
    role: 'teacher' | 'student';
    student_id: string | null;
    section: string | null;
    employee_id: string | null;
    subject: string | null;
    is_approved: boolean;
    created_at: string;
};

type Props = {
    pendingInvitations?: DashboardInvitation[];
    users?: UserRow[];
};

const ROLE_CONFIG = {
    teacher: {
        label: 'Teacher',
        icon: Users,
        badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
        avatarBg: 'bg-gradient-to-br from-violet-500 to-violet-600',
    },
    student: {
        label: 'Student',
        icon: GraduationCap,
        badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
        avatarBg: 'bg-gradient-to-br from-sky-500 to-sky-600',
    },
} as const;

const SEC_COLORS: Record<string, string> = {
    A: 'bg-violet-100 text-violet-700',
    B: 'bg-sky-100 text-sky-700',
    C: 'bg-emerald-100 text-emerald-700',
    D: 'bg-amber-100 text-amber-700',
};

type FilterRole = 'all' | 'teacher' | 'student';
type FilterSection = 'all' | 'A' | 'B' | 'C' | 'D';

// ── Edit User Sheet ──────────────────────────────────────────────
type EditForm = {
    name: string;
    student_id: string;
    section: string;
    employee_id: string;
    subject: string;
};

function EditUserSheet({
    user,
    teamSlug,
    open,
    onOpenChange,
}: {
    user: UserRow | null;
    teamSlug: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const { data, setData, patch, processing, errors, reset, clearErrors } = useForm<EditForm>({
        name: '',
        student_id: '',
        section: '',
        employee_id: '',
        subject: '',
    });

    // Sync form when user changes
    useEffect(() => {
        if (user) {
            reset();
            clearErrors();
            setData({
                name: user.name,
                student_id: user.student_id ?? '',
                section: user.section ?? '',
                employee_id: user.employee_id ?? '',
                subject: user.subject ?? '',
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    if (!user) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(users.update.url({ current_team: teamSlug, user: user.id }), {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader className="pb-4">
                    <SheetTitle>Edit User</SheetTitle>
                    <SheetDescription>
                        Update details for{' '}
                        <span className="font-semibold text-foreground">{user.name}</span>
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4">
                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="edit-name">Full name</Label>
                        <Input
                            id="edit-name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="Full name"
                        />
                        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>

                    {/* Student fields */}
                    {user.role === 'student' && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-student-id">Student ID</Label>
                                <Input
                                    id="edit-student-id"
                                    value={data.student_id}
                                    onChange={(e) => setData('student_id', e.target.value)}
                                    placeholder="e.g. 2024-00001"
                                />
                                {errors.student_id && (
                                    <p className="text-xs text-destructive">{errors.student_id}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-section">Section</Label>
                                <Select
                                    value={data.section || '__none__'}
                                    onValueChange={(v) => setData('section', v === '__none__' ? '' : v)}
                                >
                                    <SelectTrigger id="edit-section" className="w-full">
                                        <SelectValue placeholder="No section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">No section</SelectItem>
                                        {['A', 'B', 'C', 'D'].map((s) => (
                                            <SelectItem key={s} value={s}>
                                                Section {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.section && (
                                    <p className="text-xs text-destructive">{errors.section}</p>
                                )}
                            </div>
                        </>
                    )}

                    {/* Teacher fields */}
                    {user.role === 'teacher' && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-employee-id">Employee ID</Label>
                                <Input
                                    id="edit-employee-id"
                                    value={data.employee_id}
                                    onChange={(e) => setData('employee_id', e.target.value)}
                                    placeholder="e.g. EMP-001"
                                />
                                {errors.employee_id && (
                                    <p className="text-xs text-destructive">{errors.employee_id}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="edit-subject">Subject</Label>
                                <Input
                                    id="edit-subject"
                                    value={data.subject}
                                    onChange={(e) => setData('subject', e.target.value)}
                                    placeholder="e.g. Pathfit 1"
                                />
                                {errors.subject && (
                                    <p className="text-xs text-destructive">{errors.subject}</p>
                                )}
                            </div>
                        </>
                    )}

                    <SheetFooter className="px-0 pt-2">
                        <Button type="submit" disabled={processing} className="w-full">
                            {processing ? 'Saving…' : 'Save changes'}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}

// ── Confirm Delete Dialog ────────────────────────────────────────
function ConfirmDeleteDialog({
    user,
    teamSlug,
    open,
    onOpenChange,
}: {
    user: UserRow | null;
    teamSlug: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const [busy, setBusy] = useState(false);

    if (!user) return null;

    const handleDelete = () => {
        setBusy(true);
        router.delete(users.destroy.url({ current_team: teamSlug, user: user.id }), {
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
                    <DialogTitle>Delete user?</DialogTitle>
                    <DialogDescription>
                        This will permanently remove{' '}
                        <span className="font-semibold text-foreground">{user.name}</span> and all
                        their data. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={busy}>
                        {busy ? 'Deleting…' : 'Delete user'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Page ────────────────────────────────────────────────────
export default function Dashboard({ pendingInvitations = [], users: allUsers = [] }: Props) {
    const { currentTeam } = usePage().props;
    const flash = (usePage().props as { flash?: { success?: string; error?: string } }).flash;
    const [showInvitations, setShowInvitations] = useState(pendingInvitations.length > 0);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState<FilterRole>('all');
    const [filterSection, setFilterSection] = useState<FilterSection>('all');

    // Sheet / dialog state
    const [editUser, setEditUser] = useState<UserRow | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const teamSlug = (currentTeam as { slug: string } | null)?.slug ?? '';

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error)   toast.error(flash.error);
    }, [flash]);

    const openEdit = (user: UserRow) => {
        setEditUser(user);
        setEditOpen(true);
    };

    const openDelete = (user: UserRow) => {
        setDeleteUser(user);
        setDeleteOpen(true);
    };

    // Reset section filter when leaving student view
    useEffect(() => {
        if (filterRole !== 'student') setFilterSection('all');
    }, [filterRole]);

    const filtered = allUsers.filter((u) => {
        const matchRole = filterRole === 'all' || u.role === filterRole;
        const matchSection =
            filterSection === 'all' || (u.role === 'student' && u.section === filterSection);
        const q = search.toLowerCase();
        const matchSearch =
            !q ||
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.student_id ?? '').toLowerCase().includes(q) ||
            (u.employee_id ?? '').toLowerCase().includes(q) ||
            (u.subject ?? '').toLowerCase().includes(q);
        return matchRole && matchSection && matchSearch;
    });

    const counts = {
        all:     allUsers.length,
        teacher: allUsers.filter((u) => u.role === 'teacher').length,
        student: allUsers.filter((u) => u.role === 'student').length,
    };

    const handleApprove = (user: UserRow) =>
        router.patch(users.approve.url({ current_team: teamSlug, user: user.id }), {}, { preserveScroll: true });

    const handleRevoke = (user: UserRow) =>
        router.patch(users.revoke.url({ current_team: teamSlug, user: user.id }), {}, { preserveScroll: true });

    const filterTabs: { key: FilterRole; label: string; icon: React.ElementType; activeClass: string }[] = [
        { key: 'all',     label: 'All Users', icon: Users,         activeClass: 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' },
        { key: 'teacher', label: 'Teachers',  icon: Users,         activeClass: 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' },
        { key: 'student', label: 'Students',  icon: GraduationCap, activeClass: 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' },
    ];

    const sectionTabs: { key: FilterSection; label: string }[] = [
        { key: 'all', label: 'All sections' },
        { key: 'A',   label: 'Section A' },
        { key: 'B',   label: 'Section B' },
        { key: 'C',   label: 'Section C' },
        { key: 'D',   label: 'Section D' },
    ];

    return (
        <>
            <Head title="User Management" />
            <PendingInvitationsModal
                invitations={pendingInvitations}
                open={pendingInvitations.length > 0 && showInvitations}
                onOpenChange={setShowInvitations}
            />
            <EditUserSheet
                user={editUser}
                teamSlug={teamSlug}
                open={editOpen}
                onOpenChange={setEditOpen}
            />
            <ConfirmDeleteDialog
                user={deleteUser}
                teamSlug={teamSlug}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
            />

            <div className="flex flex-1 flex-col gap-6 p-6 max-w-7xl">

                {/* ── Header ── */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Manage students, teachers and their access to PathFit.
                        </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                            {counts.teacher} Teachers
                        </span>
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                            {counts.student} Students
                        </span>
                    </div>
                </div>

                {/* ── Role filter tabs ── */}
                <div className="flex flex-wrap gap-2">
                    {filterTabs.map(({ key, label, icon: Icon, activeClass }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setFilterRole(key)}
                            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                                filterRole === key
                                    ? `${activeClass} shadow-sm`
                                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                            }`}
                        >
                            <Icon className="size-4" />
                            {label}
                            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                                filterRole === key ? 'bg-white/60 dark:bg-black/20' : 'bg-muted'
                            }`}>
                                {counts[key]}
                            </span>
                        </button>
                    ))}
                </div>

                {/* ── Section sub-filter (students only) ── */}
                {filterRole === 'student' && (
                    <div className="flex flex-wrap gap-1.5">
                        {sectionTabs.map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setFilterSection(key)}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                                    filterSection === key
                                        ? key === 'all'
                                            ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 shadow-sm'
                                            : `${SEC_COLORS[key] ?? ''} border-current shadow-sm`
                                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Table card ── */}
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">

                    {/* Toolbar */}
                    <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-5 py-3.5">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search name, email, ID or subject…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 h-9 rounded-lg bg-background"
                            />
                        </div>
                        <span className="text-xs text-muted-foreground ml-auto">
                            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
                        </span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">ID / Details</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Joined</th>
                                    <th className="px-5 py-3 w-10" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-16 text-center">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <Users className="size-8 opacity-30" />
                                                <p className="text-sm">No users found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((user) => {
                                        const cfg = ROLE_CONFIG[user.role];
                                        const RoleIcon = cfg.icon;
                                        const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

                                        return (
                                            <tr key={user.id} className="group hover:bg-muted/30 transition-colors">

                                                {/* User */}
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ${cfg.avatarBg}`}>
                                                            {initials}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="truncate font-semibold text-foreground">{user.name}</p>
                                                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Role */}
                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}>
                                                        <RoleIcon className="size-3" />
                                                        {cfg.label}
                                                    </span>
                                                </td>

                                                {/* ID / Details */}
                                                <td className="px-5 py-3.5">
                                                    {user.role === 'student' ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono text-xs text-muted-foreground">
                                                                {user.student_id ?? '—'}
                                                            </span>
                                                            {user.section && (
                                                                <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${SEC_COLORS[user.section] ?? 'bg-muted text-muted-foreground'}`}>
                                                                    Sec {user.section}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-mono text-xs text-muted-foreground">
                                                                {user.employee_id ?? '—'}
                                                            </span>
                                                            {user.subject && (
                                                                <span className="text-xs text-muted-foreground/70 italic">
                                                                    {user.subject}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td className="px-5 py-3.5">
                                                    {user.is_approved ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                                            <CheckCircle2 className="size-3.5" />
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                                            <Clock className="size-3.5" />
                                                            Pending
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Joined */}
                                                <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                                                    {user.created_at}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-5 py-3.5">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <MoreHorizontal className="size-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-52">
                                                            <DropdownMenuItem onClick={() => openEdit(user)}>
                                                                <Pencil className="mr-2 size-4" />
                                                                Edit details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            {user.role === 'teacher' && (
                                                                <>
                                                                    {user.is_approved ? (
                                                                        <DropdownMenuItem
                                                                            onClick={() => handleRevoke(user)}
                                                                            className="text-amber-600 focus:text-amber-600"
                                                                        >
                                                                            <UserX className="mr-2 size-4" />
                                                                            Deactivate teacher
                                                                        </DropdownMenuItem>
                                                                    ) : (
                                                                        <DropdownMenuItem
                                                                            onClick={() => handleApprove(user)}
                                                                            className="text-emerald-600 focus:text-emerald-600"
                                                                        >
                                                                            <UserCheck className="mr-2 size-4" />
                                                                            Activate teacher
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuSeparator />
                                                                </>
                                                            )}
                                                            <DropdownMenuItem
                                                                onClick={() => openDelete(user)}
                                                                className="text-destructive focus:text-destructive"
                                                            >
                                                                <Trash2 className="mr-2 size-4" />
                                                                Delete user
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    {filtered.length > 0 && (
                        <div className="border-t border-border bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
                            Showing {filtered.length} of {allUsers.length} users
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

Dashboard.layout = (props: { currentTeam?: { slug: string } | null }) => ({
    breadcrumbs: [
        {
            title: 'User Management',
            href: props.currentTeam ? dashboard(props.currentTeam.slug) : '/',
        },
    ],
});
