<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int         $id
 * @property string      $title
 * @property string      $course
 * @property string|null $description
 * @property string|null $cover_path
 * @property bool        $is_active
 * @property bool        $exercise_video_enabled
 * @property string|null $exercise_video_label
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['title', 'course', 'description', 'cover_path', 'is_active', 'exercise_video_enabled', 'exercise_video_label'])]
class Module extends Model
{
    protected function casts(): array
    {
        return [
            'is_active'               => 'boolean',
            'exercise_video_enabled'  => 'boolean',
        ];
    }

    public function contents(): HasMany
    {
        return $this->hasMany(ModuleContent::class)->orderBy('order');
    }

    public function quiz(): HasOne
    {
        return $this->hasOne(Quiz::class);
    }

    public function getCoverUrlAttribute(): ?string
    {
        return $this->cover_path ? Storage::url($this->cover_path) : null;
    }
}
