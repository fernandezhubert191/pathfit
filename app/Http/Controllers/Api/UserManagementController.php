<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    /**
     * Update editable profile fields for a student or teacher.
     */
    public function update(Team $currentTeam, User $user, Request $request): RedirectResponse
    {
        abort_if($user->role === 'admin', 403, 'Cannot edit an admin account.');

        $rules = [
            'name' => ['required', 'string', 'max:255'],
        ];

        if ($user->role === 'student') {
            $rules['student_id'] = ['nullable', 'string', 'max:50', Rule::unique('users', 'student_id')->ignore($user->id)];
            $rules['section']    = ['nullable', 'string', 'in:A,B,C,D'];
        }

        if ($user->role === 'teacher') {
            $rules['employee_id'] = ['nullable', 'string', 'max:50', Rule::unique('users', 'employee_id')->ignore($user->id)];
            $rules['subject']     = ['nullable', 'string', 'max:255'];
        }

        $validated = $request->validate($rules);

        $user->update($validated);

        return back()->with('success', "{$user->name} has been updated.");
    }

    /**
     * Approve a teacher account so they can log in via the mobile app.
     * Note: $currentTeam is required because the route prefix is {current_team}.
     */
    public function approve(Team $currentTeam, User $user): RedirectResponse
    {
        abort_if($user->role !== 'teacher', 403, 'Only teacher accounts can be approved.');

        User::where('id', $user->id)->update(['is_approved' => 1]);

        return back()->with('success', "{$user->name} has been approved and can now log in.");
    }

    /**
     * Revoke a teacher account — sets is_approved back to false and deletes
     * any active API tokens so they are immediately signed out of the mobile app.
     */
    public function revoke(Team $currentTeam, User $user): RedirectResponse
    {
        abort_if($user->role !== 'teacher', 403, 'Only teacher accounts can be revoked.');

        $user->tokens()->delete();
        User::where('id', $user->id)->update(['is_approved' => 0]);

        return back()->with('success', "{$user->name} has been deactivated and signed out.");
    }

    /**
     * Delete a student or teacher account.
     */
    public function destroy(Team $currentTeam, User $user): RedirectResponse
    {
        abort_if($user->role === 'admin', 403, 'Cannot delete an admin account.');

        $name = $user->name;
        $user->tokens()->delete();
        $user->delete();

        return back()->with('success', "{$name} has been removed.");
    }
}
