import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
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

export default function Create() {
    const form = useForm({
        name: '',
        price: '',
        mikrotik_profile: '',
    });
    const { data, setData, post, processing, errors } = form;

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!validateForm(packageSchema, data, form)) return;
        post(route('packages.store'));
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Packages', href: route('packages.index') },
                { label: 'Create' },
            ]}
            header={<ResourcePageHeader title="Create Package" backHref={route('packages.index')} />}
        >
            <Head title="Create Package" />

            <ResourceFormShell
                title="Package Details"
                description="Create a new internet package."
                onSubmit={submit}
                submitLabel="Create Package"
                processingLabel="Creating..."
                processing={processing}
                cancelHref={route('packages.index')}
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
