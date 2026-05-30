import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { ConfirmDialog } from '@/Components/ConfirmDialog';
import { DetailSection } from '@/Components/DetailSection';
import { ResourcePageHeader } from '@/Components/ResourcePageHeader';
import { Edit, MapPin, Trash2, Users } from 'lucide-react';

interface Area {
    id: number;
    name: string;
    code: string;
    customers_count: number;
    users_count: number;
}

interface Props {
    area: Area;
}

export default function Show({ area }: Props) {
    const [confirmOpen, setConfirmOpen] = useState(false);

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Areas', href: route('areas.index') },
                { label: area.name },
            ]}
            header={
                <ResourcePageHeader
                    title={area.name}
                    backHref={route('areas.index')}
                    actions={
                        <div className="flex items-center gap-2">
                            <Button asChild variant="outline" size="sm" className="h-8 gap-2">
                                <Link href={route('areas.edit', area.id)}>
                                    <Edit className="h-3.5 w-3.5" />
                                    Edit
                                </Link>
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 gap-2"
                                onClick={() => setConfirmOpen(true)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                            </Button>
                        </div>
                    }
                />
            }
        >
            <Head title={`Area: ${area.name}`} />

            <div className="py-8">
                <div className="mx-auto max-w-5xl space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Area Code</CardTitle>
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="font-mono text-2xl font-bold">{area.code}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{area.customers_count}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Assigned Users</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{area.users_count}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <DetailSection title="Area Details">
                        <dl className="grid gap-4 md:grid-cols-2">
                            <div>
                                <dt className="text-sm text-muted-foreground">Name</dt>
                                <dd className="mt-1 font-medium">{area.name}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Code</dt>
                                <dd className="mt-1 font-mono font-medium">{area.code}</dd>
                            </div>
                        </dl>
                    </DetailSection>
                </div>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Delete Area?"
                description={`Are you sure you want to delete ${area.name}? This action cannot be undone.`}
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => router.delete(route('areas.destroy', area.id), {
                    onFinish: () => setConfirmOpen(false),
                })}
            />
        </AuthenticatedLayout>
    );
}
