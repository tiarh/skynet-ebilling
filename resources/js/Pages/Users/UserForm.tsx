import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { ResourceFormShell } from '@/Components/ResourceFormShell';
import { ResourcePageHeader } from '@/Components/ResourcePageHeader';
import { TextField } from '@/Components/ResourceFields';
import { FormEventHandler } from 'react';
import { requiredString, validateForm } from '@/lib/validation';
import { z } from 'zod';

interface Area {
    id: number;
    name: string;
    code: string;
}

interface ManagedUser {
    id: number;
    name: string;
    email: string;
    role: 'superadmin' | 'admin';
    areas: Area[];
}

interface Props {
    managedUser?: ManagedUser;
    areas: Area[];
}

export default function UserForm({ managedUser, areas }: Props) {
    const isEditing = !!managedUser;
    const userSchema = z.object({
        name: requiredString('Name'),
        email: requiredString('Email').email('Email must be a valid email address.'),
        password: isEditing
            ? z.string().refine((value) => value === '' || value.length >= 8, 'Password must be at least 8 characters.')
            : z.string().min(8, 'Password must be at least 8 characters.'),
        password_confirmation: z.string(),
        role: z.enum(['superadmin', 'admin'], { error: 'Role is required.' }),
        area_ids: z.array(z.number().int()),
    }).refine(
        (value) => value.password === value.password_confirmation,
        { path: ['password_confirmation'], message: 'Password confirmation does not match.' },
    );

    const form = useForm({
        name: managedUser?.name || '',
        email: managedUser?.email || '',
        password: '',
        password_confirmation: '',
        role: managedUser?.role || 'admin',
        area_ids: managedUser?.areas.map((area) => area.id) || [] as number[],
    });
    const { data, setData, post, patch, processing, errors } = form;

    const submit: FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        if (!validateForm(userSchema, data, form)) return;

        if (managedUser) {
            patch(route('users.update', managedUser.id));
            return;
        }

        post(route('users.store'));
    };

    const toggleArea = (areaId: number) => {
        setData('area_ids', data.area_ids.includes(areaId)
            ? data.area_ids.filter((id) => id !== areaId)
            : [...data.area_ids, areaId]);
    };

    const title = isEditing ? 'Edit User' : 'Create User';

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Users', href: route('users.index') },
                { label: managedUser?.name || 'Create' },
            ]}
            header={<ResourcePageHeader title={title} backHref={route('users.index')} />}
        >
            <Head title={isEditing ? `Edit User: ${managedUser.name}` : 'Create User'} />

            <ResourceFormShell
                title={title}
                description={isEditing ? 'Update user access and account details.' : 'Create a new dashboard user.'}
                onSubmit={submit}
                submitLabel={isEditing ? 'Save User' : 'Create User'}
                processingLabel={isEditing ? 'Saving...' : 'Creating...'}
                processing={processing}
                cancelHref={route('users.index')}
                maxWidthClassName="max-w-3xl"
            >
                <TextField
                    id="name"
                    label="Name"
                    value={data.name}
                    onChange={(value) => setData('name', value)}
                    required
                    autoFocus
                    maxLength={255}
                    error={errors.name}
                />
                <TextField
                    id="email"
                    label="Email"
                    type="email"
                    value={data.email}
                    onChange={(value) => setData('email', value)}
                    required
                    maxLength={255}
                    error={errors.email}
                />
                <div className="grid gap-4 md:grid-cols-2">
                    <TextField
                        id="password"
                        label={isEditing ? 'New Password' : 'Password'}
                        type="password"
                        value={data.password}
                        onChange={(value) => setData('password', value)}
                        required={!isEditing}
                        error={errors.password}
                    />
                    <TextField
                        id="password_confirmation"
                        label="Confirm Password"
                        type="password"
                        value={data.password_confirmation}
                        onChange={(value) => setData('password_confirmation', value)}
                        required={!isEditing}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={data.role} onValueChange={(value: 'superadmin' | 'admin') => setData('role', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="superadmin">Superadmin</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
                </div>
                {data.role === 'admin' && (
                    <div className="space-y-2">
                        <Label>Area Scope</Label>
                        <div className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
                            {areas.map((area) => (
                                <label key={area.id} className="flex items-center gap-2 text-sm">
                                    <Input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={data.area_ids.includes(area.id)}
                                        onChange={() => toggleArea(area.id)}
                                    />
                                    <span>{area.name}</span>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Leave empty for global admin access.</p>
                        {errors.area_ids && <p className="text-sm text-destructive">{errors.area_ids}</p>}
                    </div>
                )}
            </ResourceFormShell>
        </AuthenticatedLayout>
    );
}
