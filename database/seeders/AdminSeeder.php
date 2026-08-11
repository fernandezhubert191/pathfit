<?php

namespace Database\Seeders;

use App\Actions\Teams\CreateTeam;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::updateOrCreate(
            ['email' => 'admin@school.edu'],
            [
                'name' => 'Administrator',
                'password' => Hash::make('Admin@1234'),
                'email_verified_at' => now(),
                'role' => 'admin',
                'is_approved' => true,
            ]
        );

        // Create a personal team for admin if they don't have one
        if (! $admin->currentTeam && $admin->teams()->count() === 0) {
            app(CreateTeam::class)->handle($admin, 'Admin', isPersonal: true);
            $admin->refresh();
        } elseif (! $admin->current_team_id && $admin->teams()->count() > 0) {
            $admin->switchTeam($admin->teams()->first());
        }

        $this->command->info('Admin account ready.');
        $this->command->line('  Email    : admin@school.edu');
        $this->command->line('  Password : Admin@1234');
        $this->command->line('  Team     : '.($admin->currentTeam?->slug ?? 'none'));
    }
}
