<?php

namespace App\Http\Controllers;

use App\Http\Requests\PackageRequest;
use App\Models\Package;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PackageController extends Controller
{
    /**
     * Display a listing of packages
     */
    /**
     * Display a listing of packages
     */
    public function index(Request $request)
    {
        $limit = $request->input('limit', 20);

        $allowedSorts = ['name', 'price', 'mikrotik_profile', 'customers_count', 'created_at'];
        $sort = in_array($request->input('sort'), $allowedSorts, true) ? $request->input('sort') : 'price';
        $direction = $request->input('direction') === 'desc' ? 'desc' : 'asc';

        $packages = Package::withCount('customers')
                          ->when($request->search, function ($query, $search) {
                              $query->where(function ($sub) use ($search) {
                                  $sub->where('name', 'like', "%{$search}%")
                                      ->orWhere('mikrotik_profile', 'like', "%{$search}%")
                                      ->orWhere('rate_limit', 'like', "%{$search}%");
                              });
                          })
                          ->orderBy($sort, $direction)
                          ->paginate($limit)
                          ->withQueryString();

        return Inertia::render('Packages/Index', [
            'packages' => $packages,
            'filters' => [
                'search' => $request->search,
                'limit' => $limit,
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }

    /**
     * Show the form for creating a new package
     */
    public function create()
    {
        return Inertia::render('Packages/Create');
    }

    /**
     * Store a newly created package
     */
    public function store(PackageRequest $request)
    {
        $validated = $request->validated();

        Package::create($validated);

        return redirect()->route('packages.index')
            ->with('success', 'Package created successfully.');
    }

    /**
     * Display the specified package
     */
    public function show(Package $package)
    {
        $package->loadCount('customers');

        return Inertia::render('Packages/Show', [
            'package' => $package,
        ]);
    }

    /**
     * Show the form for editing the specified package
     */
    public function edit(Package $package)
    {
        return Inertia::render('Packages/Edit', [
            'package' => $package,
        ]);
    }

    /**
     * Update the specified package
     */
    public function update(PackageRequest $request, Package $package)
    {
        $validated = $request->validated();

        $package->update($validated);

        // TODO: Log this change with spatie/laravel-activitylog
        // activity()->performedOn($package)->log('updated package price');

        return redirect()->route('packages.index')
            ->with('success', 'Package updated successfully.');
    }

    /**
     * Remove the specified package
     */
    public function destroy(Package $package)
    {
        // Prevent deletion if package has customers
        if ($package->customers()->ebilling()->count() > 0) {
            return back()->with('error', 'Cannot delete package with active customers.');
        }

        $package->delete();

        return redirect()->route('packages.index')
            ->with('success', 'Package deleted successfully.');
    }
}
