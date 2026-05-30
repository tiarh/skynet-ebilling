import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import DataTable, { Column, FilterConfig, PaginatedData } from '@/Components/DataTable';
import { ConfirmDialog } from '@/Components/ConfirmDialog';
import { ResourcePageHeader } from '@/Components/ResourcePageHeader';
import { DeleteAction, EditAction } from '@/Components/TableActions';
import { Plus } from 'lucide-react';

interface Area {
    id: number;
    name: string;
    code: string;
}

interface ManagedUser {
    id: number;
    name: string;
    email: string;
    role: 'superadmin' | 'admin';
    areas: Area[];
    created_at: string;
}

interface Props {
    users: PaginatedData<ManagedUser>;
    filters: {
        search?: string;
        role?: string;
        limit?: number;
        sort?: string;
        direction?: 'asc' | 'desc';
    };
}

function userScope(user: ManagedUser) {
    if (user.role === 'superadmin') {
        return 'All access';
    }

    if (user.areas.length === 0) {
        return 'Global admin';
    }

    return user.areas.map((area) => area.name).join(', ');
}

export default function Index({ users, filters = {} }: Props) {
    const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

    const columns: Column<ManagedUser>[] = [
        {
            header: 'Name',
            accessorKey: 'name',
            sortable: true,
            cell: (user) => <span className="font-medium">{user.name}</span>,
        },
        {
            header: 'Email',
            accessorKey: 'email',
            sortable: true,
        },
        {
            header: 'Role',
            accessorKey: 'role',
            sortable: true,
            cell: (user) => (
                <Badge variant={user.role === 'superadmin' ? 'default' : 'secondary'}>
                    {user.role === 'superadmin' ? 'Superadmin' : 'Admin'}
                </Badge>
            ),
        },
        {
            header: 'Scope',
            className: 'max-w-md',
            cell: (user) => <span className="text-sm text-muted-foreground">{userScope(user)}</span>,
        },
        {
            header: 'Actions',
            className: 'w-[100px] text-right',
            cell: (user) => (
                <div className="flex items-center justify-end gap-2">
                    <EditAction onClick={() => router.visit(route('users.edit', user.id))} title="Edit User" />
                    <DeleteAction onClick={() => setUserToDelete(user)} title="Delete User" />
                </div>
            ),
        },
    ];

    const filterConfigs: FilterConfig[] = [
        {
            key: 'role',
            placeholder: 'Role',
            options: [
                { value: 'superadmin', label: 'Superadmin' },
                { value: 'admin', label: 'Admin' },
            ],
        },
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: 'Users', href: route('users.index') }]}
            header={
                <ResourcePageHeader
                    title="Users"
                    actions={
                        <Button asChild size="sm" className="h-8 gap-2">
                            <Link href={route('users.create')}>
                                <Plus className="h-3.5 w-3.5" />
                                Add User
                            </Link>
                        </Button>
                    }
                />
            }
        >
            <Head title="Users" />

            <div className="py-8">
                <DataTable
                    data={users}
                    columns={columns}
                    filters={filters}
                    title="Users"
                    description={`Showing ${users.data.length} of ${users.total} users`}
                    searchPlaceholder="Search users..."
                    filterConfigs={filterConfigs}
                    routeName="users.index"
                />
            </div>

            <ConfirmDialog
                open={!!userToDelete}
                onOpenChange={(open) => !open && setUserToDelete(null)}
                title="Delete User?"
                description={`Delete ${userToDelete?.name}? This cannot be undone.`}
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => userToDelete && router.delete(route('users.destroy', userToDelete.id), {
                    onFinish: () => setUserToDelete(null),
                })}
            />
        </AuthenticatedLayout>
    );
}
