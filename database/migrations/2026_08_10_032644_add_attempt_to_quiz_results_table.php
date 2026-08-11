<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quiz_results', function (Blueprint $table) {
            // MySQL won't drop a unique index that covers FK columns while
            // the foreign key constraints reference it. Drop FKs first.
            $table->dropForeign(['user_id']);
            $table->dropForeign(['module_id']);

            // Drop the old best-score-only unique constraint
            $table->dropUnique(['user_id', 'module_id']);

            // Attempt number per student per module (1, 2, 3 …)
            $table->unsignedSmallInteger('attempt')->default(1)->after('module_title');

            // Re-add foreign keys (plain indexes, no unique requirement)
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('module_id')->references('id')->on('modules')->cascadeOnDelete();

            // One row per attempt
            $table->unique(['user_id', 'module_id', 'attempt']);
        });
    }

    public function down(): void
    {
        Schema::table('quiz_results', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropForeign(['module_id']);
            $table->dropUnique(['user_id', 'module_id', 'attempt']);
            $table->dropColumn('attempt');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('module_id')->references('id')->on('modules')->cascadeOnDelete();
            $table->unique(['user_id', 'module_id']);
        });
    }
};
