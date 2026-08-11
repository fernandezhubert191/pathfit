<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int $module_id
 * @property string $type  'text' | 'image' | 'video'
 * @property string|null $content
 * @property string|null $caption
 * @property int $order
 */
#[Fillable(['module_id', 'type', 'content', 'caption', 'order'])]
class ModuleContent extends Model
{
    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }

    public function getUrlAttribute(): ?string
    {
        if ($this->type === 'image' && $this->content) {
            return Storage::url($this->content);
        }
        return $this->content;
    }
}
