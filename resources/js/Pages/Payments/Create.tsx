import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Separator } from '@/Components/ui/separator';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { FormEventHandler } from 'react';
import { optionalImage, requiredNumber, validateForm } from '@/lib/validation';
import { z } from 'zod';

interface Customer {
    id: number;
    name: string;
    code: string | null;
}

interface Invoice {
    id: number;
    period: string;
    amount: number;
    due_date: string;
    customer: Customer;
}

interface Props {
    invoice: Invoice;
}

const paymentCreateSchema = z.object({
    amount: requiredNumber('Payment amount', 0),
    method: z.enum(['cash', 'transfer', 'payment_gateway'], { error: 'Payment method is required.' }),
    proof: optionalImage('Payment proof'),
});

export default function Create({ invoice }: Props) {
    const form = useForm({
        amount: String(invoice.amount),
        method: 'cash',
        proof: null as File | null,
    });
    const { data, setData, post, processing, errors } = form;

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (!validateForm(paymentCreateSchema, data, form)) return;
        post(`/invoices/${invoice.id}/payments`);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Record Payment
                </h2>
            }
        >
            <Head title="Record Payment" />

            <div className="py-12">
                <div className="mx-auto max-w-3xl sm:px-6 lg:px-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Record Payment for Invoice #{invoice.id}</CardTitle>
                            <CardDescription>
                                Enter payment details below
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Invoice Summary */}
                            <Alert className="mb-6">
                                <AlertDescription>
                                    <div className="grid gap-2 text-sm">
                                        <div>
                                            <span className="font-semibold">Customer:</span> {invoice.customer.name}
                                            {invoice.customer.code && ` (${invoice.customer.code})`}
                                        </div>
                                        <div>
                                            <span className="font-semibold">Period:</span>{' '}
                                            {new Date(invoice.period).toLocaleDateString('id-ID', {
                                                year: 'numeric',
                                                month: 'long',
                                            })}
                                        </div>
                                        <div>
                                            <span className="font-semibold">Invoice Amount:</span>{' '}
                                            <span className="text-lg font-bold">{formatCurrency(invoice.amount)}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold">Due Date:</span> {formatDate(invoice.due_date)}
                                        </div>
                                    </div>
                                </AlertDescription>
                            </Alert>

                            <Separator className="my-6" />

                            {/* Payment Form */}
                            <form onSubmit={submit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="amount">Payment Amount *</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={data.amount}
                                        onChange={(e) => setData('amount', e.target.value)}
                                        required
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        You can enter a partial payment amount
                                    </p>
                                    {errors.amount && (
                                        <p className="text-sm text-destructive">{errors.amount}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="method">Payment Method *</Label>
                                    <Select
                                        value={data.method}
                                        onValueChange={(value) => setData('method', value)}
                                        required
                                    >
                                        <SelectTrigger id="method">
                                            <SelectValue placeholder="Select payment method" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="transfer">Bank Transfer</SelectItem>
                                            <SelectItem value="payment_gateway">Payment Gateway</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.method && (
                                        <p className="text-sm text-destructive">{errors.method}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="proof">Payment Proof (Optional)</Label>
                                    <Input
                                        id="proof"
                                        type="file"
                                        accept="image/jpeg,image/png,image/jpg"
                                        onChange={(e) => setData('proof', e.target.files?.[0] || null)}
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Upload receipt, screenshot, or transaction proof as an image. Max 2MB.
                                    </p>
                                    {errors.proof && (
                                        <p className="text-sm text-destructive">{errors.proof}</p>
                                    )}
                                </div>

                                <Separator />

                                <div className="flex justify-end gap-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => window.history.back()}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={processing}>
                                        {processing ? 'Recording...' : 'Record Payment'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
