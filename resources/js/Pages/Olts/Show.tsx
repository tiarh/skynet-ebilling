import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { ConfirmDialog } from '@/Components/ConfirmDialog';
import { DetailSection } from '@/Components/DetailSection';
import { ResourcePageHeader } from '@/Components/ResourcePageHeader';
import {
    AlertCircle, Boxes, Edit, MapPin, Network, PlugZap, RefreshCw,
    Router as RouterIcon, Trash2, Search, ChevronLeft, ChevronRight,
    ArrowUpDown, ArrowUp, ArrowDown, Eye, Power, Trash, Zap,
    Signal, SignalZero, ChevronDown
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Badge } from '@/Components/ui/badge';
import { Input } from '@/Components/ui/input';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/Components/ui/select';

interface OltCustomer {
    id: number; code: string | null; name: string; pppoe_user: string | null;
    status: string; olt_port_label: string | null; onu_serial: string | null;
    olt_status: string | null; onu_rx_power_dbm: string | number | null;
    onu_tx_power_dbm: string | number | null; fiber_distance_m: number | null;
    olt_last_synced_at: string | null;
}

interface PonPortGroup { label: string; value: string; customers: OltCustomer[]; }

interface Props {
    olt: {
        id: number; name: string; code: string; vendor: string;
        management_ip: string | null; management_protocol: string | null;
        management_port: number | null; username: string | null;
        snmp_community: string | null; location: string | null; notes: string | null;
        area: { id: number; name: string } | null;
        router: { id: number; name: string } | null;
        customer_count: number; pon_port_groups: PonPortGroup[];
        last_gpon_snapshot: GponSnapshot | null; last_gpon_synced_at: string | null;
    };
}

interface GponOnuSnapshot {
    onu_ref: string; pon_port: string | null; state: string | null;
    phase_state: string | null; serial_number: string | null; onu_name: string | null;
    rx_power_dbm: number | null; distance_m: number | null; detail_raw: string | null;
}

interface MatchedCustomerSnapshot {
    customer_id: number; customer_name: string; pppoe_user: string;
    onu_ref: string | null; rx_power_dbm: number | null; distance_m: number | null; changed?: boolean;
}

interface GponSnapshot {
    meta: {
        olt: string; host: string; port: number; protocol: string;
        collected_at: string; pon_ports_count: number; onus_count: number;
        matched_customers_count: number; updated_customers_count?: number; warning?: string | null;
    };
    pon_ports: Array<{ name: string }>;
    onus: GponOnuSnapshot[];
    raw: { state: string; baseinfo: Record<string, string>; power: Record<string, string>; distance: Record<string, string>; };
    commands: string[];
    matched_customers: MatchedCustomerSnapshot[];
}

type SnapshotFilter = 'all' | 'online' | 'offline' | 'matched' | 'unmatched';
type SignalFilter = 'all' | 'good' | 'weak' | 'loss' | 'no_signal';
type SortField = 'onu_ref' | 'pon_port' | 'onu_name' | 'rx_power_dbm' | 'distance_m' | 'state';
type SortDir = 'asc' | 'desc';

const PER_PAGE = 50;
const SIG = { good: -25, weak: -27, loss: -30, dead: -50 };

function sigQuality(rx: number | null) {
    if (rx === null || rx === undefined) return { label: 'No Data', color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' };
    if (rx >= SIG.good) return { label: 'Good', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950' };
    if (rx >= SIG.weak) return { label: 'Lemah', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950' };
    if (rx >= SIG.loss) return { label: 'Loss', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950' };
    if (rx >= SIG.dead) return { label: 'Loss', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950' };
    return { label: 'No Signal', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' };
}

export default function Show({ olt }: Props) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [snapshot, setSnapshot] = useState<GponSnapshot | null>(olt.last_gpon_snapshot);
    const [snapshotLoading, setSnapshotLoading] = useState(false);
    const [snapshotError, setSnapshotError] = useState<string | null>(null);
    const [snapshotFilter, setSnapshotFilter] = useState<SnapshotFilter>('all');
    const [signalFilter, setSignalFilter] = useState<SignalFilter>('all');
    const [search, setSearch] = useState('');
    const [ponFilter, setPonFilter] = useState('all');
    const [sortField, setSortField] = useState<SortField>('pon_port');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const autoSnapshotLoaded = useRef(false);

    const syncGponSnapshot = useCallback(async () => {
        setSnapshotLoading(true);
        setSnapshotError(null);
        try {
            const response = await fetch(route('api.olts.gpon-snapshot', olt.id), { headers: { Accept: 'application/json' } });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Gagal memuat data GPON.');
            setSnapshot(payload);
            router.reload({ only: ['olt'] });
        } catch (error) {
            setSnapshotError(error instanceof Error ? error.message : 'Gagal memuat data GPON.');
        } finally { setSnapshotLoading(false); }
    }, [olt.id]);

    useEffect(() => {
        if (autoSnapshotLoaded.current || snapshot || !olt.management_ip) return;
        autoSnapshotLoaded.current = true;
        void syncGponSnapshot();
    }, [olt.management_ip, snapshot, syncGponSnapshot]);

    const matchedRefs = useMemo(() => new Set(
        (snapshot?.matched_customers ?? []).map(c => c.onu_ref?.toLowerCase()).filter(Boolean as any)
    ), [snapshot?.matched_customers]);

    const matchedMap = useMemo(() => {
        const m = new Map<string, MatchedCustomerSnapshot>();
        (snapshot?.matched_customers ?? []).forEach(c => { if (c.onu_ref) m.set(c.onu_ref.toLowerCase(), c); });
        return m;
    }, [snapshot?.matched_customers]);

    const ponPorts = useMemo(() => {
        const s = new Set<string>();
        snapshot?.onus.forEach(o => { if (o.pon_port) s.add(o.pon_port); });
        return Array.from(s).sort();
    }, [snapshot?.onus]);

    const stats = useMemo(() => {
        const all = snapshot?.onus ?? [];
        const online = all.filter(o => o.state?.toLowerCase() === 'online').length;
        const matched = all.filter(o => matchedRefs.has(o.onu_ref.toLowerCase())).length;
        const withSig = all.filter(o => o.rx_power_dbm !== null);
        const good = withSig.filter(o => o.rx_power_dbm! >= SIG.good).length;
        const weak = withSig.filter(o => o.rx_power_dbm! >= SIG.weak && o.rx_power_dbm! < SIG.good).length;
        const loss = withSig.filter(o => o.rx_power_dbm! < SIG.weak).length;
        const noSig = all.filter(o => o.rx_power_dbm === null).length;
        return { total: all.length, online, offline: all.length - online, matched, unmatched: all.length - matched, good, weak, loss, noSig };
    }, [snapshot?.onus, matchedRefs]);

    const filtered = useMemo(() => {
        let onus = [...(snapshot?.onus ?? [])];
        if (snapshotFilter === 'online') onus = onus.filter(o => o.state?.toLowerCase() === 'online');
        if (snapshotFilter === 'offline') onus = onus.filter(o => o.state?.toLowerCase() !== 'online');
        if (snapshotFilter === 'matched') onus = onus.filter(o => matchedRefs.has(o.onu_ref.toLowerCase()));
        if (snapshotFilter === 'unmatched') onus = onus.filter(o => !matchedRefs.has(o.onu_ref.toLowerCase()));
        if (signalFilter === 'good') onus = onus.filter(o => o.rx_power_dbm !== null && o.rx_power_dbm >= SIG.good);
        if (signalFilter === 'weak') onus = onus.filter(o => o.rx_power_dbm !== null && o.rx_power_dbm >= SIG.weak && o.rx_power_dbm! < SIG.good);
        if (signalFilter === 'loss') onus = onus.filter(o => o.rx_power_dbm !== null && o.rx_power_dbm < SIG.weak);
        if (signalFilter === 'no_signal') onus = onus.filter(o => o.rx_power_dbm === null);
        if (ponFilter !== 'all') onus = onus.filter(o => o.pon_port === ponFilter);
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            onus = onus.filter(o =>
                o.onu_ref.toLowerCase().includes(q) ||
                o.onu_name?.toLowerCase().includes(q) ||
                o.serial_number?.toLowerCase().includes(q) ||
                o.pon_port?.toLowerCase().includes(q)
            );
        }
        onus.sort((a, b) => {
            let va: any = '', vb: any = '';
            switch (sortField) {
                case 'onu_ref': va = a.onu_ref; vb = b.onu_ref; break;
                case 'pon_port': va = a.pon_port ?? ''; vb = b.pon_port ?? ''; break;
                case 'onu_name': va = a.onu_name ?? ''; vb = b.onu_name ?? ''; break;
                case 'rx_power_dbm': va = a.rx_power_dbm ?? -999; vb = b.rx_power_dbm ?? -999; return sortDir === 'asc' ? va - vb : vb - va;
                case 'distance_m': va = a.distance_m ?? -1; vb = b.distance_m ?? -1; return sortDir === 'asc' ? va - vb : vb - va;
                case 'state': va = a.state ?? ''; vb = b.state ?? ''; break;
            }
            return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
        return onus;
    }, [snapshot?.onus, snapshotFilter, signalFilter, ponFilter, search, sortField, sortDir, matchedRefs]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    useEffect(() => { setPage(1); }, [snapshotFilter, signalFilter, ponFilter, search]);

    const toggleSort = (f: SortField) => {
        if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(f); setSortDir('asc'); }
    };

    const SortIcon = ({ field }: { field: SortField }) =>
        sortField !== field ? <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" /> :
        sortDir === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;

    const onuAction = async (action: string, ref: string) => {
        setActionLoading(ref);
        try {
            const hdrs = { 'Content-Type': 'application/json', Accept: 'application/json' };
            if (action === 'reboot') {
                const r = await fetch(route('api.olts.onu.reboot', olt.id), { method: 'POST', headers: hdrs, body: JSON.stringify({ onu_ref: ref }) });
                if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Gagal reboot'); }
                alert('Reboot ONU ' + ref + ' berhasil');
            } else if (action === 'delete') {
                if (!confirm('Hapus ONU ' + ref + '? Tidak bisa dibatalkan.')) { setActionLoading(null); return; }
                const r = await fetch(route('api.olts.onu.delete', olt.id), { method: 'DELETE', headers: hdrs, body: JSON.stringify({ onu_ref: ref }) });
                if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Gagal hapus'); }
                alert('Hapus ONU ' + ref + ' berhasil');
                void syncGponSnapshot();
            } else if (action === 'detail') {
                const r = await fetch(route('api.olts.onu.detail', olt.id), { method: 'POST', headers: hdrs, body: JSON.stringify({ onu_ref: ref }) });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || 'Gagal');
                alert(JSON.stringify(d, null, 2));
            }
        } catch (e) { alert('Error: ' + (e instanceof Error ? e.message : 'Unknown')); }
        finally { setActionLoading(null); }
    };

    const statusCards = [
        { key: 'all' as SnapshotFilter, label: 'Total ONU', count: stats.total, icon: Boxes, color: 'text-blue-600 dark:text-blue-400' },
        { key: 'online' as SnapshotFilter, label: 'Online', count: stats.online, icon: Zap, color: 'text-green-600 dark:text-green-400' },
        { key: 'offline' as SnapshotFilter, label: 'Offline', count: stats.offline, icon: AlertCircle, color: 'text-red-600 dark:text-red-400' },
        { key: 'matched' as SnapshotFilter, label: 'Matched', count: stats.matched, icon: Network, color: 'text-emerald-600 dark:text-emerald-400' },
        { key: 'unmatched' as SnapshotFilter, label: 'Belum Match', count: stats.unmatched, icon: Boxes, color: 'text-amber-600 dark:text-amber-400' },
    ];

    const signalPills = [
        { key: 'all' as SignalFilter, label: 'Semua', count: stats.total },
        { key: 'good' as SignalFilter, label: 'Good', count: stats.good },
        { key: 'weak' as SignalFilter, label: 'Lemah', count: stats.weak },
        { key: 'loss' as SignalFilter, label: 'Loss', count: stats.loss },
        { key: 'no_signal' as SignalFilter, label: 'No Signal', count: stats.noSig },
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
                            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => router.post(route('olts.test', olt.id))}>
                                <PlugZap className="h-3.5 w-3.5" /> Test Connection
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={syncGponSnapshot} disabled={snapshotLoading}>
                                <RefreshCw className={`h-3.5 w-3.5 ${snapshotLoading ? 'animate-spin' : ''}`} /> Refresh From OLT
                            </Button>
                            <Button asChild variant="outline" size="sm" className="h-8 gap-2">
                                <Link href={route('olts.edit', olt.id)}><Edit className="h-3.5 w-3.5" /> Edit</Link>
                            </Button>
                            <Button variant="destructive" size="sm" className="h-8 gap-2" onClick={() => setConfirmOpen(true)}>
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                        </div>
                    }
                />
            }
        >
            <Head title={`OLT: ${olt.name}`} />
            <div className="py-8">
                <div className="mx-auto max-w-7xl space-y-6">
                    {/* OLT Info Cards */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">OLT Code</CardTitle>
                                <Boxes className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent><div className="font-mono text-2xl font-bold">{olt.code}</div></CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Management IP</CardTitle>
                                <Network className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent><div className="font-mono text-lg font-bold">{olt.management_ip ? `${olt.management_ip}:${olt.management_port || '-'}` : '-'}</div></CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Area</CardTitle>
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent><div className="text-lg font-bold">{olt.area?.name || '-'}</div></CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Router</CardTitle>
                                <RouterIcon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent><div className="text-lg font-bold">{olt.router?.name || '-'}</div></CardContent>
                        </Card>
                    </div>

                    {/* OLT Details */}
                    <DetailSection title="Detail OLT">
                        <dl className="grid gap-4 md:grid-cols-2">
                            <div><dt className="text-sm text-muted-foreground">Nama</dt><dd className="mt-1 font-medium">{olt.name}</dd></div>
                            <div><dt className="text-sm text-muted-foreground">Lokasi</dt><dd className="mt-1 font-medium">{olt.location || '-'}</dd></div>
                            <div><dt className="text-sm text-muted-foreground">Management IP</dt><dd className="mt-1 font-mono font-medium">{olt.management_ip || '-'}</dd></div>
                            <div><dt className="text-sm text-muted-foreground">Protokol</dt><dd className="mt-1 font-medium uppercase">{olt.management_protocol || '-'}</dd></div>
                            <div><dt className="text-sm text-muted-foreground">Port</dt><dd className="mt-1 font-mono font-medium">{olt.management_port || '-'}</dd></div>
                            <div><dt className="text-sm text-muted-foreground">Username</dt><dd className="mt-1 font-medium">{olt.username || '-'}</dd></div>
                            <div><dt className="text-sm text-muted-foreground">SNMP Community</dt><dd className="mt-1 font-medium">{olt.snmp_community || '-'}</dd></div>
                            <div><dt className="text-sm text-muted-foreground">Kode</dt><dd className="mt-1 font-mono font-medium">{olt.code}</dd></div>
                            <div><dt className="text-sm text-muted-foreground">Vendor</dt><dd className="mt-1 font-medium uppercase">{olt.vendor?.replace('_', ' ') || '-'}</dd></div>
                        </dl>
                    </DetailSection>

                    <DetailSection title="Catatan">
                        <p className="whitespace-pre-wrap text-sm text-foreground">{olt.notes || 'Belum ada catatan.'}</p>
                    </DetailSection>

                    {/* GPON Snapshot Section */}
                    <DetailSection title="GPON Snapshot">
                        <div className="space-y-6">
                            {snapshotError && (
                                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                                    <div className="flex items-center gap-2 font-medium">
                                        <AlertCircle className="h-4 w-4" /> {snapshotError}
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

                            {snapshotLoading && !snapshot && (
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <RefreshCw className="h-4 w-4 animate-spin" /> Mengambil data dari OLT...
                                </div>
                            )}

                            {snapshot && (
                                <>
                                    {/* Status Stats Cards */}
                                    <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                                        {statusCards.map((card) => {
                                            const Icon = card.icon;
                                            return (
                                                <button
                                                    key={card.key}
                                                    type="button"
                                                    onClick={() => setSnapshotFilter(card.key)}
                                                    className={`rounded-xl border p-4 text-left shadow-sm transition hover:border-primary/50 ${
                                                        snapshotFilter === card.key ? 'border-primary ring-2 ring-primary/15 bg-primary/5' : 'border-border/60 bg-card'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                                                        <Icon className={`h-4 w-4 ${card.color}`} />
                                                    </div>
                                                    <div className={`mt-2 text-2xl font-bold ${card.color}`}>{card.count}</div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Signal Filter Pills */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-medium text-muted-foreground mr-1">Sinyal:</span>
                                        {signalPills.map((pill) => (
                                            <button
                                                key={pill.key}
                                                type="button"
                                                onClick={() => setSignalFilter(pill.key)}
                                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                                                    signalFilter === pill.key
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-border/60 bg-card text-muted-foreground hover:border-primary/40'
                                                }`}
                                            >
                                                {pill.label}
                                                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                                                    signalFilter === pill.key ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                                                }`}>{pill.count}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Toolbar: Search + PON Filter */}
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                placeholder="Cari ONU ref, nama, serial, PON port..."
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                className="pl-9 h-9"
                                            />
                                        </div>
                                        <Select value={ponFilter} onValueChange={setPonFilter}>
                                            <SelectTrigger className="w-full sm:w-[200px] h-9">
                                                <SelectValue placeholder="PON Port" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Semua PON Port</SelectItem>
                                                {ponPorts.map((p) => (
                                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Snapshot meta */}
                                    {olt.last_gpon_synced_at && (
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                            <span>
                                                Snapshot terakhir: {new Date(olt.last_gpon_synced_at).toLocaleString('id-ID')}. Protokol {snapshot.meta.protocol.toUpperCase()}, PON aktif {snapshot.meta.pon_ports_count}.
                                            </span>
                                            <span className="font-medium">
                                                Menampilkan {filtered.length} dari {snapshot.onus.length} ONU
                                            </span>
                                        </div>
                                    )}

                                    {/* ONU Table */}
                                    <div className="rounded-xl border border-border/60 overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('pon_port')}>
                                                        <span className="inline-flex items-center">PON Port <SortIcon field="pon_port" /></span>
                                                    </TableHead>
                                                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('onu_ref')}>
                                                        <span className="inline-flex items-center">ONU Ref <SortIcon field="onu_ref" /></span>
                                                    </TableHead>
                                                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('onu_name')}>
                                                        <span className="inline-flex items-center">Nama ONU <SortIcon field="onu_name" /></span>
                                                    </TableHead>
                                                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('state')}>
                                                        <span className="inline-flex items-center">Status <SortIcon field="state" /></span>
                                                    </TableHead>
                                                    <TableHead>Serial</TableHead>
                                                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('rx_power_dbm')}>
                                                        <span className="inline-flex items-center">RX Power <SortIcon field="rx_power_dbm" /></span>
                                                    </TableHead>
                                                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('distance_m')}>
                                                        <span className="inline-flex items-center">Jarak <SortIcon field="distance_m" /></span>
                                                    </TableHead>
                                                    <TableHead>Customer</TableHead>
                                                    <TableHead className="text-right">Aksi</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paged.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                                            Tidak ada ONU untuk filter ini.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    paged.map((onu) => {
                                                        const sq = sigQuality(onu.rx_power_dbm);
                                                        const matched = matchedMap.get(onu.onu_ref.toLowerCase());
                                                        const isLoading = actionLoading === onu.onu_ref;
                                                        return (
                                                            <TableRow key={onu.onu_ref}>
                                                                <TableCell className="font-mono text-xs whitespace-nowrap">{onu.pon_port || '-'}</TableCell>
                                                                <TableCell className="font-mono text-xs font-medium">{onu.onu_ref}</TableCell>
                                                                <TableCell className="text-xs max-w-[200px] truncate" title={onu.onu_name || undefined}>{onu.onu_name || '-'}</TableCell>
                                                                <TableCell>
                                                                    {onu.state ? (
                                                                        <Badge variant={onu.state.toLowerCase() === 'online' ? 'default' : 'secondary'} className="text-[10px]">
                                                                            {onu.state.toLowerCase() === 'online' ? 'Online' : onu.state}
                                                                        </Badge>
                                                                    ) : <span className="text-muted-foreground">-</span>}
                                                                </TableCell>
                                                                <TableCell className="font-mono text-xs">{onu.serial_number || '-'}</TableCell>
                                                                <TableCell>
                                                                    {onu.rx_power_dbm !== null ? (
                                                                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${sq.bg} ${sq.color}`}>
                                                                            {onu.rx_power_dbm.toFixed(2)} dBm
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-400">
                                                                            No Data
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-xs">{onu.distance_m !== null ? `${onu.distance_m}m` : '-'}</TableCell>
                                                                <TableCell>
                                                                    {matched ? (
                                                                        <Link
                                                                            href={route('customers.show', matched.customer_id)}
                                                                            className="text-xs text-primary hover:underline font-medium"
                                                                        >
                                                                            {matched.customer_name}
                                                                        </Link>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Belum Match</Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Detail" onClick={() => onuAction('detail', onu.onu_ref)} disabled={isLoading}>
                                                                            <Eye className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Reboot" onClick={() => onuAction('reboot', onu.onu_ref)} disabled={isLoading}>
                                                                            <Power className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Hapus" onClick={() => onuAction('delete', onu.onu_ref)} disabled={isLoading}>
                                                                            <Trash className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground">
                                                Halaman {page} dari {totalPages} ({filtered.length} ONU)
                                            </p>
                                            <div className="flex items-center gap-1">
                                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                    let pageNum: number;
                                                    if (totalPages <= 5) {
                                                        pageNum = i + 1;
                                                    } else if (page <= 3) {
                                                        pageNum = i + 1;
                                                    } else if (page >= totalPages - 2) {
                                                        pageNum = totalPages - 4 + i;
                                                    } else {
                                                        pageNum = page - 2 + i;
                                                    }
                                                    return (
                                                        <Button key={pageNum} variant={page === pageNum ? 'default' : 'outline'} size="icon" className="h-8 w-8 text-xs" onClick={() => setPage(pageNum)}>
                                                            {pageNum}
                                                        </Button>
                                                    );
                                                })}
                                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </DetailSection>
                </div>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Hapus OLT?"
                description={`Yakin ingin menghapus ${olt.name}? Tindakan ini tidak bisa dibatalkan.`}
                confirmText="Hapus"
                variant="destructive"
                onConfirm={() => router.delete(route('olts.destroy', olt.id), { onFinish: () => setConfirmOpen(false) })}
            />
        </AuthenticatedLayout>
    );
}
