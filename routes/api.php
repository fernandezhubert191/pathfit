<?php

use App\Http\Controllers\Api\MobileAuthController;
use App\Http\Controllers\Api\VideoStreamController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Mobile App API Routes
|--------------------------------------------------------------------------
|
| These routes handle authentication for the mobile student/teacher app.
| They use Laravel Sanctum token-based auth (no sessions/cookies).
|
*/

Route::prefix('mobile')->group(function () {

    // Public — login & register
    Route::post('login', [MobileAuthController::class, 'login']);
    Route::post('register/student', [MobileAuthController::class, 'registerStudent']);
    Route::post('register/teacher', [MobileAuthController::class, 'registerTeacher']);

    // Protected — requires valid Sanctum token
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('me',       [MobileAuthController::class, 'me']);
        Route::post('logout',  [MobileAuthController::class, 'logout']);
        Route::get('students',                        [MobileAuthController::class, 'studentsBySection']);
        Route::get('students/{student}/progress',     [MobileAuthController::class, 'studentProgress']);
        Route::get('modules',  [MobileAuthController::class, 'modules']);
        Route::get('modules/{moduleId}',              [MobileAuthController::class, 'moduleDetail']);
        Route::get('modules/{moduleId}/quiz/answers', [MobileAuthController::class, 'quizAnswers']);
        Route::post('modules/{moduleId}/quiz/submit', [MobileAuthController::class, 'submitQuiz']);
        Route::get('my-progress',                     [MobileAuthController::class, 'myProgress']);

        // Exercise video upload (student uploads after completing a module)
        Route::post  ('modules/{moduleId}/exercise/upload', [MobileAuthController::class, 'uploadExerciseVideo']);
        Route::delete('modules/{moduleId}/exercise/video',  [MobileAuthController::class, 'deleteExerciseVideo']);
        Route::get   ('modules/{moduleId}/exercise/video',  [MobileAuthController::class, 'myExerciseVideo']);

        // Video streaming — authenticated so files are protected.
        // Supports HTTP range requests (seek / resume / buffer on mobile).
        Route::prefix('video')->group(function () {
            Route::get('info',   [VideoStreamController::class, 'info']);
        });
    });

    // Video stream — accepts auth via Bearer header OR ?token= query param.
    // The query-param form lets a <video> tag inside WebView stream directly
    // (WebView <video> cannot set custom headers).
    Route::get('video/stream', [VideoStreamController::class, 'stream']);

    // Video player page — public so WebView can load it without auth headers.
    // The video URL itself is passed as a query param; the page is a thin
    // HTML5 wrapper so Android WebView streams from the same origin.
    Route::get('video-player', [MobileAuthController::class, 'videoPlayer']);

});
