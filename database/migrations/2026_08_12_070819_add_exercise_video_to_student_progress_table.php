<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_progress', function (Blueprint $table) {
            $table->string('exercise_video_path')->nullable()->after('module_id');
            $table->timestamp('exercise_video_uploaded_at')->nullable()->after('exercise_video_path');
        });
    }

    public function down(): void
    {
        Schema::table('student_progress', function (Blueprint $table) {
            $table->dropColumn(['exercise_video_path', 'exercise_video_uploaded_at']);
        });
    }
};
