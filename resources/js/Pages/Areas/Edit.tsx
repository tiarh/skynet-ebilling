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

interface Props {
    area: {
        id: number;
        name: string;
        code: string;
    };
}

export default function Edit({ area }: Props) {
    const form = useForm({
        name: area.name,
        code: area.code,
    });
    const { data, setData, put, processing, errors } = form;

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!validateForm(areaSchema, data, form)) return;
        put(route('areas.update', area.id));
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Areas', href: route('areas.index') },
                { label: `Edit ${area.name}` },
            ]}
            header={<ResourcePageHeader title="Edit Area" backHref={route('areas.index')} />}
        >
            <Head title={`Edit ${area.name}`} />

            <ResourceFormShell
                title="Area Details"
                description="Update information for this area."
                onSubmit={submit}
                submitLabel="Save Changes"
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
                    error={errors.code}
                />
            </ResourceFormShell>
        </AuthenticatedLayout>
    );
}
