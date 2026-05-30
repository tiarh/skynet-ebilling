import { useCallback, useEffect, useRef, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { ConfirmDialog } from '@/Components/ConfirmDialog';
import { DetailSection } from '@/Components/DetailSection';
import { ResourcePageHeader } from '@/Components/ResourcePageHeader';
import { AlertCircle, Boxes, Edit, MapPin, Network, PlugZap, RefreshCw, Router as RouterIcon, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Badge } from '@/Components/ui/badge';

interface OltCustomer {
    id: number;
    code: string | null;
    name: string;
    pppoe_user: string | null;
    status: string;
    olt_port_label: string | null;
    onu_serial: string | null;
    olt_status: string | null;
    onu_rx_power_dbm: string | number | null;
    onu_tx_power_dbm: string | number | null;
    fiber_distance_m: number | null;
    olt_last_synced_at: string | null;
}

interface PonPortGroup {
    label: string;
    value: string;
    customers: OltCustomer[];
}

interface Props {
    olt: {
        id: number;
        name: string;
        code: string;
        vendor: string;
        management_ip: string | null;
        management_protocol: string | null;
        management_port: number | null;
        username: string | null;
        snmp_community: string | null;
        location: string | null;
        notes: string | null;
        area: { id: number; name: string } | null;
        router: { id: number; name: string } | null;
        customer_count: number;
        pon_port_groups: PonPortGroup[];
        last_gpon_snapshot: GponSnapshot | null;
        last_gpon_synced_at: string | null;
    };
}

interface GponOnuSnapshot {
    onu_ref: string;
    pon_port: string | null;
    state: string | null;
    phase_state: string | null;
    serial_number: string | null;
    onu_name: string | null;
    rx_power_dbm: number | null;
    distance_m: number | null;
    detail_raw: string | null;
}

interface MatchedCustomerSnapshot {
    customer_id: number;
    customer_name: string;
    pppoe_user: string;
    onu_ref: string | null;
    rx_power_dbm: number | null;
    distance_m: number | null;
    changed?: boolean;
}

interface GponSnapshot {
    meta: {
        olt: string;
        host: string;
        port: number;
        protocol: string;
        collected_at: string;
        pon_ports_count: number;
        onus_count: number;
        matched_customers_count: number;
        updated_customers_count?: number;
        warning?: string | null;
    };
    pon_ports: Array<{ name: string }>;
    onus: GponOnuSnapshot[];
    raw: {
        state: string;
        baseinfo: Record<string, string>;
        power: Record<string, string>;
        distance: Record<string, string>;
    };
    commands: string[];
    matched_customers: MatchedCustomerSnapshot[];
}

type SnapshotFilter = 'all' | 'online' | 'offline' | 'matched' | 'unmatched';

export default function Show({ olt }: Props) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [snapshot, setSnapshot] = useState<GponSnapshot | null>(olt.last_gpon_snapshot);
    const [snapshotLoading, setSnapshotLoading] = useState(false);
    const [snapshotError, setSnapshotError] = useState<string | null>(null);
    const [snapshotFilter, setSnapshotFilter] = useState<SnapshotFilter>('all');
    const autoSnapshotLoaded = useRef(false);

    const syncGponSnapshot = useCallback(async () => {
        setSnapshotLoading(true);
        setSnapshotError(null);

        try {
            const response = await fetch(route('api.olts.gpon-snapshot', olt.id), {
                headers: {
                    Accept: 'application/json',
                },
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Failed to load OLT GPON data.');
            }

            setSnapshot(payload);
            router.reload({ only: ['olt'] });
        } catch (error) {
            setSnapshotError(error instanceof Error ? error.message : 'Failed to load OLT GPON data.');
        } finally {
            setSnapshotLoading(false);
        }
    }, [olt.id]);

    useEffect(() => {
        if (autoSnapshotLoaded.current || snapshot || !olt.management_ip) {
            return;
        }

        autoSnapshotLoaded.current = true;
        void syncGponSnapshot();
    }, [olt.management_ip, snapshot, syncGponSnapshot]);

    const statusBadge = (status: string | null) => {
        if (!status) {
            return <span className="text-muted-foreground">-</span>;
        }

        const normalized = status.toLowerCase();

        return (
            <Badge variant={normalized === 'online' || normalized === 'active' ? 'default' : 'secondary'}>
                {status.replace('_', ' ')}
            </Badge>
        );
    };

    const matchedOnuRefs = new Set(
        (snapshot?.matched_customers ?? [])
            .map((customer) => customer.onu_ref?.toLowerCase())
            .filter((value): value is string => Boolean(value)),
    );
    const onlineOnuCount = snapshot?.onus.filter((onu) => onu.state?.toLowerCase() === 'online').length ?? 0;
    const offlineOnuCount = snapshot?.onus.filter((onu) => onu.state?.toLowerCase() === 'offline').length ?? 0;
    const matchedOnuCount = snapshot?.onus.filter((onu) => matchedOnuRefs.has(onu.onu_ref.toLowerCase())).length ?? 0;
    const unmatchedOnuCount = (snapshot?.onus.length ?? 0) - matchedOnuCount;
    const filteredOnus = (snapshot?.onus ?? []).filter((onu) => {
        if (snapshotFilter === 'online') {
            return onu.state?.toLowerCase() === 'online';
        }

        if (snapshotFilter === 'offline') {
            return onu.state?.toLowerCase() === 'offline';
        }

        if (snapshotFilter === 'matched') {
            return matchedOnuRefs.has(onu.onu_ref.toLowerCase());
        }

        if (snapshotFilter === 'unmatched') {
            return !matchedOnuRefs.has(onu.onu_ref.toLowerCase());
        }

        return true;
    });
    const filterItems: Array<{ key: SnapshotFilter; label: string; count: number }> = [
        { key: 'all', label: 'Total ONU', count: snapshot?.onus.length ?? 0 },
        { key: 'online', label: 'Online', count: onlineOnuCount },
        { key: 'offline', label: 'Offline', count: offlineOnuCount },
        { key: 'matched', label: 'Matched', count: matchedOnuCount },
        { key: 'unmatched', label: 'Belum Match', count: unmatchedOnuCount },
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'OLTs', href: route('olts.index') },
                { label: olt.name },
            ]}
            header={
                <ResourcePageHeader
                    title={olt.name}
                    backHref={route('olts.index')}
                    actions={
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-2"
                                onClick={() => router.post(route('olts.test', olt.id))}
                            >
                                <PlugZap className="h-3.5 w-3.5" />
                                Test Connection
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-2"
                                onClick={syncGponSnapshot}
                                disabled={snapshotLoading}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${snapshotLoading ? 'animate-spin' : ''}`} />
                                Refresh From OLT
                            </Button>
                            <Button asChild variant="outline" size="sm" className="h-8 gap-2">
                                <Link href={route('olts.edit', olt.id)}>
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
            <Head title={`OLT: ${olt.name}`} />

            <div className="py-8">
                <div className="mx-auto max-w-5xl space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">OLT Code</CardTitle>
                                <Boxes className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="font-mono text-2xl font-bold">{olt.code}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Management IP</CardTitle>
                                <Network className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="font-mono text-lg font-bold">
                                    {olt.management_ip ? `${olt.management_ip}:${olt.management_port || '-'}` : '-'}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Area</CardTitle>
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg font-bold">{olt.area?.name || '-'}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Router</CardTitle>
                                <RouterIcon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg font-bold">{olt.router?.name || '-'}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <DetailSection title="OLT Details">
                        <dl className="grid gap-4 md:grid-cols-2">
                            <div>
                                <dt className="text-sm text-muted-foreground">Name</dt>
                                <dd className="mt-1 font-medium">{olt.name}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Location</dt>
                                <dd className="mt-1 font-medium">{olt.location || '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Management IP</dt>
                                <dd className="mt-1 font-mono font-medium">{olt.management_ip || '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Protocol</dt>
                                <dd className="mt-1 font-medium uppercase">{olt.management_protocol || '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Port</dt>
                                <dd className="mt-1 font-mono font-medium">{olt.management_port || '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Username</dt>
                                <dd className="mt-1 font-medium">{olt.username || '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">SNMP Community</dt>
                                <dd className="mt-1 font-medium">{olt.snmp_community || '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Code</dt>
                                <dd className="mt-1 font-mono font-medium">{olt.code}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Vendor</dt>
                                <dd className="mt-1 font-medium uppercase">{olt.vendor?.replace('_', ' ') || '-'}</dd>
                            </div>
                        </dl>
                    </DetailSection>

                    <DetailSection title="Notes">
                        <p className="whitespace-pre-wrap text-sm text-foreground">{olt.notes || 'No notes yet.'}</p>
                    </DetailSection>

                    <DetailSection title="GPON Snapshot">
                        <div className="space-y-4">
                            {snapshotError && (
                                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                                    <div className="flex items-center gap-2 font-medium">
                                        <AlertCircle className="h-4 w-4" />
                                        {snapshotError}
                                    </div>
                                </div>
                            )}

                            {snapshot?.meta.warning && (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700">
                                    {snapshot.meta.warning}
                                </div>
                            )}

                            {!snapshot && !snapshotLoading && (
                                <p className="text-sm text-muted-foreground">
                                    Menunggu data OLT. Sistem akan mengambil daftar ONU, status, redaman, dan jarak otomatis saat halaman dibuka.
                                </p>
                            )}

                            {snapshot && (
                                <>
                                    <div className="grid gap-3 md:grid-cols-5">
                                        {filterItems.map((item) => (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => setSnapshotFilter(item.key)}
                                                className={`rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 ${
                                                    snapshotFilter === item.key ? 'border-primary ring-2 ring-primary/15' : 'border-border/60'
                                                }`}
                                            >
                                                <div className="text-sm font-medium text-muted-foreground">{item.label}</div>
                                                <div className="mt-2 text-2xl font-bold">{item.count}</div>
                                            </button>
                                        ))}
                                    </div>

                                    {olt.last_gpon_synced_at && (
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                            <span>
                                                Snapshot tersimpan terakhir: {new Date(olt.last_gpon_synced_at).toLocaleString('id-ID')}. Protocol {snapshot.meta.protocol.toUpperCase()}, PON aktif {snapshot.meta.pon_ports_count}.
                                            </span>
                                            <span className="font-medium">
                                                Showing {filteredOnus.length} of {snapshot.onus.length}
                                            </span>
                                        </div>
                                    )}

                                    <div className="rounded-2xl border border-border/60 overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>PON Port</TableHead>
                                                    <TableHead>ONU Ref</TableHead>
                                                    <TableHead>PPPoE Name</TableHead>
                                                    <TableHead>State</TableHead>
                                                    <TableHead>Phase</TableHead>
                                                    <TableHead>Serial</TableHead>
                                                    <TableHead>RX (dBm)</TableHead>
                                                    <TableHead>Distance (m)</TableHead>
                                                    <TableHead>Match</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredOnus.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                                                            Tidak ada ONU untuk filter ini.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    filteredOnus.map((onu) => (
                                                        <TableRow key={onu.onu_ref}>
                                                            <TableCell className="font-mono text-xs">{onu.pon_port || '-'}</TableCell>
                                                            <TableCell className="font-mono text-xs">{onu.onu_ref}</TableCell>
                                                            <TableCell className="font-mono text-xs">{onu.onu_name || '-'}</TableCell>
                                                            <TableCell>
                                                                {onu.state ? (
                                                                    <Badge variant={onu.state === 'online' ? 'default' : 'secondary'}>{onu.state}</Badge>
                                                                ) : '-'}
                                                            </TableCell>
                                                            <TableCell>{onu.phase_state || '-'}</TableCell>
                                                            <TableCell className="font-mono text-xs">{onu.serial_number || '-'}</TableCell>
                                                            <TableCell>{onu.rx_power_dbm ?? '-'}</TableCell>
                                                            <TableCell>{onu.distance_m ?? '-'}</TableCell>
                                                            <TableCell>
                                                                {matchedOnuRefs.has(onu.onu_ref.toLowerCase()) ? (
                                                                    <Badge variant="default">matched</Badge>
                                                                ) : (
                                                                    <Badge variant="secondary">belum match</Badge>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                </>
                            )}
                        </div>
                    </DetailSection>
                </div>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Delete OLT?"
                description={`Are you sure you want to delete ${olt.name}? This action cannot be undone.`}
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => router.delete(route('olts.destroy', olt.id), {
                    onFinish: () => setConfirmOpen(false),
                })}
            />
        </AuthenticatedLayout>
    );
}
