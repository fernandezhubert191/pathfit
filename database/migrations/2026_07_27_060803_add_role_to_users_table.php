<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // 'admin' | 'teacher' | 'student'
            $table->string('role')->default('student')->after('email');
            // For students
            $table->string('student_id')->nullable()->unique()->after('role');
            // For teachers
            $table->string('employee_id')->nullable()->unique()->after('student_id');
            $table->string('subject')->nullable()->after('employee_id');
            // Approval flag for teachers
            $table->boolean('is_approved')->default(false)->after('subject');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'student_id', 'employee_id', 'subject', 'is_approved']);
        });
    }
};
