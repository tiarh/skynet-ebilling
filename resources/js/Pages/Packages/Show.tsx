import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { ArrowLeft, Edit, Trash2, Package as PackageIcon, Users, DollarSign, ChevronLeft } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/Components/ui/dialog";
import { useState } from 'react';

interface Customer {
    id: number;
    name: string;
    code: string;
    status: string;
}

interface Package {
    id: number;
    name: string;
    price: number;
    customers_count: number;
    customers?: Customer[];
}

interface Props {
    package: Package;
}

export default function Show({ package: pkg }: Props) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleDelete = () => {
        router.delete(route('packages.destroy', pkg.id));
        setDeleteDialogOpen(false);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'active':
                return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20';
            case 'isolated':
                return 'bg-red-500/15 text-red-600 border-red-500/20';
            case 'suspended':
                return 'bg-orange-500/15 text-orange-600 border-orange-500/20';
            default:
                return 'bg-gray-500/15 text-gray-600 border-gray-500/20';
        }
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Packages', href: route('packages.index') },
                { label: pkg.name }
            ]}
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={route('packages.index')}>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h2 className="text-xl font-semibold leading-tight text-foreground">
                                {pkg.name}
                            </h2>

                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={route('packages.edit', pkg.id)}>
                            <Button variant="outline">
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                            </Button>
                        </Link>
                        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Delete Package</DialogTitle>
                                    <DialogDescription>
                                        Are you sure you want to delete this package? This action cannot be undone.
                                        {pkg.customers_count > 0 && (
                                            <p className="mt-2 text-red-500 font-medium">
                                                Warning: This package has {pkg.customers_count} active customer(s).
                                            </p>
                                        )}
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button variant="destructive" onClick={handleDelete}>
                                        Delete Package
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            }
        >
            <Head title={`Package: ${pkg.name}`} />

            <div className="py-12">
                <div className="mx-auto max-w-5xl sm:px-6 lg:px-8 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Monthly Price
                                </CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(pkg.price)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Per customer per month
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Active Customers
                                </CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{pkg.customers_count}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Using this package
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Total Revenue
                                </CardTitle>
                                <PackageIcon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(pkg.price * pkg.customers_count)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Monthly potential
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Package Details */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle>Package Details</CardTitle>
                            <CardDescription>
                                Service package information
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Package Name</p>
                                    <p className="text-base font-semibold mt-1">{pkg.name}</p>
                                </div>

                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Price</p>
                                    <p className="text-base font-semibold mt-1">{formatCurrency(pkg.price)}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Active Subscriptions</p>
                                    <p className="text-base font-semibold mt-1">{pkg.customers_count}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Customers using this package */}
                    {pkg.customers && pkg.customers.length > 0 && (
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle>Customers Using This Package</CardTitle>
                                <CardDescription>
                                    {pkg.customers_count} customer{pkg.customers_count !== 1 ? 's' : ''} subscribed
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Code</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pkg.customers.map((customer) => (
                                            <TableRow key={customer.id}>
                                                <TableCell className="font-medium">{customer.code}</TableCell>
                                                <TableCell>{customer.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={getStatusColor(customer.status)}>
                                                        {customer.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Link href={route('customers.show', customer.id)}>
                                                        <Button variant="ghost" size="sm">
                                                            View
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
