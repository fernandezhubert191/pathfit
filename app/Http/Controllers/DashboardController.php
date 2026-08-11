<?php

namespace App\Http\Controllers;

use App\Models\TeamInvitation;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $email = strtolower($request->user()->email);

        $pendingInvitations = TeamInvitation::query()
            ->with(['inviter', 'team'])
            ->whereRaw('LOWER(email) = ?', [$email])
            ->whereNull('accepted_at')
            ->where(fn ($query) => $query
                ->whereNull('expires_at')
                ->orWhere('expires_at', '>=', now()))
            ->latest()
            ->get()
            ->map(fn (TeamInvitation $invitation) => [
                'code' => $invitation->code,
                'inviterName' => $invitation->inviter->name,
                'team' => [
                    'name' => $invitation->team->name,
                    'slug' => $invitation->team->slug,
                ],
            ]);

        // Get only students and teachers — admin is not shown in user management
        $users = \App\Models\User::query()
            ->whereIn('role', ['student', 'teacher'])
            ->orderByRaw("FIELD(role, 'teacher', 'student')")
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn ($user) => [
                'id'          => $user->id,
                'name'        => $user->name,
                'email'       => $user->email,
                'role'        => $user->role,
                'student_id'  => $user->student_id,
                'section'     => $user->section,
                'employee_id' => $user->employee_id,
                'subject'     => $user->subject,
                'is_approved' => $user->is_approved,
                'created_at'  => $user->created_at->diffForHumans(),
            ]);

        return Inertia::render('dashboard', [
            'pendingInvitations' => $pendingInvitations,
            'users'              => $users,
        ]);
    }
}
