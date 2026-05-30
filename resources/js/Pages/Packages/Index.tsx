import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import DataTable, { Column, PaginatedData } from '@/Components/DataTable';
import { ConfirmDialog } from '@/Components/ConfirmDialog';
import { MoneyText } from '@/Components/Format';
import { ResourcePageHeader } from '@/Components/ResourcePageHeader';
import { DeleteAction, EditAction } from '@/Components/TableActions';
import { Plus } from 'lucide-react';

interface Package {
    id: number;
    name: string;
    price: number;
    mikrotik_profile?: string;
    rate_limit?: string;
    customers_count: number;
}

interface Props {
    packages: PaginatedData<Package>;
    filters?: {
        search?: string;
        limit?: number;
        sort?: string;
        direction?: 'asc' | 'desc';
    };
}

export default function Index({ packages, filters = {} }: Props) {
    const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);

    const columns: Column<Package>[] = [
        {
            header: 'Package Name',
            accessorKey: 'name',
            sortable: true,
            cell: (pkg) => <span className="font-medium">{pkg.name}</span>,
        },
        {
            header: 'Tech Profile',
            accessorKey: 'mikrotik_profile',
            sortable: true,
            cell: (pkg) => <span className="font-mono text-xs text-muted-foreground">{pkg.mikrotik_profile || '-'}</span>,
        },
        {
            header: 'Rate Limit',
            accessorKey: 'rate_limit',
            cell: (pkg) => <span className="font-mono text-xs text-muted-foreground">{pkg.rate_limit || '-'}</span>,
        },
        {
            header: 'Price',
            accessorKey: 'price',
            sortable: true,
            cell: (pkg) => <MoneyText amount={pkg.price} className="font-mono font-medium text-emerald-600" />,
        },
        {
            header: 'Active Customers',
            accessorKey: 'customers_count',
            sortable: true,
            cell: (pkg) => (
                <Badge variant="secondary">
                    {pkg.customers_count} {pkg.customers_count === 1 ? 'customer' : 'customers'}
                </Badge>
            ),
        },
        {
            header: 'Actions',
            className: 'w-[100px] text-right',
            cell: (pkg) => (
                <div className="flex items-center justify-end gap-2">
                    <EditAction onClick={() => router.visit(route('packages.edit', pkg.id))} title="Edit Package" />
                    <DeleteAction onClick={() => setPackageToDelete(pkg)} title="Delete Package" />
                </div>
            ),
        },
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: 'Packages', href: route('packages.index') }]}
            header={
                <ResourcePageHeader
                    title="Packages"
                    actions={
                        <Button asChild size="sm" className="h-8 gap-2">
                            <Link href={route('packages.create')}>
                                <Plus className="h-3.5 w-3.5" />
                                Add Package
                            </Link>
                        </Button>
                    }
                />
            }
        >
            <Head title="Packages" />

            <div className="py-8">
                <DataTable
                    data={packages}
                    columns={columns}
                    filters={filters}
                    title="Packages"
                    description={`Showing ${packages.data.length} of ${packages.total} packages`}
                    searchPlaceholder="Search packages..."
                    routeName="packages.index"
                    onRowClick={(item) => router.visit(route('packages.show', item.id))}
                />
            </div>

            <ConfirmDialog
                open={!!packageToDelete}
                onOpenChange={(open) => !open && setPackageToDelete(null)}
                title="Delete Package?"
                description={`Are you sure you want to delete ${packageToDelete?.name}? This action cannot be undone.`}
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => packageToDelete && router.delete(route('packages.destroy', packageToDelete.id), {
                    onFinish: () => setPackageToDelete(null),
                })}
            />
        </AuthenticatedLayout>
    );
}
