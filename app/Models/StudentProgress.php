<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int         $id
 * @property int         $user_id
 * @property int         $module_id
 * @property string|null $exercise_video_path
 * @property Carbon|null $exercise_video_uploaded_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['user_id', 'module_id', 'exercise_video_path', 'exercise_video_uploaded_at'])]
class StudentProgress extends Model
{
    protected function casts(): array
    {
        return [
            'exercise_video_uploaded_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }

    public function getExerciseVideoUrlAttribute(): ?string
    {
        return $this->exercise_video_path
            ? Storage::url($this->exercise_video_path)
            : null;
    }
}
