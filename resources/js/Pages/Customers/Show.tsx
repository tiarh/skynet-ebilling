import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, router, usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { ArrowLeft, Edit, Trash2, User, Network, MapPin, Search, ChevronLeft, MoreHorizontal, Eye, Loader2, CheckCircle2, AlertTriangle, Power } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/Components/ConfirmDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/Components/ui/dropdown-menu";
import MapPicker from '@/Components/MapPicker';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/Components/ui/dialog";
import { PageProps } from '@/types';

// Types
interface Transaction {
    id: number;
    amount: number;
    method: string;
    paid_at: string;
}

interface Invoice {
    id: number;
    period: string;
    amount: number;
    status: 'unpaid' | 'paid' | 'void';
    due_date: string;
    transactions: Transaction[];
}

interface Package {
    id: number;
    name: string;
    price: number;
    mikrotik_profile?: string | null;
}

interface Customer {
    id: number;
    name: string;
    code: string;
    address: string;
    phone: string;
    nik?: string;
    pppoe_user: string;
    status: 'pending_installation' | 'active' | 'suspended' | 'isolated' | 'offboarding' | 'terminated';
    geo_lat: string;
    geo_long: string;
    join_date: string;
    mikrotik_profile?: string | null;
    previous_profile?: string | null;
    mikrotik_sync_status?: 'unknown' | 'synced' | 'missing' | null;
    mikrotik_sync_checked_at?: string | null;
    olt_id?: number | null;
    olt_port_label?: string | null;
    onu_serial?: string | null;
    olt_status?: string | null;
    onu_rx_power_dbm?: string | null;
    onu_tx_power_dbm?: string | null;
    fiber_distance_m?: number | null;
    olt_last_synced_at?: string | null;
    package: Package;
    area?: { id: number; name: string };
    router?: {
        id: number;
        name: string;
        connection_status: 'unknown' | 'online' | 'offline';
        is_active: boolean;
    } | null;
    olt?: {
        id: number;
        name: string;
        code: string;
        management_ip?: string | null;
    } | null;
    invoices: Invoice[];
    ktp_photo_url?: string | null;
}

interface Props {
    customer: Customer;
}

export default function Show({ customer }: Props) {
    const { auth } = usePage<PageProps>().props;
    const isAdmin = auth.user.role === 'admin' || auth.user.role === 'superadmin';
    const { delete: destroy } = useForm();
    const [loading, setLoading] = useState(false);

    const handleDelete = () => {
        destroy(route('customers.destroy', customer.id));
    };

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'block' | 'unblock' | null>(null);
    const hasRouter = !!customer.router;
    const hasPppoeUser = !!customer.pppoe_user?.trim();
    const canEnforceOnMikrotik = hasRouter && hasPppoeUser;
    const enforcementBlockers = [
        !hasRouter ? 'Assign a MikroTik router.' : null,
        !hasPppoeUser ? 'Set a PPPoE username.' : null,
    ].filter((reason): reason is string => Boolean(reason));
    const syncWarning = customer.mikrotik_sync_status === 'missing'
        ? 'Last sync did not find this PPPoE user on MikroTik. The action may fail until the router record is fixed or synced again.'
        : customer.mikrotik_sync_status === 'unknown'
            ? 'This customer has not been verified against MikroTik yet.'
            : null;
    const enforcementLabel = canEnforceOnMikrotik ? 'Ready' : 'Needs setup';
    const enforcementBadgeClass = canEnforceOnMikrotik
        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
        : 'border-amber-500/20 bg-amber-500/10 text-amber-600';

    const handleToggleBlock = () => {
        if (!canEnforceOnMikrotik) {
            return;
        }

        const isActive = customer.status === 'active';
        setConfirmAction(isActive ? 'block' : 'unblock');
        setConfirmOpen(true);
    };

    const confirmToggle = () => {
        if (confirmAction === 'block') {
            router.post(route('customers.isolate', customer.id), {}, {
                onFinish: () => setConfirmOpen(false)
            });
        } else {
            router.post(route('customers.reconnect', customer.id), {}, {
                onFinish: () => setConfirmOpen(false)
            });
        }
    };

    const periodDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            pending_installation: 'text-blue-500 border-blue-500/20 bg-blue-500/10',
            active: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
            params: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10', // Typo fallback
            paid: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
            suspended: 'text-orange-500 border-orange-500/20 bg-orange-500/10',
            isolated: 'text-red-500 border-red-500/20 bg-red-500/10',
            unpaid: 'text-red-500 border-red-500/20 bg-red-500/10',
            offboarding: 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
            terminated: 'text-zinc-600 border-zinc-600/20 bg-zinc-600/10',
            void: 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
            synced: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
            missing: 'text-red-500 border-red-500/20 bg-red-500/10',
            unknown: 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
        };
        const className = variants[status] || 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10';

        return (
            <Badge variant="outline" className={`${className} capitalize border`}>
                {status.replace('_', ' ')}
            </Badge>
        );
    };

    const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
        <div className="flex items-start justify-between gap-4">
            <span className="shrink-0 text-muted-foreground">{label}</span>
            <div className="min-w-0 text-right font-medium">{children}</div>
        </div>
    );

    const ProfileValue = ({ value }: { value?: string | null }) => {
        if (!value) {
            return <span className="text-muted-foreground">-</span>;
        }

        return (
            <span className="inline-block max-w-full truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                {value}
            </span>
        );
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Customers', href: route('customers.index') },
                { label: customer.name }
            ]}
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={route('customers.index')}>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-semibold leading-tight text-foreground">
                                    {customer.name}
                                </h2>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 font-mono">
                                ID: {customer.code} | PPPoE: {customer.pppoe_user}
                            </p>
                        </div>
                    </div>
                    {isAdmin && (
                    <div className="flex items-center gap-4">


                        <Link href={route('customers.edit', customer.id)}>
                            <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Customer
                            </Button>
                        </Link>

                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="border-destructive/50">
                                <DialogHeader>
                                    <DialogTitle>Delete Customer Account?</DialogTitle>
                                    <DialogDescription>
                                        This will permanently remove <strong>{customer.name}</strong> from the database.
                                        This action cannot be undone.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => document.getElementById('close-dialog')?.click()}>Cancel</Button>
                                    <Button variant="destructive" onClick={handleDelete}>Confirm Delete</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                    )}
                </div>
            }
        >
            <Head title={`Customer: ${customer.name}`} />

            <div className="py-8">
                <Tabs defaultValue="overview" className="space-y-6">
                    <div className="flex items-center justify-between">
                        <TabsList className="bg-card border border-border">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="invoices">Invoices ({customer.invoices.length})</TabsTrigger>
                            <TabsTrigger value="payments">Payment History</TabsTrigger>
                        </TabsList>
                    </div>

                    {/* OVERVIEW TAB */}
                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {/* Personal Info */}
                            <Card className="bg-card/50 backdrop-blur border-border">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <User className="h-4 w-4 text-primary" />
                                        Personal Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="grid grid-cols-3 gap-1">
                                        <span className="text-muted-foreground">Full Name</span>
                                        <span className="col-span-2 font-medium">{customer.name}</span>
                                    </div>
                                    {isAdmin && (
                                        <div className="grid grid-cols-3 gap-1">
                                            <span className="text-muted-foreground">NIK</span>
                                            <span className="col-span-2 font-mono">{customer.nik || '-'}</span>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-3 gap-1">
                                        <span className="text-muted-foreground">Phone</span>
                                        <span className="col-span-2 font-mono">{customer.phone || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        <span className="text-muted-foreground">Area</span>
                                        <span className="col-span-2 font-medium">{customer.area?.name || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        <span className="text-muted-foreground">Address</span>
                                        <span className="col-span-2">{customer.address}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        <span className="text-muted-foreground">Joined</span>
                                        <span className="col-span-2">{formatDate(customer.join_date)}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Service Info */}
                            <Card className="bg-card/50 backdrop-blur border-border">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Network className="h-4 w-4 text-blue-500" />
                                        Service Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <DetailRow label="Status">
                                        {getStatusBadge(customer.status)}
                                    </DetailRow>
                                    <DetailRow label="Package">
                                        <span className="block truncate">{customer.package.name}</span>
                                    </DetailRow>
                                    <DetailRow label="Price">
                                        {formatCurrency(customer.package.price)} / mo
                                    </DetailRow>
                                    <DetailRow label="Package Profile">
                                        <ProfileValue value={customer.package.mikrotik_profile} />
                                    </DetailRow>
                                    <DetailRow label="Router Profile">
                                        <ProfileValue value={customer.mikrotik_profile || 'Unknown'} />
                                    </DetailRow>
                                    {customer.previous_profile && (
                                        <DetailRow label="Previous Profile">
                                            <ProfileValue value={customer.previous_profile} />
                                        </DetailRow>
                                    )}
                                </CardContent>
                            </Card>

                            {isAdmin && (
                                <Card className="bg-card/50 backdrop-blur border-border">
                                    <CardHeader>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    <Power className="h-4 w-4 text-amber-500" />
                                                    Network Enforcement
                                                </CardTitle>
                                                <CardDescription className="mt-1">
                                                    MikroTik isolation and reconnection readiness
                                                </CardDescription>
                                            </div>
                                            <Badge variant="outline" className={`shrink-0 border ${enforcementBadgeClass}`}>
                                                {enforcementLabel}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-3 gap-1">
                                                <span className="text-muted-foreground">Router</span>
                                                <span className="col-span-2 font-medium">{customer.router?.name || '-'}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1">
                                                <span className="text-muted-foreground">PPPoE User</span>
                                                <span className="col-span-2 font-mono text-xs bg-muted px-2 py-0.5 rounded w-fit">
                                                    {customer.pppoe_user || '-'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1 items-center">
                                                <span className="text-muted-foreground">Sync Status</span>
                                                <span className="col-span-2">{getStatusBadge(customer.mikrotik_sync_status || 'unknown')}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1">
                                                <span className="text-muted-foreground">Last Checked</span>
                                                <span className="col-span-2">
                                                    {customer.mikrotik_sync_checked_at ? formatDate(customer.mikrotik_sync_checked_at) : '-'}
                                                </span>
                                            </div>
                                        </div>

                                        {!canEnforceOnMikrotik && (
                                            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
                                                <div className="flex gap-2">
                                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                                    <p>{enforcementBlockers.join(' ')}</p>
                                                </div>
                                            </div>
                                        )}

                                        {canEnforceOnMikrotik && syncWarning && (
                                            <div className="flex gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
                                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                                <p>{syncWarning}</p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap justify-end gap-2 border-t border-border/50 pt-4">
                                            {!canEnforceOnMikrotik && (
                                                <Button asChild variant="outline" size="sm">
                                                    <Link href={route('customers.edit', customer.id)}>
                                                        Edit Network Info
                                                    </Link>
                                                </Button>
                                            )}
                                            <Button
                                                variant={customer.status === 'active' ? 'destructive' : 'default'}
                                                size="sm"
                                                onClick={handleToggleBlock}
                                                disabled={!canEnforceOnMikrotik}
                                            >
                                                {customer.status === 'active' ? 'Suspend Service' : 'Activate Service'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="bg-card/50 backdrop-blur border-border">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Network className="h-4 w-4 text-cyan-500" />
                                        OLT Telemetry
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <DetailRow label="OLT">
                                        <span>{customer.olt?.name || '-'}</span>
                                    </DetailRow>
                                    <DetailRow label="OLT Code">
                                        <span className="font-mono">{customer.olt?.code || '-'}</span>
                                    </DetailRow>
                                    <DetailRow label="Port">
                                        <span className="font-mono">{customer.olt_port_label || '-'}</span>
                                    </DetailRow>
                                    <DetailRow label="ONU Serial">
                                        <span className="font-mono">{customer.onu_serial || '-'}</span>
                                    </DetailRow>
                                    <DetailRow label="Status">
                                        {customer.olt_status ? getStatusBadge(customer.olt_status) : <span className="text-muted-foreground">-</span>}
                                    </DetailRow>
                                    <DetailRow label="Rx / Redaman">
                                        <span className="font-mono">{customer.onu_rx_power_dbm ?? '-'}{customer.onu_rx_power_dbm ? ' dBm' : ''}</span>
                                    </DetailRow>
                                    <DetailRow label="Tx Power">
                                        <span className="font-mono">{customer.onu_tx_power_dbm ?? '-'}{customer.onu_tx_power_dbm ? ' dBm' : ''}</span>
                                    </DetailRow>
                                    <DetailRow label="Distance">
                                        <span className="font-mono">{customer.fiber_distance_m ?? '-'}{customer.fiber_distance_m ? ' m' : ''}</span>
                                    </DetailRow>
                                    <DetailRow label="Last Sync">
                                        <span>{customer.olt_last_synced_at ? formatDate(customer.olt_last_synced_at) : '-'}</span>
                                    </DetailRow>
                                </CardContent>
                            </Card>

                            {/* Geo Info */}
                            <Card className="bg-card/50 backdrop-blur border-border">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-emerald-500" />
                                        Location
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="grid grid-cols-3 gap-1">
                                        <span className="text-muted-foreground">Latitude</span>
                                        <span className="col-span-2 font-mono">{customer.geo_lat || 'N/A'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        <span className="text-muted-foreground">Longitude</span>
                                        <span className="col-span-2 font-mono">{customer.geo_long || 'N/A'}</span>
                                    </div>
                                    <div className="mt-4 space-y-4">
                                        <div className="rounded-md overflow-hidden border border-border h-48">
                                            {customer.geo_lat && customer.geo_long ? (
                                                <MapPicker
                                                    initialLat={Number(customer.geo_lat)}
                                                    initialLong={Number(customer.geo_long)}
                                                />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground text-sm">
                                                    No coordinates available
                                                </div>
                                            )}
                                        </div>
                                        <Button variant="outline" size="sm" className="w-full" disabled={!customer.geo_lat} onClick={() => window.open(`https://www.google.com/maps?q=${customer.geo_lat},${customer.geo_long}`, '_blank')}>
                                            Open in Google Maps
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* KTP Photo Card */}
                            {isAdmin && (
                            <Card className="bg-card/50 backdrop-blur border-border">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <User className="h-4 w-4 text-violet-500" />
                                        KTP Photo
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {customer.ktp_photo_url ? (
                                        <div className="space-y-3">
                                            <div className="rounded-lg border border-border overflow-hidden h-48 bg-muted/30 flex items-center justify-center">
                                                <img
                                                    src={customer.ktp_photo_url}
                                                    alt="KTP Photo"
                                                    className="w-full h-full object-cover transition-transform hover:scale-105"
                                                />
                                            </div>
                                            <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(customer.ktp_photo_url!, '_blank')}>
                                                <Eye className="w-3.5 h-3.5 mr-2" />
                                                View Full Image
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border/50 rounded-lg bg-muted/20 text-muted-foreground gap-2">
                                            <User className="h-8 w-8 opacity-20" />
                                            <span className="text-xs">No KTP Photo Uploaded</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                            )}
                        </div>
                    </TabsContent>

                    {/* INVOICES TAB */}
                    <TabsContent value="invoices">
                        <Card className="bg-card/50 backdrop-blur border-border">
                            <CardHeader>
                                <CardTitle>Invoice History</CardTitle>
                                <CardDescription>All billing statements generated for this customer</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-border hover:bg-transparent">
                                            <TableHead>Invoice #</TableHead>
                                            <TableHead>Billing Period</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Due Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customer.invoices.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                    No invoices found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            customer.invoices.map((inv) => (
                                                <TableRow key={inv.id} className="border-border hover:bg-muted/50">
                                                    <TableCell className="font-mono">#{String(inv.id).padStart(6, '0')}</TableCell>
                                                    <TableCell>{periodDate(inv.period)}</TableCell>
                                                    <TableCell>{formatCurrency(inv.amount)}</TableCell>
                                                    <TableCell className={new Date(inv.due_date) < new Date() && inv.status === 'unpaid' ? 'text-destructive font-bold' : ''}>
                                                        {formatDate(inv.due_date)}
                                                    </TableCell>
                                                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <span className="sr-only">Open menu</span>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => router.visit(route('invoices.show', inv.id))}>
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    View Invoice
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* PAYMENTS TAB (Derived from invoice transactions) */}
                    <TabsContent value="payments">
                        <Card className="bg-card/50 backdrop-blur border-border">
                            <CardHeader>
                                <CardTitle>Payment History</CardTitle>
                                <CardDescription>Confimed transactions</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-border hover:bg-transparent">
                                            <TableHead>Date</TableHead>
                                            <TableHead>Invoice Ref</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead>Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customer.invoices.flatMap(inv => inv.transactions.map(t => ({ ...t, invoice_id: inv.id }))).length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                    No payments recorded yet.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            customer.invoices.flatMap(inv => inv.transactions.map(t => ({ ...t, invoice_id: inv.id })))
                                                .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
                                                .map((txn) => (
                                                    <TableRow key={txn.id} className="border-border hover:bg-muted/50">
                                                        <TableCell>{formatDate(txn.paid_at)}</TableCell>
                                                        <TableCell className="font-mono">INV-{String(txn.invoice_id).padStart(6, '0')}</TableCell>
                                                        <TableCell className="capitalize">{txn.method.replace('_', ' ')}</TableCell>
                                                        <TableCell className="font-medium text-emerald-500">
                                                            + {formatCurrency(txn.amount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {isAdmin && (
                <ConfirmDialog
                    open={confirmOpen}
                    onOpenChange={setConfirmOpen}
                    title={confirmAction === 'block' ? "Suspend Customer Service" : "Activate Customer Service"}
                    description={confirmAction === 'block'
                        ? "Are you sure you want to suspend this customer? Their status will be updated to ISOLATED."
                        : "Are you sure you want to activate this customer? Their status will be updated to ACTIVE."}
                    confirmText={confirmAction === 'block' ? "Suspend" : "Activate"}
                    variant={confirmAction === 'block' ? "destructive" : "default"}
                    onConfirm={confirmToggle}
                />
            )}
        </AuthenticatedLayout>
    );
}
