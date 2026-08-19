<?php

namespace App\Http\Controllers;

use App\Models\Module;
use App\Models\StudentProgress;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ModuleShowController extends Controller
{
    public function __invoke(Request $request, Team $currentTeam, Module $module): Response
    {
        abort_if(! $module->is_active, 404);

        $module->load(['contents', 'quiz.questions']);

        $user = $request->user();

        $myProgress = StudentProgress::where('user_id', $user->id)
            ->where('module_id', $module->id)
            ->first();

        $isCompleted = (bool) $myProgress;

        $contents = $module->contents->map(fn ($c) => [
            'id'      => $c->id,
            'type'    => $c->type,
            'content' => in_array($c->type, ['image', 'video'])
                ? $this->resolveStorageUrl($c->content)
                : $c->content,
            'caption' => $c->caption,
            'order'   => $c->order,
        ]);

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
                ]),
            ];
        }

        // For teachers: load all student exercise videos for this module
        $studentVideos = null;
        if ($user->role === 'teacher' || $user->role === 'admin') {
            $studentVideos = StudentProgress::where('module_id', $module->id)
                ->whereNotNull('exercise_video_path')
                ->with('user:id,name,student_id,section')
                ->get()
                ->map(fn ($p) => [
                    'student_id'  => $p->user->id,
                    'name'        => $p->user->name,
                    'student_no'  => $p->user->student_id,
                    'section'     => $p->user->section,
                    'video_url'   => $this->resolveStorageUrl($p->exercise_video_path),
                    'uploaded_at' => $p->exercise_video_uploaded_at?->toISOString(),
                ]);
        }

        // For the student: their own exercise video status
        $myExerciseVideo = null;
        if ($user->role === 'student' && $myProgress?->exercise_video_path) {
            $myExerciseVideo = [
                'video_url'   => $this->resolveStorageUrl($myProgress->exercise_video_path),
                'uploaded_at' => $myProgress->exercise_video_uploaded_at?->toISOString(),
            ];
        }

        return Inertia::render('modules/show', [
            'module' => [
                'id'                     => $module->id,
                'title'                  => $module->title,
                'course'                 => $module->course,
                'description'            => $module->description,
                'cover_url'              => $module->cover_url,
                'is_active'              => $module->is_active,
                'exercise_video_enabled' => $module->exercise_video_enabled,
            ],
            'contents'        => $contents,
            'quiz'            => $quiz,
            'isCompleted'     => $isCompleted,
            'userRole'        => $user->role,
            'studentVideos'   => $studentVideos,
            'myExerciseVideo' => $myExerciseVideo,
        ]);
    }

    /**
     * Resolve a stored content value to a root-relative public URL.
     */
    private function resolveStorageUrl(string $content): string
    {
        if (str_starts_with($content, 'http://') || str_starts_with($content, 'https://')) {
            $appUrl = rtrim(config('app.url'), '/');
            if (str_starts_with($content, $appUrl . '/storage/')) {
                return substr($content, strlen($appUrl));
            }
            return $content;
        }

        if (str_starts_with($content, '/storage/')) {
            return $content;
        }

        return Storage::url($content);
    }
}
