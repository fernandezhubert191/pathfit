<?php

namespace App\Http\Controllers;

use App\Models\Module;
use App\Models\StudentProgress;
use App\Models\Team;
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

        $isCompleted = StudentProgress::where('user_id', $user->id)
            ->where('module_id', $module->id)
            ->exists();

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

        return Inertia::render('modules/show', [
            'module' => [
                'id'          => $module->id,
                'title'       => $module->title,
                'course'      => $module->course,
                'description' => $module->description,
                'cover_url'   => $module->cover_url,
                'is_active'   => $module->is_active,
            ],
            'contents'    => $contents,
            'quiz'        => $quiz,
            'isCompleted' => $isCompleted,
            'userRole'    => $user->role,
        ]);
    }

    /**
     * Resolve a stored content value to a root-relative public URL.
     *
     * Handles three formats stored in the DB:
     *   - "modules/2/videos/foo.mp4"           → raw storage path  → /storage/modules/2/...
     *   - "/storage/modules/2/videos/foo.mp4"  → already relative  → returned as-is
     *   - "http://localhost:8000/storage/..."   → absolute (old)    → strip host → /storage/...
     *   - "https://youtu.be/..."               → external URL       → returned as-is
     */
    private function resolveStorageUrl(string $content): string
    {
        // External URLs (YouTube, Vimeo, https CDN etc.) — return as-is
        if (str_starts_with($content, 'http://') || str_starts_with($content, 'https://')) {
            // Old uploaded videos stored with full APP_URL — strip the host so the URL
            // is root-relative and works regardless of which host/port serves the app.
            $appUrl = rtrim(config('app.url'), '/');
            if (str_starts_with($content, $appUrl . '/storage/')) {
                return substr($content, strlen($appUrl));
            }
            return $content;
        }

        // Already has /storage/ prefix
        if (str_starts_with($content, '/storage/')) {
            return $content;
        }

        // Raw storage path — convert to root-relative /storage/... URL
        return Storage::url($content);
    }
}
