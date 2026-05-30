<?php

namespace App\Http\Controllers;

use App\Http\Requests\CustomerStoreRequest;
use App\Http\Requests\CustomerUpdateRequest;
use App\Models\Customer;
use App\Models\Package;
use App\Models\Area;
use App\Models\Olt;
use App\Models\Router;
use App\Services\MikrotikService;
use App\Services\RadiusUserService;
use App\Support\AreaScope;
use App\Support\SimpleXlsxWriter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class CustomerController extends Controller
{
    /**
     * Display a listing of customers with search and filters
     */
    public function index(Request $request)
    {
        $query = $this->customerIndexQuery($request);

        // Pagination
        $limit = $request->input('limit', 20);
        $customers = $query->paginate($limit)->withQueryString();

        $areasQuery = Area::select('id', 'name')->orderBy('name');
        AreaScope::applyToAreas($areasQuery, $request->user());

        return Inertia::render('Customers/Index', [
            'customers' => $customers,
            'filters' => $request->only(['search', 'status', 'package_id', 'area_id', 'mikrotik_sync', 'unpaid_periods', 'sort', 'direction', 'limit']),
            'packages' => Package::all(), // For filter dropdown
            'areas' => $areasQuery->get(),
        ]);
    }

    public function export(Request $request)
    {
        $query = $this->customerIndexQuery($request)
            ->with(['package:id,name,price,rate_limit', 'area:id,name', 'router:id,name'])
            ->select([
                'id',
                'code',
                'nik',
                'name',
                'phone',
                'address',
                'pppoe_user',
                'package_id',
                'area_id',
                'router_id',
                'status',
                'mikrotik_sync_status',
                'mikrotik_synced_at',
                'mikrotik_sync_checked_at',
                'join_date',
                'due_day',
                'created_at',
            ])
            ->withCount([
                'invoices as unpaid_periods_count' => function ($query) {
                    $query->where('status', 'unpaid');
                },
            ]);

        $rowNumber = 1;
        $rows = $query->lazy(1000)->map(function (Customer $customer) use (&$rowNumber) {
            return [
            $rowNumber++,
            $customer->code,
            $customer->nik ?? '',
            $customer->name,
            $customer->address,
            $customer->phone,
            $customer->area?->name ?? '',
            $customer->package?->name ?? '',
            $customer->package?->rate_limit ?? '',
            $customer->package?->price ?? '',
            $customer->status,
            $customer->router?->name ?? '',
            $customer->mikrotik_sync_status ?? 'unknown',
            $customer->mikrotik_synced_at?->toDateTimeString() ?? '',
            $customer->mikrotik_sync_checked_at?->toDateTimeString() ?? '',
            $customer->join_date?->toDateString() ?? '',
            $customer->due_day,
            $customer->unpaid_periods_count,
            ];
        });

        $path = SimpleXlsxWriter::create('customers-export.xlsx', [
            'No',
            'ID Pelanggan',
            'No KTP',
            'Nama Pelanggan',
            'Alamat',
            'Tlp',
            'Area',
            'Nama Langganan',
            'Keterangan Langganan',
            'Harga Langganan',
            'Status Pelanggan',
            'Router',
            'MikroTik Sync',
            'MikroTik Synced At',
            'MikroTik Checked At',
            'Tanggal Bergabung',
            'Jatuh Tempo',
            'Periode Belum Bayar',
        ], $rows);

        return response()->download($path, 'customers-' . now()->format('Ymd-His') . '.xlsx')->deleteFileAfterSend();
    }

    /**
     * Show the form for creating a new customer
     */
    public function create()
    {
        $areasQuery = Area::select('id', 'name')->orderBy('name');
        AreaScope::applyToAreas($areasQuery, request()->user());

        return Inertia::render('Customers/Create', [
            'packages' => Package::select('id', 'name', 'price')->get(),
            'areas' => $areasQuery->get(),
            'olts' => Olt::select('id', 'name')->orderBy('name')->get(),
            'routers' => Router::select('id', 'name')->get(),
        ]);
    }

    /**
     * Store a newly created customer in storage.
     */
    public function store(CustomerStoreRequest $request)
    {
        $validated = $request->validated();
        AreaScope::authorizeAreaId(isset($validated['area_id']) ? (int) $validated['area_id'] : null, $request->user());

        // Auto-generate join date if not provided
        $validated['join_date'] = now();

        // Handle KTP photo upload
        if ($request->hasFile('ktp_photo')) {
            $file = $request->file('ktp_photo');
            $filename = 'customer-' . uniqid() . '.' . $file->extension();
            $path = $file->storeAs('ktp/' . now()->format('Y/m'), $filename, 'public');
            $validated['ktp_photo_url'] = $path; // Store path in mapped URL column
        }

        $customer = Customer::create($validated);
        $this->syncRadiusUser($customer);

        return redirect()->route('customers.index')
            ->with('success', 'Customer created successfully.');
    }

    /**
     * Display the specified customer.
     */
    public function show(Customer $customer)
    {
        AreaScope::authorizeCustomer($customer, request()->user());

        $customer->load([
            'package', 
            'area', 
            'router:id,name,connection_status,is_active',
            'olt:id,name,code,management_ip',
            'invoices' => function($q) {
                $q->latest('period'); 
            },
            'invoices.transactions'
        ]);

        return Inertia::render('Customers/Show', [
            'customer' => $customer,
        ]);
    }

    /**
     * Show the form for editing the customer
     */
    public function edit(Customer $customer)
    {
        AreaScope::authorizeCustomer($customer, request()->user());
        $areasQuery = Area::select('id', 'name')->orderBy('name');
        AreaScope::applyToAreas($areasQuery, request()->user());

        return Inertia::render('Customers/Edit', [
            'customer' => $customer,
            'packages' => Package::select('id', 'name', 'price')->get(),
            'areas' => $areasQuery->get(),
            'olts' => Olt::select('id', 'name')->orderBy('name')->get(),
            'routers' => Router::select('id', 'name')->get(),
        ]);
    }

    /**
     * Update the specified customer
     */
    public function update(CustomerUpdateRequest $request, Customer $customer)
    {
        AreaScope::authorizeCustomer($customer, $request->user());

        $validated = $request->validated();
        AreaScope::authorizeAreaId(isset($validated['area_id']) ? (int) $validated['area_id'] : null, $request->user());

        // Handle KTP photo upload
        if ($request->hasFile('ktp_photo')) {
            // Delete old file if exists and is a local path (not a full URL)
            if ($customer->ktp_photo_url && !filter_var($customer->ktp_photo_url, FILTER_VALIDATE_URL)) {
                \Storage::disk('public')->delete($customer->ktp_photo_url);
            }
            
            $file = $request->file('ktp_photo');
            $filename = 'customer-' . $customer->id . '-' . uniqid() . '.' . $file->extension();
            $path = $file->storeAs('ktp/' . now()->format('Y/m'), $filename, 'public');
            
            $validated['ktp_photo_url'] = $path;
        }

        $customer->update($validated);
        $this->syncRadiusUser($customer->fresh());

        return redirect()->route('customers.index')
            ->with('success', 'Customer updated successfully.');
    }

    /**
     * Remove the specified customer
     */
    public function destroy(Customer $customer)
    {
        AreaScope::authorizeCustomer($customer, request()->user());

        if ($customer->status === 'active') {
            return back()->with('error', 'Cannot delete an active customer. Please terminate service first.');
        }

        $customer->delete();

        return redirect()->route('customers.index')
            ->with('success', 'Customer deleted successfully.');
    }
    
    /**
     * Isolate the customer (block internet via Mikrotik)
     */
    public function isolate(Customer $customer, MikrotikService $mikrotik)
    {
        AreaScope::authorizeCustomer($customer, request()->user());

        if ($customer->router_id && $customer->pppoe_user) {
            try {
                $mikrotik->isolateCustomerNow($customer, 10);
                $this->syncRadiusUser($customer->fresh());

                return back()->with('success', "Customer {$customer->name} isolated on router.");
            } catch (\Throwable $e) {
                return back()->with('error', "Mikrotik Error: {$e->getMessage()}");
            }
        }

        activity()
            ->causedBy(request()->user())
            ->performedOn($customer)
            ->withProperties(['reason' => 'missing_router_or_pppoe'])
            ->log('manual_isolation_blocked');

        return back()->with('error', 'Cannot isolate customer: router and PPPoE username are required for MikroTik enforcement.');
    }

    /**
     * Reconnect the customer (restore internet via Mikrotik)
     */
    public function reconnect(Customer $customer, MikrotikService $mikrotik)
    {
        AreaScope::authorizeCustomer($customer, request()->user());

        if ($customer->router_id && $customer->pppoe_user) {
            try {
                $mikrotik->reconnectCustomerNow($customer, 10);
                $this->syncRadiusUser($customer->fresh());

                return back()->with('success', "Customer {$customer->name} reconnected on router.");
            } catch (\Throwable $e) {
                return back()->with('error', "Mikrotik Error: {$e->getMessage()}");
            }
        }

        activity()
            ->causedBy(request()->user())
            ->performedOn($customer)
            ->withProperties(['reason' => 'missing_router_or_pppoe'])
            ->log('manual_reconnection_blocked');

        return back()->with('error', 'Cannot reconnect customer: router and PPPoE username are required for MikroTik enforcement.');
    }

    private function customerIndexQuery(Request $request)
    {
        $query = Customer::ebilling()->with([
            'package',
            'area',
            'router:id,name',
            'invoices' => function($q) {
                $q->where('status', 'unpaid')->orderBy('due_date', 'asc')->limit(1);
            }
        ])->withCount([
            'invoices as unpaid_periods_count' => function ($query) {
                $query->where('status', 'unpaid');
            },
        ]);
        AreaScope::applyToCustomers($query, $request->user());

        // Search functionality
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('pppoe_user', 'like', "%{$search}%")
                  ->orWhere('address', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        // Status filter
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Package filter
        if ($request->has('package_id') && $request->package_id) {
            $query->where('package_id', $request->package_id);
        }

        // Area filter
        if ($request->has('area_id') && $request->area_id) {
            $query->where('area_id', $request->area_id);
        }

        // MikroTik sync filter. This is based on the latest persisted router scan only.
        if ($request->has('mikrotik_sync') && $request->mikrotik_sync !== 'all') {
            $status = $request->mikrotik_sync;
            if (in_array($status, ['unknown', 'synced', 'missing'], true)) {
                $query->where('mikrotik_sync_status', $status);
            }
        }

        if ($request->has('unpaid_periods') && $request->unpaid_periods !== 'all') {
            if ($request->unpaid_periods === '3plus') {
                $query->has('invoices', '>=', 3, 'and', function ($invoiceQuery) {
                    $invoiceQuery->where('status', 'unpaid');
                });
            }
        }

        // Sorting
        $sortField = $request->get('sort', 'join_date');
        $sortDirection = $request->get('direction', 'desc');
        if (! in_array($sortField, ['code', 'name', 'status', 'join_date', 'created_at'], true)) {
            $sortField = 'join_date';
        }
        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }
        $query->orderBy($sortField, $sortDirection);

        return $query;
    }

    private function syncRadiusUser(Customer $customer): void
    {
        try {
            app(RadiusUserService::class)->syncCustomer($customer);
        } catch (\Throwable $e) {
            Log::warning('Failed to sync customer to FreeRADIUS.', [
                'customer_id' => $customer->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
