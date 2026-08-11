import { Head } from '@inertiajs/react';
import {
    BookCopy,
    GraduationCap,
    LayoutDashboard,
    Users,
    UserCheck,
    UserX,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type Props = {
    stats: {
        total_users: number;
        total_students: number;
        total_teachers: number;
        total_modules: number;
        pathfit1_modules: number;
        pathfit2_modules: number;
        pending_teachers: number;
        active_teachers: number;
        sections: Record<string, number>;
    };
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Overview', href: '#' }];

const SEC_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
    A: { bg: 'bg-violet-50 dark:bg-violet-950/40',  text: 'text-violet-700 dark:text-violet-300',  bar: 'bg-violet-500' },
    B: { bg: 'bg-blue-50 dark:bg-blue-950/40',      text: 'text-blue-700 dark:text-blue-300',      bar: 'bg-blue-500'   },
    C: { bg: 'bg-emerald-50 dark:bg-emerald-950/40',text: 'text-emerald-700 dark:text-emerald-300',bar: 'bg-emerald-500'},
    D: { bg: 'bg-amber-50 dark:bg-amber-950/40',    text: 'text-amber-700 dark:text-amber-300',    bar: 'bg-amber-500'  },
};

export default function Overview({ stats }: Props) {
    const sections = Object.entries(stats.sections ?? {});
    const totalStudents = stats.total_students || 1;
    const totalTeachers = stats.total_teachers || 1;
    const totalModules  = stats.total_modules  || 1;

    const kpis = [
        {
            label: 'Total Users',
            value: stats.total_users,
            icon: LayoutDashboard,
            from: 'from-indigo-500',
            to:   'to-indigo-600',
            light:'bg-indigo-50 dark:bg-indigo-950/60',
            text: 'text-indigo-600 dark:text-indigo-300',
        },
        {
            label: 'Students',
            value: stats.total_students,
            icon: GraduationCap,
            from: 'from-sky-500',
            to:   'to-sky-600',
            light:'bg-sky-50 dark:bg-sky-950/60',
            text: 'text-sky-600 dark:text-sky-300',
        },
        {
            label: 'Teachers',
            value: stats.total_teachers,
            icon: Users,
            from: 'from-violet-500',
            to:   'to-violet-600',
            light:'bg-violet-50 dark:bg-violet-950/60',
            text: 'text-violet-600 dark:text-violet-300',
        },
        {
            label: 'Modules',
            value: stats.total_modules,
            icon: BookCopy,
            from: 'from-emerald-500',
            to:   'to-emerald-600',
            light:'bg-emerald-50 dark:bg-emerald-950/60',
            text: 'text-emerald-600 dark:text-emerald-300',
        },
    ];

    return (
        <>
            <Head title="Overview" />
            <div className="flex flex-1 flex-col gap-8 p-6 max-w-7xl">

                {/* ── Header ── */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            PathFit portal at a glance — users, modules, and section activity.
                        </p>
                    </div>
                </div>

                {/* ── KPI cards ── */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {kpis.map((k) => {
                        const Icon = k.icon;
                        return (
                            <div
                                key={k.label}
                                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                            >
                                {/* Gradient accent top-right */}
                                <div className={`absolute -right-6 -top-6 size-20 rounded-full bg-gradient-to-br ${k.from} ${k.to} opacity-10 transition-opacity group-hover:opacity-20`} />
                                <div className={`mb-4 inline-flex rounded-xl p-2.5 ${k.light}`}>
                                    <Icon className={`size-5 ${k.text}`} />
                                </div>
                                <p className={`text-3xl font-extrabold tracking-tight ${k.text}`}>{k.value}</p>
                                <p className="mt-1 text-sm font-medium text-muted-foreground">{k.label}</p>
                            </div>
                        );
                    })}
                </div>

                {/* ── Detail row ── */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

                    {/* Module split */}
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2.5">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60">
                                <BookCopy className="size-4 text-emerald-600 dark:text-emerald-300" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold">Module Breakdown</h2>
                                <p className="text-xs text-muted-foreground">{stats.total_modules} total modules</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {[
                                { label: 'Pathfit 1', sub: 'Movement Enhancement', count: stats.pathfit1_modules, bar: 'bg-sky-500',     pct: Math.round((stats.pathfit1_modules / totalModules) * 100) },
                                { label: 'Pathfit 2', sub: 'Mobility Training',    count: stats.pathfit2_modules, bar: 'bg-emerald-500', pct: Math.round((stats.pathfit2_modules / totalModules) * 100) },
                            ].map((item) => (
                                <div key={item.label}>
                                    <div className="mb-1.5 flex items-end justify-between">
                                        <div>
                                            <span className="text-sm font-semibold">{item.label}</span>
                                            <span className="ml-1.5 text-xs text-muted-foreground">{item.sub}</span>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-lg font-bold">{item.count}</span>
                                            <span className="text-xs text-muted-foreground">{item.pct}%</span>
                                        </div>
                                    </div>
                                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                                        <div className={`h-full rounded-full ${item.bar} transition-all duration-500`} style={{ width: `${item.pct}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Teacher status */}
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2.5">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/60">
                                <Users className="size-4 text-violet-600 dark:text-violet-300" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold">Teacher Status</h2>
                                <p className="text-xs text-muted-foreground">{stats.total_teachers} total teachers</p>
                            </div>
                        </div>

                        {/* Donut-style split row */}
                        <div className="mb-5 flex gap-3">
                            <div className="flex-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-center">
                                <UserCheck className="mx-auto mb-1 size-5 text-emerald-600 dark:text-emerald-300" />
                                <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-300">{stats.active_teachers}</p>
                                <p className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">Active</p>
                            </div>
                            <div className="flex-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 text-center">
                                <UserX className="mx-auto mb-1 size-5 text-amber-600 dark:text-amber-300" />
                                <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-300">{stats.pending_teachers}</p>
                                <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Pending</p>
                            </div>
                        </div>

                        {/* Bar */}
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${Math.round((stats.active_teachers / totalTeachers) * 100)}%` }}
                            />
                        </div>
                        <p className="mt-1.5 text-right text-xs text-muted-foreground">
                            {Math.round((stats.active_teachers / totalTeachers) * 100)}% activation rate
                        </p>
                    </div>

                    {/* Students by section */}
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2.5">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/60">
                                <GraduationCap className="size-4 text-sky-600 dark:text-sky-300" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold">Students by Section</h2>
                                <p className="text-xs text-muted-foreground">{stats.total_students} total students</p>
                            </div>
                        </div>

                        {sections.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                <GraduationCap className="mb-2 size-8 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">No section data yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sections.map(([sec, count]) => {
                                    const c   = SEC_COLORS[sec] ?? SEC_COLORS['A'];
                                    const pct = Math.round((count / totalStudents) * 100);
                                    return (
                                        <div key={sec}>
                                            <div className="mb-1.5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex size-6 items-center justify-center rounded-md text-xs font-bold ${c.bg} ${c.text}`}>
                                                        {sec}
                                                    </span>
                                                    <span className="text-sm font-medium">Section {sec}</span>
                                                </div>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-sm font-bold">{count}</span>
                                                    <span className="text-xs text-muted-foreground">{pct}%</span>
                                                </div>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                <div className={`h-full rounded-full ${c.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </>
    );
}

Overview.layout = (page: React.ReactNode) => (
    <AppLayout breadcrumbs={breadcrumbs}>{page}</AppLayout>
);
