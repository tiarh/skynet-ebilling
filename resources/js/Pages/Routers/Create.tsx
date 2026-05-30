import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Switch } from '@/Components/ui/switch';
import { ChevronLeft, Save, Server } from 'lucide-react';
import { FormEventHandler } from 'react';
import { requiredNumber, requiredString, validateForm } from '@/lib/validation';
import { z } from 'zod';

const ipAddressSchema = requiredString('IP address')
    .refine((value) => {
        const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(value)
            && value.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255);
        const ipv6 = value.includes(':') && /^[0-9a-fA-F:]+$/.test(value);

        return ipv4 || ipv6;
    }, 'IP address must be valid.');

const routerCreateSchema = z.object({
    name: requiredString('Router name'),
    ip_address: ipAddressSchema,
    port: requiredNumber('API port', 1).refine((value) => value <= 65535, 'API port must be at most 65535.'),
    username: requiredString('Username'),
    password: requiredString('Password'),
    is_active: z.boolean(),
});

export default function Create() {
    const form = useForm({
        name: '',
        ip_address: '',
        port: 8728,
        username: 'admin',
        password: '',
        is_active: true,
    });
    const { data, setData, post, processing, errors } = form;

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (!validateForm(routerCreateSchema, data, form)) return;
        post(route('routers.store'));
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Routers', href: route('routers.index') },
                { label: 'Create' }
            ]}
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={route('routers.index')}>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <h2 className="text-xl font-semibold leading-tight text-foreground">
                            Add New Router
                        </h2>
                    </div>
                </div>
            }
        >
            <Head title="Add Router" />

            <div className="py-12">
                <div className="mx-auto max-w-3xl sm:px-6 lg:px-8">
                    <form onSubmit={submit}>
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Server className="h-5 w-5 text-primary" />
                                    Router Configuration
                                </CardTitle>
                                <CardDescription>
                                    Add a new MikroTik router to the network management system.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Basic Information */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium">Basic Information</h3>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Router Name *</Label>
                                            <Input
                                                id="name"
                                                value={data.name}
                                                onChange={(e) => setData('name', e.target.value)}
                                                placeholder="e.g., Skynet-Tutur"
                                                maxLength={255}
                                                required
                                                className={errors.name ? 'border-red-500' : ''}
                                            />
                                            {errors.name && (
                                                <p className="text-sm text-red-500">{errors.name}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="ip_address">IP Address *</Label>
                                            <Input
                                                id="ip_address"
                                                value={data.ip_address}
                                                onChange={(e) => setData('ip_address', e.target.value)}
                                                placeholder="103.156.128.231"
                                                maxLength={255}
                                                required
                                                className={errors.ip_address ? 'border-red-500' : ''}
                                            />
                                            {errors.ip_address && (
                                                <p className="text-sm text-red-500">{errors.ip_address}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Network Configuration */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium">Network Configuration</h3>
                                    <div className="space-y-2">
                                        <Label htmlFor="port">API Port</Label>
                                        <Input
                                            id="port"
                                            type="number"
                                            min={1}
                                            max={65535}
                                            value={data.port}
                                            onChange={(e) => setData('port', parseInt(e.target.value) || 8728)}
                                            placeholder="8728"
                                            className={errors.port ? 'border-red-500' : ''}
                                        />
                                        {errors.port && (
                                            <p className="text-sm text-red-500">{errors.port}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground">Default: 8728</p>
                                    </div>
                                </div>

                                {/* Authentication */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium">Authentication</h3>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="username">Username *</Label>
                                            <Input
                                                id="username"
                                                value={data.username}
                                                onChange={(e) => setData('username', e.target.value)}
                                                placeholder="admin"
                                                maxLength={255}
                                                required
                                                className={errors.username ? 'border-red-500' : ''}
                                            />
                                            {errors.username && (
                                                <p className="text-sm text-red-500">{errors.username}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="password">Password *</Label>
                                            <Input
                                                id="password"
                                                type="password"
                                                value={data.password}
                                                onChange={(e) => setData('password', e.target.value)}
                                                placeholder="••••••••"
                                                required
                                                className={errors.password ? 'border-red-500' : ''}
                                            />
                                            {errors.password && (
                                                <p className="text-sm text-red-500">{errors.password}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground">Will be encrypted</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium">Status</h3>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="is_active"
                                            checked={data.is_active}
                                            onCheckedChange={(checked: boolean) => setData('is_active', checked)}
                                        />
                                        <Label htmlFor="is_active" className="cursor-pointer">
                                            Active (Router is enabled for operations)
                                        </Label>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-6 border-t">
                                    <Link href={route('routers.index')}>
                                        <Button type="button" variant="outline">
                                            Cancel
                                        </Button>
                                    </Link>
                                    <Button type="submit" disabled={processing}>
                                        <Save className="mr-2 h-4 w-4" />
                                        {processing ? 'Saving...' : 'Add Router'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
