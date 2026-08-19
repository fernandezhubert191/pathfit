<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QuizResult;
use App\Models\StudentProgress;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class MobileAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'role'       => ['required', 'in:student,teacher'],
            'password'   => ['required', 'string'],
            'identifier' => ['required', 'string'],
        ]);

        $role       = $request->input('role');
        $identifier = $request->input('identifier');

        $user = match ($role) {
            'student' => User::where('student_id', strtoupper($identifier))->where('role', 'student')->first(),
            'teacher' => User::where('email', strtolower($identifier))->where('role', 'teacher')->first(),
        };

        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'identifier' => ['The credentials you entered are incorrect.'],
            ]);
        }

        if ($role === 'teacher' && ! $user->is_approved) {
            return response()->json([
                'message' => 'Your account is pending approval by the administrator.',
            ], 403);
        }

        $user->tokens()->delete();
        $token = $user->createToken('mobile-' . $role)->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'          => $user->id,
                'name'        => $user->name,
                'email'       => $user->email,
                'role'        => $user->role,
                'student_id'  => $user->student_id,
                'section'     => $user->section,
                'employee_id' => $user->employee_id,
            ],
        ]);
    }

    public function registerStudent(Request $request): JsonResponse
    {
        $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'student_id' => ['required', 'string', 'max:50', 'unique:users,student_id'],
            'email'      => ['required', 'email', 'unique:users,email'],
            'section'    => ['required', 'in:A,B,C,D'],
            'password'   => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $user = User::create([
            'name'              => $request->input('name'),
            'email'             => strtolower($request->input('email')),
            'student_id'        => strtoupper($request->input('student_id')),
            'section'           => strtoupper($request->input('section')),
            'password'          => Hash::make($request->input('password')),
            'role'              => 'student',
            'is_approved'       => true,
            'email_verified_at' => now(),
        ]);

        $token = $user->createToken('mobile-student')->plainTextToken;

        return response()->json([
            'message' => 'Account created successfully.',
            'token'   => $token,
            'user'    => [
                'id'         => $user->id,
                'name'       => $user->name,
                'email'      => $user->email,
                'role'       => $user->role,
                'student_id' => $user->student_id,
                'section'    => $user->section,
            ],
        ], 201);
    }

    public function registerTeacher(Request $request): JsonResponse
    {
        $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'employee_id' => ['required', 'string', 'max:50', 'unique:users,employee_id'],
            'email'       => ['required', 'email', 'unique:users,email'],
            'password'    => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        User::create([
            'name'              => $request->input('name'),
            'email'             => strtolower($request->input('email')),
            'employee_id'       => strtoupper($request->input('employee_id')),
            'password'          => Hash::make($request->input('password')),
            'role'              => 'teacher',
            'is_approved'       => false,
            'email_verified_at' => now(),
        ]);

        return response()->json([
            'message' => 'Account created. Waiting for admin approval before you can sign in.',
        ], 201);
    }

    /**
     * Student uploads an exercise video for a module they have completed.
     * POST /api/mobile/modules/{moduleId}/exercise/upload
     */
    public function uploadExerciseVideo(Request $request, int $moduleId): JsonResponse
    {
        $request->validate([
            'video' => ['required', 'file', 'mimetypes:video/mp4,video/webm,video/ogg,video/quicktime,video/3gpp,video/3gpp2,video/x-msvideo,video/mpeg', 'max:204800'], // 200 MB
        ]);

        $user = $request->user();

        $module = \App\Models\Module::where('id', $moduleId)->where('is_active', true)->firstOrFail();

        abort_unless($module->exercise_video_enabled, 403, 'Exercise video upload is not enabled for this module.');

        // Find or create a progress record — the video can be uploaded before quiz completion
        $progress = StudentProgress::firstOrCreate([
            'user_id'   => $user->id,
            'module_id' => $moduleId,
        ]);

        // Delete old file if exists
        if ($progress->exercise_video_path) {
            Storage::disk('public')->delete($progress->exercise_video_path);
        }

        $file      = $request->file('video');
        $extension = $file->getClientOriginalExtension() ?: 'mp4';
        $filename  = time() . '_' . $user->id . '.' . $extension;
        $directory = "exercise-videos/{$moduleId}/{$user->id}";
        $storagePath = $directory . '/' . $filename;

        // storeAs() → getRealPath() returns false on Windows when Apache/fcgid
        // runs as a different user than the one that owns C:\Windows\Temp.
        // Read the upload into memory and write it directly via Storage::put().
        $contents = file_get_contents($file->getPathname() ?: $file->getRealPath() ?: $file->path());
        if ($contents === false) {
            return response()->json(['message' => 'Could not read the uploaded file.'], 500);
        }

        $stored = Storage::disk('public')->put($storagePath, $contents);
        unset($contents); // free memory

        if (! $stored) {
            return response()->json(['message' => 'Failed to save the video file. Please try again.'], 500);
        }

        $path = $storagePath;

        $progress->update([
            'exercise_video_path'        => $path,
            'exercise_video_uploaded_at' => now(),
        ]);

        return response()->json([
            'message'     => 'Exercise video uploaded successfully.',
            'video_url'   => $this->resolveMediaUrl(Storage::url($path), $request),
            'uploaded_at' => $progress->exercise_video_uploaded_at->toISOString(),
        ]);
    }

    /**
     * Student deletes their own exercise video for a module.
     * DELETE /api/mobile/modules/{moduleId}/exercise/video
     */
    public function deleteExerciseVideo(Request $request, int $moduleId): JsonResponse
    {
        $user = $request->user();

        $progress = StudentProgress::where('user_id', $user->id)
            ->where('module_id', $moduleId)
            ->first();

        abort_unless($progress && $progress->exercise_video_path, 404, 'No exercise video found.');

        Storage::disk('public')->delete($progress->exercise_video_path);
        $progress->update([
            'exercise_video_path'        => null,
            'exercise_video_uploaded_at' => null,
        ]);

        return response()->json(['message' => 'Exercise video removed.']);
    }

    /**
     * Return the student's own exercise video status for a module.
     * GET /api/mobile/modules/{moduleId}/exercise/video
     */
    public function myExerciseVideo(Request $request, int $moduleId): JsonResponse
    {
        $user = $request->user();

        $progress = StudentProgress::where('user_id', $user->id)
            ->where('module_id', $moduleId)
            ->first();

        if (! $progress || ! $progress->exercise_video_path) {
            return response()->json(['video' => null]);
        }

        return response()->json([
            'video' => [
                'url'         => $this->resolveMediaUrl(Storage::url($progress->exercise_video_path), $request),
                'uploaded_at' => $progress->exercise_video_uploaded_at?->toISOString(),
            ],
        ]);
    }

    /**
     * Return a specific student's progress and quiz results — for teacher view.
     */
    public function studentProgress(Request $request, User $student): JsonResponse
    {
        abort_if($student->role !== 'student', 404);

        $progressRows = StudentProgress::where('user_id', $student->id)->get();

        $completedModuleIds = $progressRows->pluck('module_id')->values();

        // Build a map of moduleId → exercise video info
        $exerciseVideos = $progressRows
            ->filter(fn ($p) => $p->exercise_video_path)
            ->mapWithKeys(fn ($p) => [
                $p->module_id => [
                    'url'         => $this->resolveMediaUrl(Storage::url($p->exercise_video_path), $request),
                    'uploaded_at' => $p->exercise_video_uploaded_at?->toISOString(),
                ],
            ]);

        $quizResults = QuizResult::where('user_id', $student->id)
            ->with('module:id,course,created_at')
            ->get()
            ->sortBy(fn ($r) => [$r->module?->created_at, $r->attempt])
            ->values()
            ->map(fn ($r) => [
                'moduleId'    => $r->module_id,
                'moduleTitle' => $r->module_title,
                'course'      => $r->module?->course ?? 'pathfit1',
                'attempt'     => $r->attempt,
                'score'       => $r->score,
                'total'       => $r->total,
                'percent'     => $r->percent,
                'takenAt'     => $r->updated_at->toISOString(),
            ]);

        $modules = \App\Models\Module::where('is_active', true)
            ->orderBy('created_at')
            ->get()
            ->map(fn ($m) => [
                'id'             => $m->id,
                'title'          => $m->title,
                'course'         => $m->course,
                'completed'      => $completedModuleIds->contains($m->id),
                'exercise_video' => $exerciseVideos->get($m->id),
            ]);

        return response()->json([
            'student' => [
                'id'         => $student->id,
                'name'       => $student->name,
                'student_id' => $student->student_id,
                'section'    => $student->section,
                'email'      => $student->email,
            ],
            'completed_module_ids' => $completedModuleIds,
            'quiz_results'         => $quizResults,
            'modules'              => $modules,
        ]);
    }

    /**
     * Return students grouped by section for the teacher dashboard.
     */
    public function studentsBySection(Request $request): JsonResponse
    {
        $section = strtoupper($request->query('section', ''));
        $query   = User::where('role', 'student')->orderBy('name');

        if (in_array($section, ['A', 'B', 'C', 'D'])) {
            $query->where('section', $section);
        }

        $students = $query->get()->map(fn ($u) => [
            'id'         => $u->id,
            'name'       => $u->name,
            'email'      => $u->email,
            'student_id' => $u->student_id,
            'section'    => $u->section,
        ]);

        return response()->json(['students' => $students]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function modules(): JsonResponse
    {
        $modules = \App\Models\Module::where('is_active', true)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(fn ($m) => [
                'id'          => $m->id,
                'title'       => $m->title,
                'course'      => $m->course,
                'description' => $m->description,
                'cover_url'   => $m->cover_url,
            ]);

        return response()->json(['modules' => $modules]);
    }

    /**
     * Return full module content + quiz questions (no correct answers exposed).
     */
    public function moduleDetail(Request $request, int $moduleId): JsonResponse
    {
        $module = \App\Models\Module::where('id', $moduleId)
            ->where('is_active', true)
            ->with(['contents', 'quiz.questions'])
            ->firstOrFail();

        $contents = $module->contents->map(function ($c) use ($request) {
            $item = [
                'id'      => $c->id,
                'type'    => $c->type,
                'content' => in_array($c->type, ['image', 'video'])
                    ? $this->resolveMediaUrl($c->content, $request)
                    : $c->content,
                'caption' => $c->caption,
                'order'   => $c->order,
            ];

            // For video content, also expose a dedicated streaming URL that
            // supports HTTP range requests (seek/resume/buffer on mobile).
            // The mobile app should prefer this over the raw storage URL.
            if ($c->type === 'video' && $c->content) {
                $storagePath = $this->resolveStoragePath($c->content);
                if ($storagePath) {
                    $item['stream_url'] = $this->buildStreamUrl($storagePath, $request);
                }
            }

            return $item;
        });

        $quiz = null;
        if ($module->quiz) {
            $quiz = [
                'id'        => $module->quiz->id,
                'title'     => $module->quiz->title,
                'questions' => $module->quiz->questions->map(fn ($q) => [
                    'id'       => $q->id,
                    'question' => $q->question,
                    'choices'  => [
                        'a' => $q->choice_a,
                        'b' => $q->choice_b,
                        'c' => $q->choice_c,
                        'd' => $q->choice_d,
                    ],
                    // correct_answer intentionally omitted — checked server-side
                ]),
            ];
        }

        return response()->json([
            'module'   => [
                'id'                     => $module->id,
                'title'                  => $module->title,
                'course'                 => $module->course,
                'description'            => $module->description,
                'cover_url'              => $module->cover_url,
                'exercise_video_enabled' => $module->exercise_video_enabled,
                'exercise_video_label'   => $module->exercise_video_label,
            ],
            'contents'          => $contents,
            'quiz'              => $quiz,
            'has_exercise_video' => $module->exercise_video_enabled
                ? \App\Models\StudentProgress::where('user_id', $request->user()->id)
                    ->where('module_id', $moduleId)
                    ->whereNotNull('exercise_video_path')
                    ->exists()
                : null,
        ]);
    }

    /**
     * Return correct answers for offline grading.
     * Still requires auth — answers are cached on-device only.
     */
    public function quizAnswers(Request $request, int $moduleId): JsonResponse
    {
        $module = \App\Models\Module::where('id', $moduleId)
            ->where('is_active', true)
            ->with('quiz.questions')
            ->firstOrFail();

        abort_unless($module->quiz, 404, 'This module has no quiz.');

        $answers = $module->quiz->questions
            ->pluck('correct_answer', 'id');

        return response()->json(['answers' => $answers]);
    }

    /**
     * Submit quiz answers and return score.
     * Expects: { answers: { [questionId]: 'a'|'b'|'c'|'d' } }
     */
    public function submitQuiz(Request $request, int $moduleId): JsonResponse
    {
        $request->validate([
            'answers'   => ['required', 'array'],
            'answers.*' => ['required', 'in:a,b,c,d'],
        ]);

        $module = \App\Models\Module::where('id', $moduleId)
            ->where('is_active', true)
            ->with('quiz.questions')
            ->firstOrFail();

        abort_unless($module->quiz, 404, 'This module has no quiz.');

        // If exercise video upload is required, the student must have uploaded
        // their video before they are allowed to take the quiz.
        if ($module->exercise_video_enabled) {
            $hasVideo = \App\Models\StudentProgress::where('user_id', $request->user()->id)
                ->where('module_id', $moduleId)
                ->whereNotNull('exercise_video_path')
                ->exists();

            abort_unless($hasVideo, 403, 'You must upload your exercise video before taking the quiz.');
        }

        $questions = $module->quiz->questions;
        $answers   = $request->input('answers');
        $correct   = 0;

        $results = $questions->map(function ($q) use ($answers, &$correct) {
            $given     = $answers[$q->id] ?? null;
            $isCorrect = $given === $q->correct_answer;
            if ($isCorrect) $correct++;

            return [
                'id'             => $q->id,
                'correct'        => $isCorrect,
                'correct_answer' => $q->correct_answer,
                'your_answer'    => $given,
            ];
        });

        $total   = $questions->count();
        $percent = $total > 0 ? round(($correct / $total) * 100) : 0;
        $user    = $request->user();

        // Determine the next attempt number for this student + module
        $nextAttempt = QuizResult::where('user_id', $user->id)
            ->where('module_id', $moduleId)
            ->max('attempt') + 1;

        // Always record every attempt so the history is fully visible
        QuizResult::create([
            'user_id'      => $user->id,
            'module_id'    => $moduleId,
            'module_title' => $module->title,
            'attempt'      => $nextAttempt,
            'score'        => $correct,
            'total'        => $total,
            'percent'      => $percent,
        ]);

        // Mark module completed if this attempt OR any previous attempt scored ≥ 75%
        $everPassed = $percent >= 75 || QuizResult::where('user_id', $user->id)
            ->where('module_id', $moduleId)
            ->where('percent', '>=', 75)
            ->exists();

        if ($everPassed) {
            StudentProgress::firstOrCreate([
                'user_id'   => $user->id,
                'module_id' => $moduleId,
            ]);
        }

        return response()->json([
            'score'   => $correct,
            'total'   => $total,
            'percent' => $percent,
            'results' => $results,
        ]);
    }

    /**
     * Return the authenticated student's own progress and quiz results.
     */
    public function myProgress(Request $request): JsonResponse
    {
        $user = $request->user();

        // A module is only "completed" when the student has passed the quiz (≥ 75%).
        // Uploading an exercise video creates a StudentProgress row but must NOT
        // count as a completed lesson on its own.
        $completedModuleIds = QuizResult::where('user_id', $user->id)
            ->where('percent', '>=', 75)
            ->distinct()
            ->pluck('module_id')
            ->values();

        $quizResults = QuizResult::where('user_id', $user->id)
            ->with('module:id,course,created_at')
            ->get()
            ->sortBy(fn ($r) => [$r->module?->created_at, $r->attempt])
            ->values()
            ->map(fn ($r) => [
                'moduleId'    => $r->module_id,
                'moduleTitle' => $r->module_title,
                'course'      => $r->module?->course ?? 'pathfit1',
                'attempt'     => $r->attempt,
                'score'       => $r->score,
                'total'       => $r->total,
                'percent'     => $r->percent,
                'takenAt'     => $r->updated_at->toISOString(),
            ]);

        return response()->json([
            'completed_module_ids' => $completedModuleIds,
            'quiz_results'         => $quizResults,
        ]);
    }

    /**
     * Serve a minimal HTML5 video player page.
     * The WebView on mobile loads this URL directly so the <video> tag is
     * same-origin with the storage file — bypassing Android's cross-origin block.
     *
     * Usage: GET /api/mobile/video-player?src=/storage/modules/1/videos/foo.mp4
     */
    public function videoPlayer(Request $request): \Illuminate\Http\Response
    {
        $src = $request->query('src', '');

        // Only allow relative /storage/... paths or absolute URLs to this app
        // to prevent this endpoint being used as an open redirect proxy.
        $appUrl = rtrim(config('app.url'), '/');
        $isSafe = str_starts_with($src, '/storage/')
            || str_starts_with($src, $appUrl . '/storage/');

        if (! $isSafe) {
            abort(400, 'Invalid video source.');
        }

        $html = <<<HTML
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
          <style>
            *{margin:0;padding:0;box-sizing:border-box;}
            html,body{width:100%;height:100%;background:#000;overflow:hidden;}
            video{display:block;width:100%;height:100%;object-fit:contain;}
          </style>
        </head>
        <body>
          <video src="{$src}" controls playsinline preload="metadata" autoplay></video>
        </body>
        </html>
        HTML;

        return response($html, 200, ['Content-Type' => 'text/html']);
    }

    /**
     * Resolve a stored media path to a fully-qualified absolute URL.
     * Uses the incoming request's host so the URL is correct on any network
     * (phone on LAN, emulator, etc.) regardless of APP_URL in .env.
     *
     * Handles two formats that may exist in the DB:
     *  - "modules/1/images/foo.jpg"          → raw storage path
     *  - "/storage/modules/1/images/foo.jpg" → already has /storage prefix
     *  - "http://..." or "https://..."       → already absolute, return as-is
     */
    private function resolveMediaUrl(string $path, Request $request): string
    {
        // Already a full URL — return as-is
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        // Build base from the request so LAN / tunnel / emulator all work correctly
        $base = $request->getScheme() . '://' . $request->getHost();
        $port = $request->getPort();
        if ($port && ! in_array($port, [80, 443])) {
            $base .= ':' . $port;
        }

        // Already has /storage prefix
        if (str_starts_with($path, '/storage/')) {
            return $base . $path;
        }

        // Raw relative path — resolve via Storage then prepend base
        $storagePath = \Illuminate\Support\Facades\Storage::url($path);
        return $base . $storagePath;
    }

    /**
     * Extract the storage-disk-relative path from whatever format is stored
     * in the DB (raw path, /storage/... prefixed, or full URL).
     * Returns null if the path cannot be resolved to a local storage path.
     */
    private function resolveStoragePath(string $path): ?string
    {
        // Full URL from this app — strip the origin and /storage/ prefix
        $appUrl = rtrim(config('app.url'), '/');
        if (str_starts_with($path, $appUrl . '/storage/')) {
            return substr($path, strlen($appUrl . '/storage/'));
        }

        // /storage/... prefixed — strip the prefix
        if (str_starts_with($path, '/storage/')) {
            return substr($path, strlen('/storage/'));
        }

        // Already a relative path like "modules/1/videos/foo.mp4"
        if (! str_starts_with($path, 'http://') && ! str_starts_with($path, 'https://')) {
            return $path;
        }

        // External URL — cannot stream via our endpoint
        return null;
    }

    /**
     * Build the absolute stream URL for a storage-relative path.
     */
    private function buildStreamUrl(string $storagePath, Request $request): string
    {
        $base = $request->getScheme() . '://' . $request->getHost();
        $port = $request->getPort();
        if ($port && ! in_array($port, [80, 443])) {
            $base .= ':' . $port;
        }

        return $base . '/api/mobile/video/stream?path=' . urlencode($storagePath);
    }
}
