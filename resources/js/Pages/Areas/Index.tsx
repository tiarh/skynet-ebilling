import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import DataTable, { Column, PaginatedData } from '@/Components/DataTable';
import { ConfirmDialog } from '@/Components/ConfirmDialog';
import { ResourcePageHeader } from '@/Components/ResourcePageHeader';
import { DeleteAction, EditAction } from '@/Components/TableActions';
import { Plus } from 'lucide-react';

interface Area {
    id: number;
    name: string;
    code: string;
    customers_count?: number;
}

interface Props {
    areas: PaginatedData<Area>;
    filters: {
        search?: string;
        limit?: number;
        sort?: string;
        direction?: 'asc' | 'desc';
    };
}

export default function Index({ areas, filters = {} }: Props) {
    const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);

    const columns: Column<Area>[] = [
        {
            header: 'Name',
            accessorKey: 'name',
            sortable: true,
            cell: (area) => <span className="font-medium">{area.name}</span>,
        },
        {
            header: 'Code',
            accessorKey: 'code',
            sortable: true,
            cell: (area) => <span className="font-mono text-sm">{area.code}</span>,
        },
        {
            header: 'Customers',
            accessorKey: 'customers_count',
            sortable: true,
            cell: (area) => (
                <Badge variant="secondary">
                    {area.customers_count || 0} {(area.customers_count || 0) === 1 ? 'Customer' : 'Customers'}
                </Badge>
            ),
        },
        {
            header: 'Actions',
            className: 'w-[100px] text-right',
            cell: (area) => (
                <div className="flex items-center justify-end gap-2">
                    <EditAction onClick={() => router.visit(route('areas.edit', area.id))} title="Edit Area" />
                    <DeleteAction onClick={() => setAreaToDelete(area)} title="Delete Area" />
                </div>
            ),
        },
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: 'Areas', href: route('areas.index') }]}
            header={
                <ResourcePageHeader
                    title="Areas"
                    actions={
                        <Button asChild size="sm" className="h-8 gap-2">
                            <Link href={route('areas.create')}>
                                <Plus className="h-3.5 w-3.5" />
                                Add Area
                            </Link>
                        </Button>
                    }
                />
            }
        >
            <Head title="Areas" />

            <div className="py-8">
                <DataTable
                    data={areas}
                    columns={columns}
                    filters={filters}
                    title="Areas"
                    description={`Showing ${areas.data.length} of ${areas.total} areas`}
                    searchPlaceholder="Search areas..."
                    routeName="areas.index"
                />
            </div>

            <ConfirmDialog
                open={!!areaToDelete}
                onOpenChange={(open) => !open && setAreaToDelete(null)}
                title="Delete Area?"
                description={`Are you sure you want to delete ${areaToDelete?.name}? This action cannot be undone.`}
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => areaToDelete && router.delete(route('areas.destroy', areaToDelete.id), {
                    onFinish: () => setAreaToDelete(null),
                })}
            />
        </AuthenticatedLayout>
    );
}
