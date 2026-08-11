<?php

namespace App\Observers;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class UserObserver
{
    /**
     * Clean up all user-related records before the user row is deleted.
     *
     * student_progress and quiz_results already have cascadeOnDelete on their
     * foreign keys, so the DB handles those. We handle the relationships that
     * don't have a cascade constraint at the DB level:
     *  - Sanctum personal access tokens (morph, no FK cascade)
     *  - Sessions (nullable FK, no cascade)
     *  - Password reset tokens (keyed by email, no FK)
     */
    public function deleting(User $user): void
    {
        // Revoke all API tokens (Sanctum)
        $user->tokens()->delete();

        // Remove web sessions
        DB::table('sessions')->where('user_id', $user->id)->delete();

        // Remove password reset tokens
        DB::table('password_reset_tokens')->where('email', $user->email)->delete();
    }
}
