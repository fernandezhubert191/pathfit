<?php

namespace App\Http\Controllers;

use App\Models\Module;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuizController extends Controller
{
    /**
     * Get (or create) the quiz for a module, including all questions.
     */
    public function show(Team $currentTeam, Module $module): JsonResponse
    {
        $quiz = $module->quiz()->with('questions')->first();

        if (! $quiz) {
            return response()->json(['quiz' => null]);
        }

        return response()->json([
            'quiz' => [
                'id'        => $quiz->id,
                'title'     => $quiz->title,
                'questions' => $quiz->questions->map(fn ($q) => $this->formatQuestion($q)),
            ],
        ]);
    }

    /**
     * Create the quiz for a module (one per module).
     */
    public function store(Request $request, Team $currentTeam, Module $module): JsonResponse
    {
        $request->validate([
            'title' => ['required', 'string', 'max:255'],
        ]);

        abort_if($module->quiz()->exists(), 422, 'This module already has a quiz.');

        $quiz = Quiz::create([
            'module_id' => $module->id,
            'title'     => $request->input('title'),
        ]);

        return response()->json([
            'quiz' => ['id' => $quiz->id, 'title' => $quiz->title, 'questions' => []],
        ], 201);
    }

    /**
     * Update the quiz title.
     */
    public function update(Request $request, Team $currentTeam, Module $module, Quiz $quiz): JsonResponse
    {
        $request->validate(['title' => ['required', 'string', 'max:255']]);
        $quiz->update(['title' => $request->input('title')]);

        return response()->json(['ok' => true]);
    }

    /**
     * Delete the quiz (and all questions via cascade).
     */
    public function destroy(Team $currentTeam, Module $module, Quiz $quiz): JsonResponse
    {
        $quiz->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Add a question to the quiz.
     */
    public function addQuestion(Request $request, Team $currentTeam, Module $module, Quiz $quiz): JsonResponse
    {
        $request->validate([
            'question'       => ['required', 'string'],
            'choice_a'       => ['required', 'string', 'max:500'],
            'choice_b'       => ['required', 'string', 'max:500'],
            'choice_c'       => ['required', 'string', 'max:500'],
            'choice_d'       => ['required', 'string', 'max:500'],
            'correct_answer' => ['required', 'in:a,b,c,d'],
        ]);

        $order    = $quiz->questions()->max('order') + 1;
        $question = QuizQuestion::create([
            'quiz_id'        => $quiz->id,
            'question'       => $request->input('question'),
            'choice_a'       => $request->input('choice_a'),
            'choice_b'       => $request->input('choice_b'),
            'choice_c'       => $request->input('choice_c'),
            'choice_d'       => $request->input('choice_d'),
            'correct_answer' => $request->input('correct_answer'),
            'order'          => $order,
        ]);

        return response()->json(['question' => $this->formatQuestion($question)], 201);
    }

    /**
     * Update an existing question.
     */
    public function updateQuestion(
        Request $request,
        Team $currentTeam,
        Module $module,
        Quiz $quiz,
        QuizQuestion $question
    ): JsonResponse {
        $request->validate([
            'question'       => ['required', 'string'],
            'choice_a'       => ['required', 'string', 'max:500'],
            'choice_b'       => ['required', 'string', 'max:500'],
            'choice_c'       => ['required', 'string', 'max:500'],
            'choice_d'       => ['required', 'string', 'max:500'],
            'correct_answer' => ['required', 'in:a,b,c,d'],
        ]);

        $question->update($request->only('question', 'choice_a', 'choice_b', 'choice_c', 'choice_d', 'correct_answer'));

        return response()->json(['question' => $this->formatQuestion($question->fresh())]);
    }

    /**
     * Delete a question.
     */
    public function deleteQuestion(
        Team $currentTeam,
        Module $module,
        Quiz $quiz,
        QuizQuestion $question
    ): JsonResponse {
        $question->delete();

        return response()->json(['ok' => true]);
    }

    private function formatQuestion(QuizQuestion $q): array
    {
        return [
            'id'             => $q->id,
            'question'       => $q->question,
            'choice_a'       => $q->choice_a,
            'choice_b'       => $q->choice_b,
            'choice_c'       => $q->choice_c,
            'choice_d'       => $q->choice_d,
            'correct_answer' => $q->correct_answer,
            'order'          => $q->order,
        ];
    }
}
