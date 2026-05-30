import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EditAction, DeleteAction } from '@/Components/TableActions';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Download } from "lucide-react";
import DataTable, { Column, FilterConfig, PaginatedData } from '@/Components/DataTable';
import { PageProps } from '@/types';


const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
        pending_installation: 'text-blue-500 border-blue-500/20 bg-blue-500/10',
        active: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
        isolated: 'text-red-500 border-red-500/20 bg-red-500/10',
        terminated: 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
    };
    const className = variants[status] || 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10';

    return (
        <Badge variant="outline" className={`${className} capitalize border`}>
            {status.replaceAll('_', ' ')}
        </Badge>
    );
};

const getMikrotikSyncDot = (customer: Customer) => {
    const status = customer.mikrotik_sync_status || 'unknown';
    const variants: Record<string, string> = {
        synced: 'bg-emerald-500 ring-emerald-500/20',
        missing: 'bg-red-500 ring-red-500/20',
        unknown: 'bg-zinc-400 ring-zinc-400/20',
    };
    const labels: Record<string, string> = {
        synced: 'Synced',
        missing: 'Missing',
        unknown: 'Not checked',
    };
    const label = labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
    const checkedAt = customer.mikrotik_sync_checked_at
        ? new Date(customer.mikrotik_sync_checked_at).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        })
        : 'Not checked';
    const routerName = customer.router?.name || 'No router';

    return (
        <span
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-4 ${variants[status] || variants.unknown}`}
            title={`MikroTik: ${label} | ${routerName} | ${checkedAt}`}
            aria-label={`MikroTik ${label}`}
        />
    );
};

interface Package {
    id: number;
    name: string;
    price: number;

}

interface Area {
    id: number;
    name: string;
}

interface Router {
    id: number;
    name: string;
}

interface Customer {
    id: number;
    code: string;
    name: string;
    address: string;
    pppoe_user: string;
    status: 'pending_installation' | 'active' | 'isolated' | 'terminated';
    mikrotik_sync_status: 'unknown' | 'synced' | 'missing';
    mikrotik_synced_at?: string | null;
    mikrotik_sync_checked_at?: string | null;
    unpaid_periods_count?: number;
    // is_online removed
    package: Package;
    area?: Area;
    router?: Router | null;
    join_date: string;
    created_at: string;
    invoices?: Array<{
        id: number;
        due_date: string;
        status: string;
    }>;
}



interface Props {
    customers: PaginatedData<Customer>;
    packages: Package[];
    areas: Area[];
    filters: {
        search?: string;
        status?: string;
        package_id?: string;
        area_id?: string;
        mikrotik_sync?: string;
        unpaid_periods?: string;
        sort?: string;
        direction?: 'asc' | 'desc';
        limit?: string;
    };
}

export default function Index({ customers, packages = [], areas = [], filters = {} }: Props) {
    const { auth } = usePage<PageProps>().props;
    const isAdmin = auth.user.role === 'admin' || auth.user.role === 'superadmin';

    const columns: Column<Customer>[] = [
        {
            header: "ID",
            className: "w-[100px]",
            cell: (customer) => (
                <span className="font-mono text-xs text-muted-foreground font-medium">
                    {customer.code}
                </span>
            )
        },
        {
            header: "Customer Name",
            accessorKey: "name",
            sortable: true,
            cell: (customer) => (
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        {getMikrotikSyncDot(customer)}
                        <span className="font-medium text-foreground">{customer.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {customer.address}
                    </span>
                </div>
            )
        },
        {
            header: "Area",
            sortable: false,
            cell: (customer) => (
                <div className="flex flex-col">
                    <span className="text-sm text-foreground">
                        {customer.area?.name || '-'}
                    </span>
                </div>
            )
        },
        {
            header: "Package",
            accessorKey: "package",
            sortable: false,
            cell: (customer) => (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                            {customer.package.name}
                        </span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                        Rp {customer.package.price.toLocaleString('id-ID')}
                    </span>
                </div>
            )
        },
        {
            header: "Status",
            accessorKey: "status",
            sortable: true,
            cell: (customer) => getStatusBadge(customer.status)
        },
        {
            header: "Join Date",
            accessorKey: "join_date",
            sortable: true,
            cell: (customer) => (
                <span className="text-sm text-muted-foreground">
                    {new Date(customer.join_date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    })}
                </span>
            )
        },
        {
            header: "Next Due Date",
            cell: (customer) => (
                <div className="flex flex-col gap-1">
                    {customer.invoices && customer.invoices.length > 0 ? (
                        <div className={`text-sm flex flex-col ${new Date(customer.invoices[0].due_date) < new Date() && customer.invoices[0].status === 'unpaid'
                            ? 'text-red-500'
                            : 'text-muted-foreground'
                            }`}>
                            <span className="font-medium">
                                {new Date(customer.invoices[0].due_date).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short'
                                })}
                            </span>
                            {new Date(customer.invoices[0].due_date) < new Date() && customer.invoices[0].status === 'unpaid' && (
                                <span className="text-[10px] font-bold uppercase">Overdue</span>
                            )}
                        </div>
                    ) : (
                        <span className="text-muted-foreground text-xs italic">No Active Bills</span>
                    )}
                    {(customer.unpaid_periods_count || 0) >= 3 && (
                        <Badge variant="outline" className="w-fit border-red-500/20 bg-red-500/10 text-[10px] text-red-500">
                            {customer.unpaid_periods_count} unpaid
                        </Badge>
                    )}
                </div>
            )
        },
        ...(isAdmin ? [{
            header: "Actions",
            className: "text-right w-[100px]",
            cell: (customer: Customer) => (
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <EditAction
                        onClick={() => router.visit(route('customers.edit', customer.id))}
                        title="Edit Customer"
                    />
                    <DeleteAction
                        onClick={() => handleDelete(customer.id)}
                        title="Delete Customer"
                    />
                </div>
            )
        }] : []),
    ];

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this customer?')) {
            router.delete(route('customers.destroy', id));
        }
    };

    const exportUrl = () => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                params.set(key, String(value));
            }
        });

        const query = params.toString();
        return query ? `${route('customers.export')}?${query}` : route('customers.export');
    };

    const filterConfigs: FilterConfig[] = [
        {
            key: 'package_id',
            placeholder: 'All Packages',
            options: packages.map(pkg => ({ label: pkg.name, value: String(pkg.id) }))
        },
        {
            key: 'area_id',
            placeholder: 'All Areas',
            options: areas.map(area => ({ label: area.name, value: String(area.id) }))
        },
        {
            key: 'status',
            placeholder: 'All Status',
            options: [
                { label: 'Pending', value: 'pending_installation' },
                { label: 'Active', value: 'active' },
                { label: 'Isolated', value: 'isolated' },
                { label: 'Terminated', value: 'terminated' },
            ]
        },
        {
            key: 'mikrotik_sync',
            placeholder: 'All MikroTik',
            options: [
                { label: 'Synced', value: 'synced' },
                { label: 'Missing', value: 'missing' },
                { label: 'Not checked', value: 'unknown' },
            ]
        },
        {
            key: 'unpaid_periods',
            placeholder: 'All Billing',
            options: [
                { label: '3+ unpaid periods', value: '3plus' },
            ]
        }
    ];

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold leading-tight text-foreground">
                        Customers
                    </h2>
                    <div className="flex items-center gap-2">
                        <a href={exportUrl()}>
                            <Button variant="outline" className="gap-2">
                                <Download className="h-4 w-4" />
                                Export XLSX
                            </Button>
                        </a>
                        {isAdmin && (
                            <Link href={route('customers.create')}>
                                <Button className="bg-foreground text-background hover:bg-foreground/90">
                                    Add Customer
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Customers" />

            <div className="py-8">
                <DataTable
                    data={customers}
                    columns={columns}
                    filters={filters}
                    title="Customers Directory"
                    description={`Showing ${customers.data.length} of ${customers.total} customers`}
                    searchPlaceholder="Search Name, Phone, Address..."
                    filterConfigs={filterConfigs}
                    routeName="customers.index"
                    onRowClick={(item) => router.visit(route('customers.show', item.id))}
                />
            </div>
        </AuthenticatedLayout>
    );
}
