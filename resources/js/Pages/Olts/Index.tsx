import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import DataTable, { Column, PaginatedData } from '@/Components/DataTable';
import { ConfirmDialog } from '@/Components/ConfirmDialog';
import { ResourcePageHeader } from '@/Components/ResourcePageHeader';
import { DeleteAction, EditAction } from '@/Components/TableActions';
import { Badge } from '@/Components/ui/badge';
import { PlugZap, Plus } from 'lucide-react';

interface Olt {
    id: number;
    name: string;
    code: string;
    vendor: string | null;
    management_ip: string | null;
    management_protocol: string | null;
    management_port: number | null;
    location: string | null;
    area: { id: number; name: string } | null;
    router: { id: number; name: string } | null;
}

interface Props {
    olts: PaginatedData<Olt>;
    filters: {
        search?: string;
        limit?: number;
        sort?: string;
        direction?: 'asc' | 'desc';
    };
}

export default function Index({ olts, filters = {} }: Props) {
    const [oltToDelete, setOltToDelete] = useState<Olt | null>(null);

    const columns: Column<Olt>[] = [
        {
            header: 'Name',
            accessorKey: 'name',
            sortable: true,
            cell: (olt) => <Link href={route('olts.show', olt.id)} className="font-medium hover:underline">{olt.name}</Link>,
        },
        {
            header: 'Code',
            accessorKey: 'code',
            sortable: true,
            cell: (olt) => <span className="font-mono text-sm">{olt.code}</span>,
        },
        {
            header: 'Vendor',
            cell: (olt) => {
                const label = olt.vendor === 'hioso' ? 'Hioso' : 'ZTE C300/C320';

                return <Badge variant="outline">{label}</Badge>;
            },
        },
        {
            header: 'Area',
            cell: (olt) => olt.area ? <Badge variant="secondary">{olt.area.name}</Badge> : <span className="text-muted-foreground">-</span>,
        },
        {
            header: 'Router',
            cell: (olt) => olt.router ? <span>{olt.router.name}</span> : <span className="text-muted-foreground">-</span>,
        },
        {
            header: 'Connect',
            cell: (olt) => (
                <span className="font-mono text-sm">
                    {olt.management_ip
                        ? `${olt.management_ip}:${olt.management_port || '-'}`
                        : '-'}
                </span>
            ),
        },
        {
            header: 'Protocol',
            cell: (olt) => (
                olt.management_protocol ? <Badge variant="outline" className="uppercase">{olt.management_protocol}</Badge> : <span className="text-muted-foreground">-</span>
            ),
        },
        {
            header: 'Actions',
            className: 'w-[160px] text-right',
            cell: (olt) => (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => router.post(route('olts.test', olt.id))}
                    >
                        <PlugZap className="h-3.5 w-3.5" />
                        Test
                    </Button>
                    <EditAction onClick={() => router.visit(route('olts.edit', olt.id))} title="Edit OLT" />
                    <DeleteAction onClick={() => setOltToDelete(olt)} title="Delete OLT" />
                </div>
            ),
        },
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: 'OLTs', href: route('olts.index') }]}
            header={
                <ResourcePageHeader
                    title="OLTs"
                    actions={
                        <Button asChild size="sm" className="h-8 gap-2">
                            <Link href={route('olts.create')}>
                                <Plus className="h-3.5 w-3.5" />
                                Add OLT
                            </Link>
                        </Button>
                    }
                />
            }
        >
            <Head title="OLTs" />

            <div className="py-8">
                <DataTable
                    data={olts}
                    columns={columns}
                    filters={filters}
                    title="OLTs"
                    description={`Showing ${olts.data.length} of ${olts.total} OLTs`}
                    searchPlaceholder="Search OLTs..."
                    routeName="olts.index"
                />
            </div>

            <ConfirmDialog
                open={!!oltToDelete}
                onOpenChange={(open) => !open && setOltToDelete(null)}
                title="Delete OLT?"
                description={`Are you sure you want to delete ${oltToDelete?.name}? This action cannot be undone.`}
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => oltToDelete && router.delete(route('olts.destroy', oltToDelete.id), {
                    onFinish: () => setOltToDelete(null),
                })}
            />
        </AuthenticatedLayout>
    );
}
