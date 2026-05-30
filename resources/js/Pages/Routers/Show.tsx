import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Textarea } from '@/Components/ui/textarea';
import { Switch } from '@/Components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/Components/ui/alert';
import { ArrowLeft, Server, Wifi, Activity, Users, RefreshCw, Edit, Trash2, Search, AlertCircle, ChevronLeft, ChevronRight, KeyRound, ShieldCheck, Copy } from 'lucide-react';
import { Skeleton } from '@/Components/ui/skeleton';
import { ConfirmDialog } from '@/Components/ConfirmDialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/Components/ui/dialog";
import { FormEvent, useState, useEffect } from 'react';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import RouterCustomersTable from './Partials/RouterCustomersTable';
import { RouterStatusBadge, SyncStatus } from '@/Components/RouterStatusBadge';

interface Customer {
    id: number;
    name: string;
    code: string;
    pppoe_user: string;
    status: string;
    package: {
        name: string;
        price: number;
    } | null;
}

interface ActiveConnection {
    name: string;
    address: string;
    uptime: string;
    encoding: string;
    caller_id: string;
}

interface LiveStats {
    data: {
        active_connections: ActiveConnection[];
        total_online: number;
        system_info: any;
    };
    last_updated: string;
    cached?: boolean;
}

interface PaginatedCustomers {
    data: Customer[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

interface RouterData {
    id: number;
    name: string;
    ip_address: string;
    port: number;
    username: string;
    is_active: boolean;
    connection_status: 'unknown' | 'online' | 'offline';
    created_at: string;
    customers_count: number;
    staged_unmatched_customers_count?: number;
    last_scanned_at: string | null;
    last_scan_customers_count: number;
    total_pppoe_count: number;
    sync_status: SyncStatus;
    sync_started_at: string | null;
    sync_finished_at: string | null;
    sync_lock_until: string | null;
    sync_message: string | null;
    vpn_enabled: boolean;
    vpn_interface: string | null;
    vpn_address: string | null;
    vpn_server_address: string | null;
    vpn_server_public_key: string | null;
    vpn_server_endpoint: string | null;
    vpn_server_port: number | null;
    vpn_allowed_ips: string | null;
    vpn_client_private_key: string | null;
    vpn_client_public_key: string | null;
    vpn_preshared_key: string | null;
    radius_enabled: boolean;
    radius_secret: string | null;
    radius_auth_port: number | null;
    radius_acct_port: number | null;
    last_radius_synced_at: string | null;
    isolation_profile: string | null;
    last_sync_stats: {
        total_secrets?: number;
        mapped?: number;
        unmatched_mikrotik?: number;
        staged_router_only?: number;
        staged_gone?: number;
        not_found_ebilling?: number;
        synced_status?: number;
    } | null;
    profiles: Array<{
        name: string;
        rate_limit?: string;
        bandwidth?: string;
        local_address?: string;
        remote_address?: string;
    }>;
}

interface Props {
    router: RouterData;
    vpn: {
        mikrotik_script: string;
        server_peer_config: string;
        radius_tables_ready: boolean;
        defaults: {
            vpn_interface: string;
            vpn_server_address: string;
            vpn_server_public_key: string | null;
            vpn_server_endpoint: string;
            vpn_server_port: number;
            vpn_allowed_ips: string;
            radius_auth_port: number;
            radius_acct_port: number;
        };
    };
}

// SWR fetcher
const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const data = await res.json();
        const error: any = new Error(data.error || 'An error occurred while fetching the data.');
        error.info = data;
        error.status = res.status;
        throw error;
    }
    return res.json();
};

export default function Show({ router: routerData, vpn }: Props) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteIsolationDialogOpen, setDeleteIsolationDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [copied, setCopied] = useState<string | null>(null);
    const vpnForm = useForm({
        vpn_enabled: routerData.vpn_enabled ?? false,
        vpn_interface: routerData.vpn_interface || vpn.defaults.vpn_interface || 'wg-ebilling',
        vpn_address: routerData.vpn_address || '',
        vpn_server_address: routerData.vpn_server_address || vpn.defaults.vpn_server_address || '10.99.0.1',
        vpn_server_public_key: routerData.vpn_server_public_key || vpn.defaults.vpn_server_public_key || '',
        vpn_server_endpoint: routerData.vpn_server_endpoint || vpn.defaults.vpn_server_endpoint || '',
        vpn_server_port: routerData.vpn_server_port || vpn.defaults.vpn_server_port || 51820,
        vpn_allowed_ips: routerData.vpn_allowed_ips || vpn.defaults.vpn_allowed_ips || '10.99.0.0/24',
        radius_enabled: routerData.radius_enabled ?? false,
        radius_secret: routerData.radius_secret || '',
        radius_auth_port: routerData.radius_auth_port || vpn.defaults.radius_auth_port || 1812,
        radius_acct_port: routerData.radius_acct_port || vpn.defaults.radius_acct_port || 1813,
        generate_client_keys: !routerData.vpn_client_public_key,
    });
    const isolationProfile = routerData.isolation_profile || 'isolirebilling';
    const isolationForm = useForm({
        isolation_profile: isolationProfile,
        isolation_rate_limit: '128k/128k',
        isolation_local_address: '',
        isolation_remote_address: '',
    });

    // Use SWR for live stats with smart caching
    const { data: liveStats, error: statsError, isLoading: isLoadingStats, mutate } = useSWR<LiveStats>(
        `/api/routers/${routerData.id}/live-stats`,
        fetcher,
        {
            refreshInterval: 60000, // Refresh every 60 seconds (matches backend cache)
            revalidateOnFocus: false,
            dedupingInterval: 30000,
        }
    );

    const [isRefreshing, setIsRefreshing] = useState(false);
    const isSyncActive = ['queued', 'running'].includes(routerData.sync_status);

    useEffect(() => {
        if (!isSyncActive) {
            return;
        }

        const timer = window.setInterval(() => {
            router.reload({
                only: ['router'],
            });
        }, 3000);

        return () => window.clearInterval(timer);
    }, [isSyncActive]);

    // Manual Refresh (Overrides Scheduled Sync)
    const handleRefresh = () => {
        setIsRefreshing(true);
        router.post(`/routers/${routerData.id}/sync`, {}, {
            preserveScroll: true,
            preserveState: true,
            only: ['router', 'flash'],
            onSuccess: () => {
                mutate(); // Trigger refresh but don't wait for it
            },
            onFinish: () => setIsRefreshing(false),
        });
    };

    const handleDelete = () => {
        router.delete(route('routers.destroy', routerData.id));
        setDeleteDialogOpen(false);
    };

    const handleVpnSubmit = (e: FormEvent) => {
        e.preventDefault();
        vpnForm.post(route('routers.vpn.update', routerData.id), {
            preserveScroll: true,
            preserveState: false,
        });
    };

    const handleRadiusSync = () => {
        router.post(route('routers.radius.sync', routerData.id), {}, {
            preserveScroll: true,
        });
    };

    const handleIsolationProfileSubmit = (e: FormEvent) => {
        e.preventDefault();
        isolationForm.post(route('routers.isolation-profile.store', routerData.id), {
            preserveScroll: true,
            preserveState: false,
        });
    };

    const handleIsolationProfileDelete = () => {
        router.delete(route('routers.isolation-profile.destroy', routerData.id), {
            preserveScroll: true,
            preserveState: false,
            onFinish: () => setDeleteIsolationDialogOpen(false),
        });
    };

    const copyToClipboard = async (key: string, value: string) => {
        await navigator.clipboard.writeText(value);
        setCopied(key);
        window.setTimeout(() => setCopied(null), 1600);
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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Routers', href: route('routers.index') },
                { label: routerData.name }
            ]}
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={route('routers.index')}>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h2 className="text-xl font-semibold leading-tight text-foreground">
                                {routerData.name}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {routerData.ip_address}:{routerData.port}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={route('routers.edit', routerData.id)}>
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
                                    <DialogTitle>Delete Router</DialogTitle>
                                    <DialogDescription>
                                        Are you sure you want to delete this router? This action cannot be undone.
                                        {routerData.customers_count > 0 && (
                                            <p className="mt-2 text-red-500 font-medium">
                                                Warning: This router has {routerData.customers_count} assigned customer(s).
                                            </p>
                                        )}
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button variant="destructive" onClick={handleDelete}>
                                        Delete Router
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            }
        >
            <Head title={`Router: ${routerData.name}`} />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        {/* ... TabsList unchanged ... */}
                        <TabsList>
                            <TabsTrigger value="overview">
                                <Server className="h-4 w-4 mr-2" />
                                Overview
                            </TabsTrigger>
                            <TabsTrigger value="customers">
                                <Users className="h-4 w-4 mr-2" />
                                Customers ({routerData.customers_count})
                            </TabsTrigger>
                            <TabsTrigger value="profiles">
                                <Activity className="h-4 w-4 mr-2" />
                                Profiles ({String(routerData.profiles?.length || 0)})
                            </TabsTrigger>
                            <TabsTrigger value="vpn">
                                <KeyRound className="h-4 w-4 mr-2" />
                                VPN & RADIUS
                            </TabsTrigger>
                        </TabsList>

                        {/* Overview Tab */}
                        <TabsContent value="overview" className="space-y-6">
                            {/* Stats Grid */}
                            <div className="grid gap-6 md:grid-cols-3">
                                {/* ... Status Card unchanged ... */}
                                <Card className="border-border bg-card">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Connection Status
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Badge
                                            variant={routerData.connection_status === 'online' ? 'default' : 'secondary'}
                                            className={routerData.connection_status === 'online' ? 'bg-emerald-500' : routerData.connection_status === 'offline' ? 'bg-red-500' : ''}
                                        >
                                            {routerData.connection_status === 'online' ? 'Online' :
                                                routerData.connection_status === 'offline' ? 'Offline' : 'Unknown'}
                                        </Badge>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            {routerData.is_active ? 'Monitoring enabled' : 'Monitoring disabled'}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* ... Online/Total Card unchanged ... */}
                                <Card className="border-border bg-card">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Online / Total
                                        </CardTitle>
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        {isLoadingStats ? (
                                            <Skeleton className="h-8 w-20" />
                                        ) : statsError ? (
                                            <div className="flex items-center text-sm text-red-500" title={statsError?.message || 'Failed to fetch stats'}>
                                                <AlertCircle className="h-4 w-4 mr-1" />
                                                {statsError?.message === 'Stream timed out' ? 'Unreachable' : 'Connection Failed'}
                                            </div>
                                        ) : (
                                            <div className="text-2xl font-bold">
                                                <span className="text-emerald-600">{liveStats?.data?.total_online || 0}</span>
                                                <span className="text-muted-foreground"> / {routerData.total_pppoe_count || routerData.customers_count}</span>
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {liveStats ? `Updated ${formatDistanceToNow(new Date(liveStats.last_updated))} ago` : 'Loading...'}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* ... API Port Card unchanged ... */}
                                <Card className="border-border bg-card">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            API Port
                                        </CardTitle>
                                        <Server className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{routerData.port}</div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            RouterOS API
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Last Scan Info - Always Visible */}
                            <Card className="border-border bg-card">
                                <CardContent className="pt-6">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3">
                                            <Activity className="h-5 w-5 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium">Last Full Sync</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {routerData.last_scanned_at
                                                        ? `${formatDistanceToNow(new Date(routerData.last_scanned_at))} ago • Found ${routerData.last_scan_customers_count} customers`
                                                        : 'Never synced'
                                                    }
                                                </p>
                                                {routerData.sync_message && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {routerData.sync_message}
                                                    </p>
                                                )}
                                                {routerData.last_sync_stats && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {routerData.last_sync_stats.mapped ?? 0} mapped • {routerData.last_sync_stats.staged_router_only ?? routerData.last_sync_stats.unmatched_mikrotik ?? 0} router-only staged • {routerData.last_sync_stats.not_found_ebilling ?? 0} eBilling missing
                                                    </p>
                                                )}
                                                {(routerData.staged_unmatched_customers_count || 0) > 0 && (
                                                    <p className="mt-1 text-xs font-medium text-orange-600">
                                                        {routerData.staged_unmatched_customers_count} router-only PPPoE secret(s) need review.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 self-start sm:self-center">
                                            <RouterStatusBadge
                                                connectionStatus={routerData.connection_status}
                                                syncStatus={routerData.sync_status || 'idle'}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleRefresh}
                                                disabled={isRefreshing || isSyncActive}
                                                title={isSyncActive ? 'Full sync is already running' : routerData.is_active ? "Force Manual Sync" : "Sync to Reactivate Router"}
                                            >
                                                <RefreshCw className={`h-4 w-4 ${(isRefreshing || isSyncActive) ? 'animate-spin' : ''}`} />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Active Connections */}
                            {liveStats?.data?.active_connections && Array.isArray(liveStats.data.active_connections) && liveStats.data.active_connections.length > 0 && (
                                <Card className="border-border bg-card">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle>Active Connections</CardTitle>
                                            <Badge variant="outline" className="text-emerald-600">
                                                {liveStats.data.total_online} online
                                            </Badge>
                                        </div>
                                        <CardDescription>
                                            Currently connected PPPoE sessions (showing first 10)
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {liveStats.data.active_connections.slice(0, 10).map((conn, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                                    <div>
                                                        <p className="font-medium">{conn.name}</p>
                                                        <p className="text-xs text-muted-foreground">{conn.address}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-mono text-emerald-600">{conn.uptime}</p>
                                                        <p className="text-xs text-muted-foreground">{conn.encoding}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Configuration Details */}
                            <Card className="border-border bg-card">
                                <CardHeader>
                                    <CardTitle>Router Configuration</CardTitle>
                                    <CardDescription>
                                        Technical details and credentials
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Router Name</p>
                                            <p className="text-base font-semibold mt-1">{routerData.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Username</p>
                                            <p className="text-base font-mono mt-1">{routerData.username}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                                            <p className="text-base font-mono mt-1">{routerData.ip_address}:{routerData.port}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Created</p>
                                            <p className="text-base mt-1">{formatDate(routerData.created_at)}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Customers Tab */}
                        <TabsContent value="customers">
                            <Card className="border-border bg-card">
                                <CardHeader>
                                    <CardTitle>Customers</CardTitle>
                                    <CardDescription>
                                        Managed customers assigned to this router.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {activeTab === 'customers' && (
                                        <RouterCustomersTable
                                            routerId={routerData.id}
                                            activeConnections={liveStats?.data?.active_connections || []}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Profiles Tab */}
                        <TabsContent value="profiles" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Synced Profiles</CardTitle>
                                    <CardDescription>
                                        PPP Profiles synced from this router. Used for creating packages.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {(!routerData.profiles || routerData.profiles.length === 0) ? (
                                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                                            <h3 className="text-lg font-medium">No Profiles Synced</h3>
                                            <p className="text-muted-foreground mb-4">
                                                Run a "Full Sync" to fetch profiles from the router.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {routerData.profiles.map((profile) => (
                                                <div key={profile.name} className="flex items-start justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-mono font-semibold text-lg">{profile.name}</span>
                                                            {profile.bandwidth && (
                                                                <Badge variant="secondary">{profile.bandwidth}</Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground font-mono space-y-1">
                                                            {profile.rate_limit && (
                                                                <div className="flex items-center gap-1">
                                                                    <Activity className="h-3 w-3" />
                                                                    {profile.rate_limit}
                                                                </div>
                                                            )}
                                                            {profile.local_address && (
                                                                <div className="flex items-center gap-1">
                                                                    <Server className="h-3 w-3" />
                                                                    Local: {profile.local_address}
                                                                </div>
                                                            )}
                                                            {profile.remote_address && (
                                                                <div className="flex items-center gap-1">
                                                                    <Wifi className="h-3 w-3" />
                                                                    Remote: {profile.remote_address}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="vpn" className="space-y-6">
                            <Alert>
                                <ShieldCheck className="h-4 w-4" />
                                <AlertTitle>WireGuard transport for MikroTik</AlertTitle>
                                <AlertDescription>
                                    Use this tab to prepare a MikroTik peer that dials into the VPS, then point PPP RADIUS to the VPS tunnel address. Keep the RouterOS API IP set to the MikroTik VPN IP after it connects.
                                </AlertDescription>
                            </Alert>

                            <form onSubmit={handleIsolationProfileSubmit}>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Isolation Profile</CardTitle>
                                        <CardDescription>
                                            Create or update the PPP profile used by Suspend Service.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="isolation_profile">Profile name</Label>
                                                <Input
                                                    id="isolation_profile"
                                                    value={isolationForm.data.isolation_profile}
                                                    onChange={(e) => isolationForm.setData('isolation_profile', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="isolation_rate_limit">Rate limit</Label>
                                                <Input
                                                    id="isolation_rate_limit"
                                                    placeholder="128k/128k"
                                                    value={isolationForm.data.isolation_rate_limit}
                                                    onChange={(e) => isolationForm.setData('isolation_rate_limit', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="isolation_local_address">Local address</Label>
                                                <Input
                                                    id="isolation_local_address"
                                                    placeholder="e.g. 192.168.200.1"
                                                    value={isolationForm.data.isolation_local_address}
                                                    onChange={(e) => isolationForm.setData('isolation_local_address', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="isolation_remote_address">Remote address</Label>
                                                <Input
                                                    id="isolation_remote_address"
                                                    placeholder="e.g. isolir-pool"
                                                    value={isolationForm.data.isolation_remote_address}
                                                    onChange={(e) => isolationForm.setData('isolation_remote_address', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            If you enter a pool name in Remote address and an IPv4 Local address, the router will auto-create an IP pool from that subnet and exclude the local IP.
                                        </p>
                                        <div className="flex items-center justify-between border-t pt-4">
                                            <div className="text-sm text-muted-foreground">
                                                Current isolation profile: <span className="font-mono">{isolationProfile}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    onClick={() => setDeleteIsolationDialogOpen(true)}
                                                    disabled={isolationForm.processing || !routerData.isolation_profile}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete Profile
                                                </Button>
                                                <Button type="submit" disabled={isolationForm.processing}>
                                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                                    {isolationForm.processing ? 'Saving...' : 'Create Isolir Profile'}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </form>

                            <form onSubmit={handleVpnSubmit} className="grid gap-6 lg:grid-cols-[1fr_420px]">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>VPN Provisioning</CardTitle>
                                        <CardDescription>
                                            Generate a MikroTik WireGuard peer and store RADIUS settings for PPPoE authentication.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="flex items-center gap-3 rounded-lg border p-4">
                                                <Switch
                                                    id="vpn_enabled"
                                                    checked={vpnForm.data.vpn_enabled}
                                                    onCheckedChange={(checked) => vpnForm.setData('vpn_enabled', checked)}
                                                />
                                                <div>
                                                    <Label htmlFor="vpn_enabled" className="font-medium">Enable VPN mode</Label>
                                                    <p className="text-xs text-muted-foreground">Router management will use the tunnel IP.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 rounded-lg border p-4">
                                                <Switch
                                                    id="radius_enabled"
                                                    checked={vpnForm.data.radius_enabled}
                                                    onCheckedChange={(checked) => vpnForm.setData('radius_enabled', checked)}
                                                />
                                                <div>
                                                    <Label htmlFor="radius_enabled" className="font-medium">Enable RADIUS sync</Label>
                                                    <p className="text-xs text-muted-foreground">Customers are written to FreeRADIUS tables.</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="vpn_interface">MikroTik interface</Label>
                                                <Input id="vpn_interface" value={vpnForm.data.vpn_interface} onChange={(e) => vpnForm.setData('vpn_interface', e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="vpn_address">MikroTik VPN address</Label>
                                                <Input id="vpn_address" placeholder="10.99.0.2/24" value={vpnForm.data.vpn_address} onChange={(e) => vpnForm.setData('vpn_address', e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="vpn_server_address">VPS RADIUS tunnel IP</Label>
                                                <Input id="vpn_server_address" value={vpnForm.data.vpn_server_address} onChange={(e) => vpnForm.setData('vpn_server_address', e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="vpn_server_endpoint">VPS public endpoint</Label>
                                                <Input id="vpn_server_endpoint" placeholder="152.42.230.231" value={vpnForm.data.vpn_server_endpoint} onChange={(e) => vpnForm.setData('vpn_server_endpoint', e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="vpn_server_port">WireGuard port</Label>
                                                <Input id="vpn_server_port" type="number" value={vpnForm.data.vpn_server_port} onChange={(e) => vpnForm.setData('vpn_server_port', Number(e.target.value) || 51820)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="vpn_allowed_ips">Allowed IPs</Label>
                                                <Input id="vpn_allowed_ips" value={vpnForm.data.vpn_allowed_ips} onChange={(e) => vpnForm.setData('vpn_allowed_ips', e.target.value)} />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="vpn_server_public_key">VPS WireGuard public key</Label>
                                            <Input id="vpn_server_public_key" value={vpnForm.data.vpn_server_public_key} onChange={(e) => vpnForm.setData('vpn_server_public_key', e.target.value)} />
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="radius_secret">RADIUS secret</Label>
                                                <Input id="radius_secret" value={vpnForm.data.radius_secret} onChange={(e) => vpnForm.setData('radius_secret', e.target.value)} placeholder="Shared secret" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="radius_auth_port">Auth port</Label>
                                                <Input id="radius_auth_port" type="number" value={vpnForm.data.radius_auth_port} onChange={(e) => vpnForm.setData('radius_auth_port', Number(e.target.value) || 1812)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="radius_acct_port">Accounting port</Label>
                                                <Input id="radius_acct_port" type="number" value={vpnForm.data.radius_acct_port} onChange={(e) => vpnForm.setData('radius_acct_port', Number(e.target.value) || 1813)} />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 rounded-lg border p-4">
                                            <Switch
                                                id="generate_client_keys"
                                                checked={vpnForm.data.generate_client_keys}
                                                onCheckedChange={(checked) => vpnForm.setData('generate_client_keys', checked)}
                                            />
                                            <div>
                                                <Label htmlFor="generate_client_keys" className="font-medium">Generate new MikroTik keys on save</Label>
                                                <p className="text-xs text-muted-foreground">Requires wireguard-tools on the VPS. Turn off to keep existing keys.</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between border-t pt-4">
                                            <div className="text-sm text-muted-foreground">
                                                Radius tables: {vpn.radius_tables_ready ? 'ready' : 'not found'}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button type="button" variant="outline" onClick={handleRadiusSync} disabled={!routerData.radius_enabled}>
                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                    Sync RADIUS Users
                                                </Button>
                                                <Button type="submit" disabled={vpnForm.processing}>
                                                    <KeyRound className="mr-2 h-4 w-4" />
                                                    {vpnForm.processing ? 'Saving...' : 'Save VPN'}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="space-y-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>MikroTik Script</CardTitle>
                                            <CardDescription>Paste this script in MikroTik terminal after saving.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <Textarea readOnly value={vpn.mikrotik_script} className="min-h-[260px] font-mono text-xs" />
                                            <Button type="button" variant="outline" className="w-full" onClick={() => copyToClipboard('mikrotik', vpn.mikrotik_script)}>
                                                <Copy className="mr-2 h-4 w-4" />
                                                {copied === 'mikrotik' ? 'Copied' : 'Copy MikroTik Script'}
                                            </Button>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Server Peer</CardTitle>
                                            <CardDescription>Add this peer block to the VPS WireGuard server.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <Textarea readOnly value={vpn.server_peer_config} className="min-h-[160px] font-mono text-xs" />
                                            <Button type="button" variant="outline" className="w-full" onClick={() => copyToClipboard('server', vpn.server_peer_config)}>
                                                <Copy className="mr-2 h-4 w-4" />
                                                {copied === 'server' ? 'Copied' : 'Copy Server Peer'}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </div>
                            </form>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            <ConfirmDialog
                open={deleteIsolationDialogOpen}
                onOpenChange={setDeleteIsolationDialogOpen}
                title="Delete Isolation Profile?"
                description={`Delete isolation profile ${routerData.isolation_profile || isolationProfile} from this router? The saved router reference will also be cleared.`}
                confirmText="Delete"
                variant="destructive"
                onConfirm={handleIsolationProfileDelete}
            />
        </AuthenticatedLayout>
    );
}
