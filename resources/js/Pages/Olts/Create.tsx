import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { TextField } from '@/Components/ResourceFields';
import { ResourceFormShell } from '@/Components/ResourceFormShell';
import { ResourcePageHeader } from '@/Components/ResourcePageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { nullableId, optionalIpAddress, requiredString, validateForm } from '@/lib/validation';
import { z } from 'zod';

interface AreaOption {
    id: number;
    name: string;
}

interface RouterOption {
    id: number;
    name: string;
}

interface Props {
    areas: AreaOption[];
    routers: RouterOption[];
}

const oltSchema = z.object({
    name: requiredString('OLT name'),
    code: requiredString('OLT code'),
    vendor: z.enum(['zte_c300', 'hioso']).optional(),
    area_id: nullableId('Area'),
    router_id: nullableId('Router'),
    management_ip: optionalIpAddress('Management IP'),
    management_protocol: z.enum(['ssh', 'telnet', 'snmp', 'http', 'https']).optional().or(z.literal('')),
    management_port: z.string().optional(),
    username: z.string().max(255, 'Username may not be greater than 255 characters.').optional(),
    password: z.string().max(255, 'Password may not be greater than 255 characters.').optional(),
    snmp_community: z.string().max(255, 'SNMP community may not be greater than 255 characters.').optional(),
    location: z.string().max(255, 'Location may not be greater than 255 characters.').optional(),
    notes: z.string().optional(),
});

const defaultPortForProtocol = (protocol: string) => {
    if (protocol === 'telnet') return '23';
    if (protocol === 'snmp') return '161';
    if (protocol === 'http') return '80';
    if (protocol === 'https') return '443';
    return '22';
};

export default function Create({ areas, routers }: Props) {
    const form = useForm({
        name: '',
        code: '',
        vendor: 'zte_c300',
        area_id: '',
        router_id: '',
        management_ip: '',
        management_protocol: 'ssh',
        management_port: '22',
        username: '',
        password: '',
        snmp_community: '',
        location: '',
        notes: '',
    });
    const { data, setData, post, processing, errors } = form;
    const isWebAccess = ['http', 'https'].includes(data.management_protocol);
    const isSnmpAccess = data.management_protocol === 'snmp';

    const setProtocol = (protocol: string) => {
        setData((current) => ({
            ...current,
            management_protocol: protocol,
            management_port: defaultPortForProtocol(protocol),
        }));
    };

    const setVendor = (vendor: string) => {
        setData((current) => ({
            ...current,
            vendor,
            management_protocol: vendor === 'hioso' ? 'http' : current.management_protocol,
            management_port: vendor === 'hioso' ? '80' : current.management_port,
        }));
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!validateForm(oltSchema, data, form)) return;
        post(route('olts.store'));
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'OLTs', href: route('olts.index') },
                { label: 'Create OLT' },
            ]}
            header={<ResourcePageHeader title="Create OLT" backHref={route('olts.index')} />}
        >
            <Head title="Create OLT" />

            <ResourceFormShell
                title="OLT Details"
                description="Add a new optical line terminal to the inventory."
                onSubmit={submit}
                submitLabel="Create OLT"
                processingLabel="Creating..."
                processing={processing}
                cancelHref={route('olts.index')}
            >
                <TextField
                    id="name"
                    label="OLT Name"
                    value={data.name}
                    onChange={(value) => setData('name', value)}
                    placeholder="e.g. OLT Mangliawan"
                    required
                    autoFocus
                    maxLength={255}
                    error={errors.name}
                />
                <TextField
                    id="code"
                    label="OLT Code"
                    value={data.code}
                    onChange={(value) => setData('code', value)}
                    placeholder="e.g. OLT-MGL-01"
                    required
                    maxLength={255}
                    error={errors.code}
                />
                <div className="space-y-2">
                    <Label htmlFor="vendor">Vendor</Label>
                    <Select value={data.vendor || 'zte_c300'} onValueChange={setVendor}>
                        <SelectTrigger id="vendor">
                            <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="zte_c300">ZTE C300/C320</SelectItem>
                            <SelectItem value="hioso">Hioso</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.vendor && <p className="text-sm text-destructive">{errors.vendor}</p>}
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="area_id">Area</Label>
                        <Select value={data.area_id || 'none'} onValueChange={(value) => setData('area_id', value === 'none' ? '' : value)}>
                            <SelectTrigger id="area_id">
                                <SelectValue placeholder="Select area" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No area</SelectItem>
                                {areas.map((area) => (
                                    <SelectItem key={area.id} value={String(area.id)}>
                                        {area.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.area_id && <p className="text-sm text-destructive">{errors.area_id}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="router_id">Router</Label>
                        <Select value={data.router_id || 'none'} onValueChange={(value) => setData('router_id', value === 'none' ? '' : value)}>
                            <SelectTrigger id="router_id">
                                <SelectValue placeholder="Select router" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No router</SelectItem>
                                {routers.map((routerOption) => (
                                    <SelectItem key={routerOption.id} value={String(routerOption.id)}>
                                        {routerOption.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.router_id && <p className="text-sm text-destructive">{errors.router_id}</p>}
                    </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    {data.vendor === 'hioso'
                        ? 'Hioso via web: pilih HTTP/HTTPS, isi public IP atau IP NAT router dan port forwarding web OLT. CLI Telnet/SSH tetap bisa dipakai kalau firmware mendukung.'
                        : 'ZTE C300/C320 biasanya memakai SSH/Telnet untuk operasi OLT dan SNMP untuk monitoring.'}
                </div>
                <TextField
                    id="management_ip"
                    label={isWebAccess ? 'Host / Public IP Web OLT' : 'Management IP'}
                    value={data.management_ip}
                    onChange={(value) => setData('management_ip', value)}
                    placeholder={isWebAccess ? 'e.g. 103.156.128.114' : 'e.g. 10.99.0.10'}
                    help={isWebAccess ? 'Untuk NAT Hioso, isi public IP router dan port hasil dstnat, misalnya 103.156.128.114 port 8355.' : 'Masukkan IP management OLT. Port dan protocol diisi terpisah.'}
                    error={errors.management_ip}
                />
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="management_protocol">Protocol</Label>
                        <Select value={data.management_protocol || 'ssh'} onValueChange={setProtocol}>
                            <SelectTrigger id="management_protocol">
                                <SelectValue placeholder="Select protocol" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="http">Web HTTP</SelectItem>
                                <SelectItem value="https">Web HTTPS</SelectItem>
                                <SelectItem value="telnet">CLI Telnet</SelectItem>
                                <SelectItem value="ssh">CLI SSH</SelectItem>
                                <SelectItem value="snmp">SNMP Monitoring</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.management_protocol && <p className="text-sm text-destructive">{errors.management_protocol}</p>}
                    </div>
                    <TextField
                        id="management_port"
                        label="Port"
                        type="number"
                        value={data.management_port}
                        onChange={(value) => setData('management_port', value)}
                        placeholder="e.g. 23"
                        help="HTTP 80, HTTPS 443, Telnet 23, SSH 22, SNMP 161. Untuk NAT boleh port custom, misalnya 8355."
                        error={errors.management_port}
                    />
                </div>
                {!isSnmpAccess && (
                    <div className="grid gap-6 md:grid-cols-2">
                    <TextField
                        id="username"
                        label={isWebAccess ? 'Web Username' : 'CLI Username'}
                        value={data.username}
                        onChange={(value) => setData('username', value)}
                        placeholder="e.g. admin"
                        error={errors.username}
                    />
                    <TextField
                        id="password"
                        label={isWebAccess ? 'Web Password' : 'CLI Password'}
                        type="password"
                        value={data.password}
                        onChange={(value) => setData('password', value)}
                        placeholder="Optional"
                        error={errors.password}
                    />
                    </div>
                )}
                {(isSnmpAccess || data.vendor === 'hioso') && <TextField
                    id="snmp_community"
                    label="SNMP Community"
                    value={data.snmp_community}
                    onChange={(value) => setData('snmp_community', value)}
                    placeholder="e.g. public"
                    help="Opsional. Isi kalau Hioso/ZTE juga mau dimonitor via SNMP."
                    error={errors.snmp_community}
                />}
                <TextField
                    id="location"
                    label="Location"
                    value={data.location}
                    onChange={(value) => setData('location', value)}
                    placeholder="e.g. POP Mangliawan"
                    maxLength={255}
                    error={errors.location}
                />
                <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        value={data.notes}
                        onChange={(event) => setData('notes', event.target.value)}
                        placeholder="Optional installation notes"
                        className="min-h-[120px]"
                    />
                    {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
                </div>
            </ResourceFormShell>
        </AuthenticatedLayout>
    );
}
