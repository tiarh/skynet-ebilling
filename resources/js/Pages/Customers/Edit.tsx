import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Textarea } from '@/Components/ui/textarea';
import { ChevronLeft, Save, User, Network, MapPin, Shield, Trash2 } from 'lucide-react';
import MapPicker from '@/Components/MapPicker';
import { FormEventHandler } from 'react';
import { nullableId, optionalImage, optionalNumberInRange, requiredId, requiredString, validateForm } from '@/lib/validation';
import { z } from 'zod';
import { PON_PORT_OPTIONS } from '@/lib/oltPorts';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/Components/ui/dialog";

// Interfaces
interface Package {
    id: number;
    name: string;
    price: number;

}

interface Area {
    id: number;
    name: string;
}

interface Router {
    id: number;
    name: string;
}

interface Olt {
    id: number;
    name: string;
}

interface Customer {
    id: number;
    name: string;
    // internal_id removed
    address: string;
    phone?: string;
    nik?: string;
    pppoe_user: string;
    package_id: number;
    area_id?: number | null;
    olt_id?: number | null;
    olt_port_label?: string | null;
    onu_serial?: string | null;
    olt_status?: string | null;
    onu_rx_power_dbm?: string | null;
    onu_tx_power_dbm?: string | null;
    fiber_distance_m?: number | null;
    status: 'pending_installation' | 'active' | 'suspended' | 'isolated' | 'offboarding' | 'terminated';
    geo_lat?: string;
    geo_long?: string;
    ktp_photo_url?: string | null;
    router_id?: number | null;
}

interface Props {
    customer: Customer;
    packages: Package[];
    areas: Area[];
    olts: Olt[];
    routers: Router[];
}

const customerUpdateSchema = z.object({
    name: requiredString('Customer name'),
    address: z.string().trim().min(1, 'Installation address is required.'),
    phone: z.string().max(20, 'Phone may not be greater than 20 characters.').optional(),
    nik: z.string().max(20, 'NIK may not be greater than 20 characters.').optional(),
    package_id: requiredId('Package'),
    area_id: nullableId('Area'),
    router_id: nullableId('Router'),
    olt_id: nullableId('OLT'),
    olt_port_label: z.string().max(255, 'OLT port may not be greater than 255 characters.').optional(),
    onu_serial: z.string().max(255, 'ONU serial may not be greater than 255 characters.').optional(),
    olt_status: z.string().max(50, 'OLT status may not be greater than 50 characters.').optional(),
    onu_rx_power_dbm: optionalNumberInRange('ONU Rx Power', -100, 100),
    onu_tx_power_dbm: optionalNumberInRange('ONU Tx Power', -100, 100),
    fiber_distance_m: z.preprocess(
        (value) => value === '' || value === null || value === undefined ? null : Number(value),
        z.number({ error: 'Fiber distance must be a number.' }).int().min(0).nullable()
    ),
    status: z.enum(['pending_installation', 'active', 'isolated', 'terminated'], { error: 'Status is required.' }),
    geo_lat: optionalNumberInRange('Latitude', -90, 90),
    geo_long: optionalNumberInRange('Longitude', -180, 180),
    ktp_photo: optionalImage('KTP photo'),
});

export default function Edit({ customer, packages, areas, olts, routers }: Props) {
    const form = useForm({
        name: customer.name || '',
        // internal_id removed
        address: customer.address || '',
        phone: customer.phone || '',
        nik: customer.nik || '',
        pppoe_user: customer.pppoe_user || '',

        package_id: String(customer.package_id),
        area_id: customer.area_id ? String(customer.area_id) : '',
        router_id: customer.router_id ? String(customer.router_id) : '',
        olt_id: customer.olt_id ? String(customer.olt_id) : '',
        olt_port_label: customer.olt_port_label || '',
        onu_serial: customer.onu_serial || '',
        olt_status: customer.olt_status || '',
        onu_rx_power_dbm: customer.onu_rx_power_dbm || '',
        onu_tx_power_dbm: customer.onu_tx_power_dbm || '',
        fiber_distance_m: customer.fiber_distance_m ? String(customer.fiber_distance_m) : '',
        status: customer.status,
        geo_lat: customer.geo_lat || '',
        geo_long: customer.geo_long || '',
        ktp_photo: null as File | null,
    });
    const { data, setData, put, delete: destroy, processing, errors } = form;

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (!validateForm(customerUpdateSchema, data, form)) return;
        put(route('customers.update', customer.id));
    };

    const handleDelete = () => {
        destroy(route('customers.destroy', customer.id));
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Customers', href: route('customers.index') },
                { label: customer.name, href: route('customers.show', customer.id) },
                { label: 'Edit' }
            ]}
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={route('customers.index')}>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-semibold leading-tight text-foreground">
                                Edit Customer: {customer.name}
                            </h2>
                        </div>
                    </div>
                    {/* Delete Action - using Dialog as fallback */}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Customer
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="border-destructive/50">
                            <DialogHeader>
                                <DialogTitle>Are you absolutely sure?</DialogTitle>
                                <DialogDescription>
                                    This action cannot be undone. This will permanently delete the customer
                                    <strong> {customer.name} </strong> and remove their data from our servers.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => document.getElementById('close-dialog')?.click()}>Cancel</Button>
                                <Button variant="destructive" onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            }
        >
            <Head title={`Edit ${customer.name}`} />

            <form onSubmit={submit} className="space-y-8 py-6">
                {Object.keys(errors).length > 0 && (
                    <div className="bg-destructive/15 text-destructive p-4 rounded-md border border-destructive/20">
                        <p className="font-semibold">Please fix the following errors:</p>
                        <ul className="list-disc list-inside text-sm mt-1">
                            {Object.entries(errors).map(([field, msg]) => (
                                <li key={field}>{msg}</li>
                            ))}
                        </ul>
                    </div>
                )}
                <div className="grid gap-8 lg:grid-cols-2">
                    {/* Left Column: Personal Information */}
                    <div className="space-y-6">
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle>Personal Information</CardTitle>
                                        <CardDescription>Identity and contact details</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    {/* Internal ID removed */}
                                    <div className="col-span-2 grid gap-2">
                                        <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="name"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            className={errors.name ? 'border-destructive' : ''}
                                            maxLength={255}
                                            required
                                        />
                                        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <Input
                                            id="phone"
                                            value={data.phone}
                                            onChange={(e) => setData('phone', e.target.value)}
                                            maxLength={20}
                                        />
                                        {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="nik">NIK (Identity)</Label>
                                        <Input
                                            id="nik"
                                            value={data.nik}
                                            onChange={(e) => setData('nik', e.target.value)}
                                            maxLength={20}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="address">Installation Address <span className="text-red-500">*</span></Label>
                                    <Textarea
                                        id="address"
                                        value={data.address}
                                        onChange={(e) => setData('address', e.target.value)}
                                        className={`min-h-[100px] bg-background/50 ${errors.address ? 'border-destructive' : ''}`}
                                        required
                                    />
                                    {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="ktp_photo">KTP Photo</Label>
                                    {customer.ktp_photo_url && (
                                        <div className="mb-2 border rounded-lg p-2 bg-muted/30">
                                            <p className="text-xs text-muted-foreground mb-2">Current KTP:</p>
                                            <img
                                                src={customer.ktp_photo_url}
                                                alt="Current KTP"
                                                className="max-w-[200px] rounded border"
                                            />
                                        </div>
                                    )}
                                    <Input
                                        id="ktp_photo"
                                        type="file"
                                        accept="image/jpeg,image/png,image/jpg"
                                        onChange={(e) => setData('ktp_photo', e.target.files?.[0] || null)}
                                        className="cursor-pointer"
                                    />
                                    {errors.ktp_photo && <p className="text-sm text-destructive">{errors.ktp_photo}</p>}
                                    <p className="text-xs text-muted-foreground">
                                        {customer.ktp_photo_url ? 'Upload new to replace' : 'Max 2MB - JPEG, PNG, JPG'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Geo Location */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                        <MapPin className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle>Geolocation</CardTitle>
                                        <CardDescription>GPS Coordinates for mapping</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-md overflow-hidden border border-border">
                                    <MapPicker
                                        initialLat={Number(data.geo_lat) || -6.200000}
                                        initialLong={Number(data.geo_long) || 106.816666}
                                        onLocationSelect={(lat: number, lng: number) => {
                                            setData((prev) => ({
                                                ...prev,
                                                geo_lat: lat.toFixed(6),
                                                geo_long: lng.toFixed(6)
                                            }));
                                        }}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="lat">Latitude</Label>
                                        <Input
                                            id="lat"
                                            value={data.geo_lat}
                                            onChange={(e) => setData('geo_lat', e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="long">Longitude</Label>
                                        <Input
                                            id="long"
                                            value={data.geo_long}
                                            onChange={(e) => setData('geo_long', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Network Information */}
                    <div className="space-y-6">
                        <Card className="border-border bg-card/50 backdrop-blur-sm h-full">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                        <Network className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle>Service Configuration</CardTitle>
                                        <CardDescription>Package and Authentication</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="area_id">Area</Label>
                                    <Select
                                        value={data.area_id}
                                        onValueChange={(val) => setData('area_id', val)}
                                    >
                                        <SelectTrigger className="bg-background/50">
                                            <SelectValue placeholder="Select Area" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {areas.map((area) => (
                                                <SelectItem key={area.id} value={String(area.id)}>
                                                    {area.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.area_id && <p className="text-sm text-destructive">{errors.area_id}</p>}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="package">Subscription Package <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={data.package_id}
                                        onValueChange={(val) => setData('package_id', val)}
                                    >
                                        <SelectTrigger className="bg-background/50">
                                            <SelectValue placeholder="Select a package" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {packages.map((pkg) => (
                                                <SelectItem key={pkg.id} value={String(pkg.id)}>
                                                    <span className="font-medium">{pkg.name}</span>
                                                    <span className="text-muted-foreground ml-2">
                                                        (Rp {pkg.price.toLocaleString('id-ID')})
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.package_id && <p className="text-sm text-destructive">{errors.package_id}</p>}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="status">Account Status</Label>
                                    <Select
                                        value={data.status}
                                        onValueChange={(val: any) => setData('status', val)}
                                    >
                                        <SelectTrigger className="bg-background/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending_installation">Pending Installation</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="isolated">Isolated</SelectItem>
                                            <SelectItem value="terminated">Terminated</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.status && <p className="text-sm text-destructive">{errors.status}</p>}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="router_id">Mikrotik Router</Label>
                                    <Select
                                        value={data.router_id || 'manual'}
                                        onValueChange={(val) => setData('router_id', val === 'manual' ? '' : val)}
                                    >
                                        <SelectTrigger className="bg-background/50">
                                            <SelectValue placeholder="Select Router" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="manual">-- None (Manual Mode) --</SelectItem>
                                            {routers.map((router) => (
                                                <SelectItem key={router.id} value={String(router.id)}>
                                                    {router.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.router_id && <p className="text-sm text-destructive">{errors.router_id}</p>}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="olt_id">OLT</Label>
                                    <Select
                                        value={data.olt_id || 'manual'}
                                        onValueChange={(val) => setData('olt_id', val === 'manual' ? '' : val)}
                                    >
                                        <SelectTrigger className="bg-background/50">
                                            <SelectValue placeholder="Select OLT" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="manual">-- None --</SelectItem>
                                            {olts.map((olt) => (
                                                <SelectItem key={olt.id} value={String(olt.id)}>
                                                    {olt.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.olt_id && <p className="text-sm text-destructive">{errors.olt_id}</p>}
                                </div>

                                <div className="space-y-4 rounded-lg border border-border/50 p-4">
                                    <div className="flex items-center gap-2">
                                        <Network className="h-4 w-4 text-cyan-500" />
                                        <span className="font-medium text-sm text-foreground">OLT Telemetry</span>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="olt_port_label">OLT Port</Label>
                                            <Input id="olt_port_label" list="olt-port-options" value={data.olt_port_label} onChange={(e) => setData('olt_port_label', e.target.value)} placeholder="e.g. gpon-olt_1/2/1" />
                                            <datalist id="olt-port-options">
                                                {PON_PORT_OPTIONS.map((port) => (
                                                    <option key={port.value} value={port.value}>{port.label}</option>
                                                ))}
                                            </datalist>
                                            {errors.olt_port_label && <p className="text-sm text-destructive">{errors.olt_port_label}</p>}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="onu_serial">ONU Serial</Label>
                                            <Input id="onu_serial" value={data.onu_serial} onChange={(e) => setData('onu_serial', e.target.value)} placeholder="e.g. ZTEG12345678" />
                                            {errors.onu_serial && <p className="text-sm text-destructive">{errors.onu_serial}</p>}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="olt_status">OLT Status</Label>
                                            <Input id="olt_status" value={data.olt_status} onChange={(e) => setData('olt_status', e.target.value)} placeholder="online / offline / los" />
                                            {errors.olt_status && <p className="text-sm text-destructive">{errors.olt_status}</p>}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="fiber_distance_m">Distance to OLT (m)</Label>
                                            <Input id="fiber_distance_m" type="number" min="0" value={data.fiber_distance_m} onChange={(e) => setData('fiber_distance_m', e.target.value)} placeholder="e.g. 1450" />
                                            {errors.fiber_distance_m && <p className="text-sm text-destructive">{errors.fiber_distance_m}</p>}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="onu_rx_power_dbm">Rx Power / Redaman (dBm)</Label>
                                            <Input id="onu_rx_power_dbm" type="number" step="0.01" value={data.onu_rx_power_dbm} onChange={(e) => setData('onu_rx_power_dbm', e.target.value)} placeholder="e.g. -21.45" />
                                            {errors.onu_rx_power_dbm && <p className="text-sm text-destructive">{errors.onu_rx_power_dbm}</p>}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="onu_tx_power_dbm">Tx Power (dBm)</Label>
                                            <Input id="onu_tx_power_dbm" type="number" step="0.01" value={data.onu_tx_power_dbm} onChange={(e) => setData('onu_tx_power_dbm', e.target.value)} placeholder="e.g. 2.15" />
                                            {errors.onu_tx_power_dbm && <p className="text-sm text-destructive">{errors.onu_tx_power_dbm}</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-border/50 my-6"></div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Shield className="h-4 w-4 text-orange-500" />
                                        <span className="font-medium text-sm text-foreground">PPPoE Credentials</span>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="pppoe_user">Username</Label>
                                        <Input
                                            id="pppoe_user"
                                            value={data.pppoe_user}
                                            disabled
                                            className="font-mono bg-muted text-muted-foreground cursor-not-allowed"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            PPPoE Username cannot be changed. Create a new customer if needed.
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <p className="text-[12px] text-muted-foreground bg-muted p-2 rounded border border-border">
                                            <strong>Note:</strong> Password management is handled entirely by the NOC on the router.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-8">
                    <Link href={route('customers.index')}>
                        <Button variant="outline" type="button">Cancel</Button>
                    </Link>
                    <Button type="submit" disabled={processing} className="min-w-[150px]">
                        {processing ? 'Saving...' : 'Save Changes'}
                        {!processing && <Save className="ml-2 h-4 w-4" />}
                    </Button>
                </div>
            </form >

        </AuthenticatedLayout >
    );
}
