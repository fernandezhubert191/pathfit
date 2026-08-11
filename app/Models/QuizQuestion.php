<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int    $id
 * @property int    $quiz_id
 * @property string $question
 * @property string $choice_a
 * @property string $choice_b
 * @property string $choice_c
 * @property string $choice_d
 * @property string $correct_answer  'a'|'b'|'c'|'d'
 * @property int    $order
 */
#[Fillable(['quiz_id', 'question', 'choice_a', 'choice_b', 'choice_c', 'choice_d', 'correct_answer', 'order'])]
class QuizQuestion extends Model
{
    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }
}
