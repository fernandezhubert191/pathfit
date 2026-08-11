<?php

namespace App\Http\Controllers;

use App\Models\Module;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ModuleController extends Controller
{
    public function index(Team $currentTeam): Response
    {
        $modules = Module::orderBy('course')->orderBy('created_at', 'asc')
            ->get()
            ->map(fn ($m) => [
                'id'          => $m->id,
                'title'       => $m->title,
                'course'      => $m->course,          // 'pathfit1' | 'pathfit2'
                'description' => $m->description,
                'is_active'   => $m->is_active,
                'created_at'  => $m->created_at->diffForHumans(),
            ]);

        return Inertia::render('modules/index', [
            'modules' => $modules,
        ]);
    }

    public function store(Request $request, Team $currentTeam): RedirectResponse
    {
        $request->validate([
            'title'       => ['required', 'string', 'max:255'],
            'course'      => ['required', 'in:pathfit1,pathfit2'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        Module::create([
            'title'       => $request->input('title'),
            'course'      => $request->input('course'),
            'description' => $request->input('description'),
            'is_active'   => true,
        ]);

        return back()->with('success', 'Module created successfully.');
    }

    public function update(Request $request, Team $currentTeam, Module $module): RedirectResponse
    {
        $request->validate([
            'title'       => ['required', 'string', 'max:255'],
            'course'      => ['required', 'in:pathfit1,pathfit2'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active'   => ['boolean'],
        ]);

        $module->update([
            'title'       => $request->input('title'),
            'course'      => $request->input('course'),
            'description' => $request->input('description'),
            'is_active'   => $request->boolean('is_active'),
        ]);

        return back()->with('success', 'Module updated.');
    }

    public function destroy(Team $currentTeam, Module $module): RedirectResponse
    {
        $module->delete();

        return back()->with('success', 'Module deleted.');
    }
}
