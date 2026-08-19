<?php

namespace App\Http\Controllers;

use App\Models\Module;
use App\Models\ModuleContent;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ModuleEditorController extends Controller
{
    /**
     * Show the module editor page.
     */
    public function show(Team $currentTeam, Module $module): Response
    {
        $module->load(['contents', 'quiz.questions']);

        return Inertia::render('modules/editor', [
            'module'   => [
                'id'                     => $module->id,
                'title'                  => $module->title,
                'course'                 => $module->course,
                'description'            => $module->description,
                'cover_url'              => $module->cover_url,
                'is_active'              => $module->is_active,
                'exercise_video_enabled' => $module->exercise_video_enabled,
                'exercise_video_label'   => $module->exercise_video_label,
            ],
            'contents' => $module->contents->map(fn ($c) => [
                'id'      => $c->id,
                'type'    => $c->type,
                'content' => in_array($c->type, ['image', 'video'])
                    ? $this->resolveStorageUrl($c->content)
                    : $c->content,
                'caption' => $c->caption,
                'order'   => $c->order,
            ]),            'quiz' => $module->quiz ? [
                'id'        => $module->quiz->id,
                'title'     => $module->quiz->title,
                'questions' => $module->quiz->questions->map(fn ($q) => [
                    'id'             => $q->id,
                    'question'       => $q->question,
                    'choice_a'       => $q->choice_a,
                    'choice_b'       => $q->choice_b,
                    'choice_c'       => $q->choice_c,
                    'choice_d'       => $q->choice_d,
                    'correct_answer' => $q->correct_answer,
                    'order'          => $q->order,
                ]),
            ] : null,
        ]);
    }

    /**
     * Upload a cover image.
     */
    public function uploadCover(Request $request, Team $currentTeam, Module $module): JsonResponse
    {
        $request->validate([
            'cover' => ['required', 'image', 'max:5120'],
        ]);

        if ($module->cover_path) {
            Storage::disk('public')->delete($module->cover_path);
        }

        $path = $request->file('cover')->store("modules/{$module->id}/cover", 'public');
        $module->update(['cover_path' => $path]);

        return response()->json(['url' => Storage::url($path)]);
    }

    /**
     * Add a text or title block.
     */
    public function addText(Request $request, Team $currentTeam, Module $module): JsonResponse
    {
        $request->validate([
            'content' => ['required', 'string'],
            'type'    => ['nullable', 'in:text,title'],
        ]);

        $order = $module->contents()->max('order') + 1;
        $block = ModuleContent::create([
            'module_id' => $module->id,
            'type'      => $request->input('type', 'text'),
            'content'   => $request->input('content'),
            'order'     => $order,
        ]);

        return response()->json(['id' => $block->id, 'order' => $block->order]);
    }

    /**
     * Upload an image block.
     */
    public function uploadImage(Request $request, Team $currentTeam, Module $module): JsonResponse
    {
        $request->validate([
            'image'   => ['required', 'image', 'max:10240'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $path  = $request->file('image')->store("modules/{$module->id}/images", 'public');
        $order = $module->contents()->max('order') + 1;

        $block = ModuleContent::create([
            'module_id' => $module->id,
            'type'      => 'image',
            'content'   => $path,
            'caption'   => $request->input('caption'),
            'order'     => $order,
        ]);

        return response()->json([
            'id'      => $block->id,
            'url'     => Storage::url($path),
            'caption' => $block->caption,
            'order'   => $block->order,
        ]);
    }

    /**
     * Upload a video file block (mp4, webm, etc).
     */
    public function uploadVideoFile(Request $request, Team $currentTeam, Module $module): JsonResponse
    {
        $request->validate([
            'video'   => ['required', 'file', 'mimetypes:video/mp4,video/webm,video/ogg,video/quicktime', 'max:102400'], // 100 MB
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $path  = $request->file('video')->store("modules/{$module->id}/videos", 'public');
        $order = $module->contents()->max('order') + 1;

        $block = ModuleContent::create([
            'module_id' => $module->id,
            'type'      => 'video',
            'content'   => $path,   // store raw storage path, resolve at render time
            'caption'   => $request->input('caption'),
            'order'     => $order,
        ]);

        return response()->json([
            'id'      => $block->id,
            'url'     => Storage::url($path),
            'caption' => $block->caption,
            'order'   => $block->order,
        ]);
    }

    /**
     * Add a video block (YouTube/Vimeo URL or uploaded file path).
     */
    public function addVideo(Request $request, Team $currentTeam, Module $module): JsonResponse
    {
        $request->validate([
            'url'     => ['required', 'string', 'max:2048'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $order = $module->contents()->max('order') + 1;

        $block = ModuleContent::create([
            'module_id' => $module->id,
            'type'      => 'video',
            'content'   => $request->input('url'),
            'caption'   => $request->input('caption'),
            'order'     => $order,
        ]);

        return response()->json([
            'id'      => $block->id,
            'url'     => $block->content,
            'caption' => $block->caption,
            'order'   => $block->order,
        ]);
    }

    /**
     * Update a text/video block content.
     */
    public function updateBlock(Request $request, Team $currentTeam, Module $module, ModuleContent $content): JsonResponse
    {
        $request->validate([
            'content' => ['nullable', 'string'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $content->update($request->only('content', 'caption'));

        return response()->json(['ok' => true]);
    }

    /**
     * Reorder blocks.
     */
    public function reorder(Request $request, Team $currentTeam, Module $module): JsonResponse
    {
        $request->validate([
            'order'   => ['required', 'array'],
            'order.*' => ['integer'],
        ]);

        foreach ($request->input('order') as $position => $blockId) {
            ModuleContent::where('id', $blockId)
                ->where('module_id', $module->id)
                ->update(['order' => $position]);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Delete a block.
     */
    public function deleteBlock(Team $currentTeam, Module $module, ModuleContent $content): JsonResponse
    {
        if (in_array($content->type, ['image', 'video']) && $content->content) {
            // content may be a raw path or a /storage/... relative URL — extract the path
            $path = $this->storagePathFromContent($content->content);
            if ($path) {
                Storage::disk('public')->delete($path);
            }
        }
        $content->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Save a custom label for the exercise video upload section.
     */
    public function saveExerciseVideoLabel(Request $request, Team $currentTeam, Module $module): JsonResponse
    {
        $request->validate([
            'label' => ['nullable', 'string', 'max:80'],
        ]);

        $module->update([
            'exercise_video_label' => $request->input('label') ?: null,
        ]);

        return response()->json([
            'exercise_video_label' => $module->exercise_video_label,
        ]);
    }

    /**
     * Toggle the exercise video upload feature on/off for this module.
     */
    public function toggleExerciseVideo(Team $currentTeam, Module $module): JsonResponse
    {
        $module->update([
            'exercise_video_enabled' => ! $module->exercise_video_enabled,
        ]);

        return response()->json([
            'exercise_video_enabled' => $module->exercise_video_enabled,
        ]);
    }

    /**
     * Update module title/description.
     */
    public function updateMeta(Request $request, Team $currentTeam, Module $module): RedirectResponse
    {
        $request->validate([
            'title'       => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $module->update($request->only('title', 'description'));

        return back()->with('success', 'Module updated.');
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
            // Old uploaded videos stored with full APP_URL — strip the host
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

        // Raw storage path — convert to root-relative URL
        return Storage::url($content);
    }

    /**
     * Extract a raw storage path from a content value for deletion.
     * Returns null for external URLs that have no local file.
     */
    private function storagePathFromContent(string $content): ?string
    {
        // External URL that is NOT our own storage
        if ((str_starts_with($content, 'http://') || str_starts_with($content, 'https://'))
            && ! str_contains($content, '/storage/modules/')) {
            return null;
        }

        // Strip any host prefix
        if (str_starts_with($content, 'http://') || str_starts_with($content, 'https://')) {
            $content = parse_url($content, PHP_URL_PATH);
        }

        // Strip leading /storage/
        if (str_starts_with($content, '/storage/')) {
            return substr($content, 9); // raw path for Storage::disk('public')->delete()
        }

        // Already a raw path
        return $content;
    }
}
