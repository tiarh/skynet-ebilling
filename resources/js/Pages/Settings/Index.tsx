import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { toast } from 'sonner';
import { validateForm } from '@/lib/validation';
import { z } from 'zod';



interface Props {
    settings: any;
    grouped_settings: {
        billing: {
            company_name: string;
            company_address: string;
        };
    };
}

const settingsSchema = z.object({
    company_name: z.string().max(255, 'Company name may not be greater than 255 characters.'),
    company_address: z.string(),
});

export default function Index({ grouped_settings }: Props) {
    // We maintain a local form state specifically for the payment channels structure
    // but when submitting, we map it to the generic 'settings' array structure expected by the backend
    const form = useForm({
        company_name: grouped_settings.billing.company_name,
        company_address: grouped_settings.billing.company_address,
    });
    const { data, setData, processing, errors } = form;



    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm(settingsSchema, data, form)) return;

        // Transform flat data into the backend-expected Settings array format
        const settingsPayload = [
            {
                key: 'company_name',
                value: data.company_name,
                type: 'text',
                group: 'billing'
            },
            {
                key: 'company_address',
                value: data.company_address,
                type: 'text',
                group: 'billing'
            },
        ];

        router.post(route('settings.update'), { settings: settingsPayload as any }, {
            onSuccess: () => toast.success('Settings updated successfully'),
            onError: (serverErrors) => {
                form.setError(serverErrors as Record<string, string>);
                toast.error('Failed to update settings');
            },
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-foreground">
                    Settings
                </h2>
            }
        >
            <Head title="Settings" />

            <div className="py-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Company Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Company Details</CardTitle>
                                <CardDescription>Information used in invoices and receipts.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Company Name</Label>
                                    <Input
                                        value={data.company_name}
                                        onChange={e => setData('company_name', e.target.value)}
                                        placeholder="e.g. PT. SKYNET LINTAS NUSANTARA"
                                        maxLength={255}
                                    />
                                    {errors.company_name && <p className="text-sm text-destructive">{errors.company_name}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Address</Label>
                                    <Input
                                        value={data.company_address}
                                        onChange={e => setData('company_address', e.target.value)}
                                        placeholder="Full address"
                                    />
                                    {errors.company_address && <p className="text-sm text-destructive">{errors.company_address}</p>}
                                </div>
                            </CardContent>
                        </Card>



                        <div className="flex justify-end">
                            <Button type="submit" size="lg" disabled={processing}>
                                <Save className="w-4 h-4 mr-2" />
                                {processing ? 'Saving...' : 'Save Settings'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
