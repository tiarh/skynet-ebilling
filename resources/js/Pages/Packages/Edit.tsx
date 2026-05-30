import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { TextField } from '@/Components/ResourceFields';
import { ResourceFormShell } from '@/Components/ResourceFormShell';
import { ResourcePageHeader } from '@/Components/ResourcePageHeader';
import { requiredNumber, requiredString, validateForm } from '@/lib/validation';
import { z } from 'zod';

const packageSchema = z.object({
    name: requiredString('Package name'),
    price: requiredNumber('Monthly price', 0),
    mikrotik_profile: z.string().max(255, 'MikroTik profile may not be greater than 255 characters.').optional(),
});

interface Package {
    id: number;
    name: string;
    price: number;
    mikrotik_profile?: string;
}

interface Props {
    package: Package;
}

export default function Edit({ package: pkg }: Props) {
    const form = useForm({
        name: pkg.name,
        price: pkg.price.toString(),
        mikrotik_profile: pkg.mikrotik_profile || '',
    });
    const { data, setData, put, processing, errors } = form;

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!validateForm(packageSchema, data, form)) return;
        put(route('packages.update', pkg.id));
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Packages', href: route('packages.index') },
                { label: pkg.name, href: route('packages.show', pkg.id) },
                { label: 'Edit' },
            ]}
            header={<ResourcePageHeader title="Edit Package" backHref={route('packages.index')} />}
        >
            <Head title="Edit Package" />

            <ResourceFormShell
                title={`Package #${pkg.id}`}
                description="Update package information."
                onSubmit={submit}
                submitLabel="Save Changes"
                processing={processing}
                cancelHref={route('packages.index')}
                beforeFields={
                    <Alert className="mb-6">
                        <AlertDescription>
                            <strong>Warning:</strong> Changing the package price will affect future billing cycles for subscribed customers.
                        </AlertDescription>
                    </Alert>
                }
            >
                <TextField
                    id="name"
                    label="Package Name"
                    value={data.name}
                    onChange={(value) => setData('name', value)}
                    placeholder="e.g. Paket Premium 20Mbps"
                    required
                    autoFocus
                    maxLength={255}
                    help="This is what customers see on invoices."
                    error={errors.name}
                />
                <TextField
                    id="mikrotik_profile"
                    label="MikroTik Profile Name"
                    value={data.mikrotik_profile}
                    onChange={(value) => setData('mikrotik_profile', value)}
                    placeholder="e.g. profile-10m"
                    maxLength={255}
                    help="Leave empty for manual packages."
                    error={errors.mikrotik_profile}
                />
                <TextField
                    id="price"
                    label="Monthly Price (IDR)"
                    type="number"
                    step="1000"
                    min={0}
                    value={data.price}
                    onChange={(value) => setData('price', value)}
                    placeholder="e.g. 150000"
                    required
                    error={errors.price}
                />
            </ResourceFormShell>
        </AuthenticatedLayout>
    );
}
