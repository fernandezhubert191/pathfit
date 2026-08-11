<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ModuleController;
use App\Http\Controllers\ModuleEditorController;
use App\Http\Controllers\ModuleShowController;
use App\Http\Controllers\QuizController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Teams\TeamInvitationController;
use App\Http\Middleware\EnsureTeamMembership;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

// Block web registration
Route::get('/register', fn () => abort(404))->name('register.disabled');

Route::prefix('{current_team}')
    ->middleware(['auth', 'verified', EnsureTeamMembership::class])
    ->group(function () {
        Route::get('dashboard', DashboardController::class)->name('dashboard');
        Route::get('overview',  \App\Http\Controllers\OverviewController::class)->name('overview');

        // User management
        Route::patch('users/{user}',         [UserManagementController::class, 'update'])->name('users.update');
        Route::patch('users/{user}/approve', [UserManagementController::class, 'approve'])->name('users.approve');
        Route::patch('users/{user}/revoke',  [UserManagementController::class, 'revoke'])->name('users.revoke');
        Route::delete('users/{user}',        [UserManagementController::class, 'destroy'])->name('users.destroy');

        // Modules list
        Route::get('modules',             [ModuleController::class, 'index'])->name('modules.index');
        Route::post('modules',            [ModuleController::class, 'store'])->name('modules.store');
        Route::patch('modules/{module}',  [ModuleController::class, 'update'])->name('modules.update');
        Route::delete('modules/{module}', [ModuleController::class, 'destroy'])->name('modules.destroy');

        // Module lesson viewer (teacher & student)
        Route::get('modules/{module}', ModuleShowController::class)->name('modules.show');

        // Module editor
        Route::get('modules/{module}/edit',              [ModuleEditorController::class, 'show'])->name('modules.editor');
        Route::post('modules/{module}/meta',             [ModuleEditorController::class, 'updateMeta'])->name('modules.meta');
        Route::post('modules/{module}/cover',            [ModuleEditorController::class, 'uploadCover'])->name('modules.cover');
        Route::post('modules/{module}/blocks/text',      [ModuleEditorController::class, 'addText'])->name('modules.blocks.text');
        Route::post('modules/{module}/blocks/image',     [ModuleEditorController::class, 'uploadImage'])->name('modules.blocks.image');
        Route::post('modules/{module}/blocks/upload-video', [ModuleEditorController::class, 'uploadVideoFile'])->name('modules.blocks.upload-video');
        Route::post('modules/{module}/blocks/video',     [ModuleEditorController::class, 'addVideo'])->name('modules.blocks.video');
        Route::patch('modules/{module}/blocks/{content}',[ModuleEditorController::class, 'updateBlock'])->name('modules.blocks.update');
        Route::post('modules/{module}/blocks/reorder',   [ModuleEditorController::class, 'reorder'])->name('modules.blocks.reorder');
        Route::delete('modules/{module}/blocks/{content}',[ModuleEditorController::class, 'deleteBlock'])->name('modules.blocks.delete');

        // Quiz
        Route::get   ('modules/{module}/quiz',                          [QuizController::class, 'show'])->name('quiz.show');
        Route::post  ('modules/{module}/quiz',                          [QuizController::class, 'store'])->name('quiz.store');
        Route::patch ('modules/{module}/quiz/{quiz}',                   [QuizController::class, 'update'])->name('quiz.update');
        Route::delete('modules/{module}/quiz/{quiz}',                   [QuizController::class, 'destroy'])->name('quiz.destroy');
        Route::post  ('modules/{module}/quiz/{quiz}/questions',         [QuizController::class, 'addQuestion'])->name('quiz.questions.store');
        Route::patch ('modules/{module}/quiz/{quiz}/questions/{question}', [QuizController::class, 'updateQuestion'])->name('quiz.questions.update');
        Route::delete('modules/{module}/quiz/{quiz}/questions/{question}', [QuizController::class, 'deleteQuestion'])->name('quiz.questions.delete');
    });

Route::middleware(['auth'])->group(function () {
    Route::get('invitations/{invitation}/accept', [TeamInvitationController::class, 'accept'])->name('invitations.accept');
    Route::delete('invitations/{invitation}', [TeamInvitationController::class, 'decline'])->name('invitations.decline');
});

require __DIR__.'/settings.php';
