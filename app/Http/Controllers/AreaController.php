<?php

namespace App\Http\Controllers;

use App\Http\Requests\AreaRequest;
use App\Models\Area;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AreaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Area::query();

        if ($request->search) {
            $query->where(function ($sub) use ($request) {
                $sub->where('name', 'like', "%{$request->search}%")
                    ->orWhere('code', 'like', "%{$request->search}%");
            });
        }

        $allowedSorts = ['name', 'code', 'customers_count', 'created_at'];
        $sort = in_array($request->input('sort'), $allowedSorts, true) ? $request->input('sort') : 'name';
        $direction = $request->input('direction') === 'desc' ? 'desc' : 'asc';

        $areas = $query->withCount('customers')
            ->orderBy($sort, $direction)
            ->paginate($request->input('limit', 20))
            ->withQueryString();

        return Inertia::render('Areas/Index', [
            'areas' => $areas,
            'filters' => [
                'search' => $request->search,
                'limit' => $request->input('limit', 20),
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return Inertia::render('Areas/Create');
    }

    /**
     * Display the specified resource.
     */
    public function show(Area $area)
    {
        $area->loadCount(['customers', 'users']);

        return Inertia::render('Areas/Show', [
            'area' => $area,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(AreaRequest $request)
    {
        $validated = $request->validated();

        Area::create($validated);

        return redirect()->route('areas.index')
            ->with('success', 'Area created successfully.');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Area $area)
    {
        return Inertia::render('Areas/Edit', [
            'area' => $area,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(AreaRequest $request, Area $area)
    {
        $validated = $request->validated();

        $area->update($validated);

        return redirect()->route('areas.index')
            ->with('success', 'Area updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Area $area)
    {
        if ($area->customers()->ebilling()->exists()) {
            return back()->with('error', 'Cannot delete area with associated customers.');
        }

        $area->delete();

        return redirect()->route('areas.index')
            ->with('success', 'Area deleted successfully.');
    }
}
