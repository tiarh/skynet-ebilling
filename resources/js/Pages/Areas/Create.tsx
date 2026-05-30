import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { TextField } from '@/Components/ResourceFields';
import { ResourceFormShell } from '@/Components/ResourceFormShell';
import { ResourcePageHeader } from '@/Components/ResourcePageHeader';
import { requiredString, validateForm } from '@/lib/validation';
import { z } from 'zod';

const areaSchema = z.object({
    name: requiredString('Area name'),
    code: requiredString('Area code'),
});

export default function Create() {
    const form = useForm({
        name: '',
        code: '',
    });
    const { data, setData, post, processing, errors } = form;

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!validateForm(areaSchema, data, form)) return;
        post(route('areas.store'));
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Areas', href: route('areas.index') },
                { label: 'Create Area' },
            ]}
            header={<ResourcePageHeader title="Create Area" backHref={route('areas.index')} />}
        >
            <Head title="Create Area" />

            <ResourceFormShell
                title="Area Details"
                description="Add a new operational area."
                onSubmit={submit}
                submitLabel="Create Area"
                processingLabel="Creating..."
                processing={processing}
                cancelHref={route('areas.index')}
            >
                <TextField
                    id="name"
                    label="Area Name"
                    value={data.name}
                    onChange={(value) => setData('name', value)}
                    placeholder="e.g. Singosari"
                    required
                    autoFocus
                    maxLength={255}
                    error={errors.name}
                />
                <TextField
                    id="code"
                    label="Area Code"
                    value={data.code}
                    onChange={(value) => setData('code', value)}
                    placeholder="e.g. SGS"
                    required
                    maxLength={255}
                    help="Unique identifier for this area."
                    error={errors.code}
                />
            </ResourceFormShell>
        </AuthenticatedLayout>
    );
}
