<?php

namespace App\Http\Controllers;

use App\Models\Module;
use App\Models\User;
use Inertia\Inertia;
use Inertia\Response;

class OverviewController extends Controller
{
    public function __invoke(): Response
    {
        $students = User::where('role', 'student')->get();
        $teachers = User::where('role', 'teacher')->get();
        $modules  = Module::all();

        $sections = $students
            ->whereNotNull('section')
            ->groupBy('section')
            ->map(fn ($group) => $group->count())
            ->sortKeys()
            ->toArray();

        $recentUsers = User::whereIn('role', ['student', 'teacher'])
            ->orderByDesc('created_at')
            ->limit(8)
            ->get()
            ->map(fn ($u) => [
                'id'         => $u->id,
                'name'       => $u->name,
                'role'       => $u->role,
                'created_at' => $u->created_at->diffForHumans(),
            ]);

        return Inertia::render('overview', [
            'stats' => [
                'total_users'      => $students->count() + $teachers->count(),
                'total_students'   => $students->count(),
                'total_teachers'   => $teachers->count(),
                'total_modules'    => $modules->count(),
                'pathfit1_modules' => $modules->where('course', 'pathfit1')->count(),
                'pathfit2_modules' => $modules->where('course', 'pathfit2')->count(),
                'active_teachers'  => $teachers->where('is_approved', true)->count(),
                'pending_teachers' => $teachers->where('is_approved', false)->count(),
                'sections'         => $sections,
                'recent_users'     => $recentUsers,
            ],
        ]);
    }
}
