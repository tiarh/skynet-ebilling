import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, usePage, router } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Badge } from '@/Components/ui/badge';
import { Separator } from '@/Components/ui/separator';
import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/Components/ui/dialog";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import {
    User, MapPin, Phone, Hash, Calendar, DollarSign,
    CreditCard, FileText, CheckCircle2, Clock, AlertCircle,
    Download, ExternalLink, Plus, ChevronLeft, Ban, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { optionalImage, requiredNumber, requiredString, validateForm } from '@/lib/validation';
import { z } from 'zod';

interface Customer {
    id: number;
    name: string;
    code: string | null;
    phone: string | null;
    address: string;
}

interface Transaction {
    id: number;
    amount: number;
    method: string;
    paid_at: string;
    proof_url?: string | null;
    admin: {
        name: string;
    } | null;
}

interface Invoice {
    id: number;
    code: string;
    period: string;
    amount: number;
    status: 'unpaid' | 'paid' | 'void';
    due_date: string;
    generated_at: string;
    customer: Customer;
    transactions: Transaction[];
}

interface Props {
    invoice: Invoice;
}

import { PageProps } from '@/types';

const paymentSchema = z.object({
    amount: requiredNumber('Payment amount', 0),
    method: z.enum(['cash', 'transfer', 'payment_gateway'], { error: 'Payment method is required.' }),
    paid_at: requiredString('Payment date'),
    proof: optionalImage('Payment proof'),
});

export default function Show({ invoice }: Props) {
    const { settings, auth } = usePage<PageProps>().props;
    const isAdmin = auth.user.role === 'admin' || auth.user.role === 'superadmin';
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [isVoidOpen, setIsVoidOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [voidProcessing, setVoidProcessing] = useState(false);
    const [deleteProcessing, setDeleteProcessing] = useState(false);

    const totalPaid = invoice.transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const balance = Number(invoice.amount) - totalPaid;
    const hasTransactions = invoice.transactions.length > 0;

    const paymentForm = useForm({
        amount: String(balance),
        method: 'cash',
        paid_at: new Date().toISOString().slice(0, 16), // datetime-local format
        proof: null as File | null,
    });
    const { data, setData, post, processing, errors, reset } = paymentForm;

    const handleVoid = () => {
        setVoidProcessing(true);
        router.post(route('invoices.void', invoice.id), { reason: voidReason }, {
            onSuccess: () => {
                setIsVoidOpen(false);
                setVoidReason('');
                toast.success('Invoice has been voided.');
            },
            onFinish: () => setVoidProcessing(false),
        });
    };

    const handleDelete = () => {
        setDeleteProcessing(true);
        router.delete(route('invoices.destroy', invoice.id), {
            onSuccess: () => {
                toast.success('Invoice deleted successfully.');
            },
            onFinish: () => setDeleteProcessing(false),
        });
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

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            paid: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 border-emerald-200 dark:border-emerald-800',
            unpaid: 'bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/25 border-red-200 dark:border-red-800',
            void: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 hover:bg-gray-500/25 border-gray-200 dark:border-gray-800',
        };
        return variants[status] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const handlePaymentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm(paymentSchema, data, paymentForm)) return;
        post(route('payments.store', invoice.id), {
            onSuccess: () => {
                setIsPaymentOpen(false);
                reset();
                toast.success('Payment recorded successfully');
            },
        });
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: 'Invoices', href: route('invoices.index') },
                { label: `Invoice #${invoice.id}` }
            ]}
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={route('invoices.index')}>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h2 className="text-xl font-semibold leading-tight text-foreground">
                                Invoice #{invoice.code || invoice.id}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {invoice.customer.name} • {formatDate(invoice.generated_at)}
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                        <a href={route('invoices.download', invoice.id)} target="_blank">
                            <Download className="w-4 h-4" />
                            Download PDF
                        </a>
                    </Button>
                </div>
            }
        >
            <Head title={`Invoice: #${invoice.id}`} />

            <div className="py-8">
                <div className="mx-auto max-w-5xl space-y-6">
                    {/* Status Banner */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-6 rounded-xl border border-border bg-card shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${invoice.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                                {invoice.status === 'paid' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">
                                    {invoice.status === 'paid' ? 'Invoice Paid' : 'Payment Pending'}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {invoice.status === 'paid'
                                        ? 'This invoice has been fully settled.'
                                        : `Due on ${formatDate(invoice.due_date)}`
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Payment Dialog */}
                            {isAdmin && invoice.status === 'unpaid' && (
                                <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                                            <CreditCard className="w-4 h-4" />
                                            Record Payment
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[425px]">
                                        <DialogHeader>
                                            <DialogTitle>Record Payment</DialogTitle>
                                            <DialogDescription>
                                                Enter the payment details for Invoice #{invoice.id}.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handlePaymentSubmit} className="space-y-4 pt-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="amount">Amount (IDR)</Label>
                                                <Input
                                                    id="amount"
                                                    type="number"
                                                    value={data.amount}
                                                    onChange={(e) => setData('amount', e.target.value)}
                                                    min={0}
                                                    max={balance}
                                                    step="0.01"
                                                    required
                                                />
                                                {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
                                                <p className="text-xs text-muted-foreground">
                                                    Max payable: {formatCurrency(balance)}
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="date">Payment Date</Label>
                                                <Input
                                                    id="date"
                                                    type="datetime-local"
                                                    value={data.paid_at}
                                                    onChange={(e) => setData('paid_at', e.target.value)}
                                                    required
                                                />
                                                {errors.paid_at && <p className="text-sm text-destructive">{errors.paid_at}</p>}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="method">Payment Method</Label>
                                                <Select
                                                    value={data.method}
                                                    onValueChange={(val) => setData('method', val)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select method" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="cash">Cash</SelectItem>
                                                        <SelectItem value="transfer">Bank Transfer</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {errors.method && <p className="text-sm text-destructive">{errors.method}</p>}
                                            </div>

                                            {data.method === 'transfer' && (
                                                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                                                    <p className="font-semibold mb-1">Bank Account Details:</p>
                                                    {settings.payment_channels && settings.payment_channels.length > 0 ? (
                                                        settings.payment_channels.map((channel, i) => (
                                                            <p key={i}>
                                                                {channel.bank}: {channel.account_number} ({channel.account_name})
                                                            </p>
                                                        ))
                                                    ) : (
                                                        <p className="italic text-xs">No bank accounts configured.</p>
                                                    )}
                                                    <p className="mt-1 text-xs opacity-80">Please upload the transfer receipt below.</p>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <Label htmlFor="proof">Proof of Payment (Image)</Label>
                                                <Input
                                                    id="proof"
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/jpg"
                                                    onChange={(e) => setData('proof', e.target.files ? e.target.files[0] : null)}
                                                />
                                                {errors.proof && <p className="text-sm text-destructive">{errors.proof}</p>}
                                            </div>

                                            <DialogFooter className="pt-4">
                                                <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>
                                                    Cancel
                                                </Button>
                                                <Button type="submit" disabled={processing}>
                                                    {processing ? 'Recording...' : 'Save Payment'}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            )}

                            {/* Void Invoice Dialog */}
                            {isAdmin && invoice.status === 'unpaid' && (
                                <Dialog open={isVoidOpen} onOpenChange={setIsVoidOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20">
                                            <Ban className="w-4 h-4" />
                                            Void
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[425px]">
                                        <DialogHeader>
                                            <DialogTitle>Void Invoice</DialogTitle>
                                            <DialogDescription>
                                                This will mark the invoice as void. The record will be kept for auditing purposes.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 pt-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="reason">Reason (optional)</Label>
                                                <Textarea
                                                    id="reason"
                                                    placeholder="e.g. Customer terminated, duplicate invoice..."
                                                    value={voidReason}
                                                    onChange={(e) => setVoidReason(e.target.value)}
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter className="pt-4">
                                            <Button type="button" variant="outline" onClick={() => setIsVoidOpen(false)}>
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleVoid}
                                                disabled={voidProcessing}
                                                className="bg-orange-600 hover:bg-orange-700 text-white"
                                            >
                                                {voidProcessing ? 'Voiding...' : 'Void Invoice'}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}

                            {/* Delete Invoice Dialog */}
                            {isAdmin && !hasTransactions && (invoice.status === 'unpaid' || invoice.status === 'void') && (
                                <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="gap-2 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20">
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[425px]">
                                        <DialogHeader>
                                            <DialogTitle className="text-red-600">Delete Invoice</DialogTitle>
                                            <DialogDescription>
                                                This will permanently delete Invoice #{invoice.code || invoice.id}. This action cannot be undone.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter className="pt-4">
                                            <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleDelete}
                                                disabled={deleteProcessing}
                                                variant="destructive"
                                            >
                                                {deleteProcessing ? 'Deleting...' : 'Delete Permanently'}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Customer Info Card */}
                        <Card className="shadow-sm border-border">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    Customer Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                <div className="space-y-1">
                                    <Link href={`/customers/${invoice.customer.id}`} className="font-semibold text-lg hover:underline text-foreground">
                                        {invoice.customer.name}
                                    </Link>
                                    {invoice.customer.code && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Hash className="w-3.5 h-3.5" />
                                            <span>{invoice.customer.code}</span>
                                        </div>
                                    )}
                                </div>
                                <Separator />
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-start gap-3">
                                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                                        <span className="text-muted-foreground">{invoice.customer.address}</span>
                                    </div>
                                    {invoice.customer.phone && (
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">{invoice.customer.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Invoice Summary Card */}
                        <Card className="shadow-sm border-border">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                    Invoice Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground">Billing Period</p>
                                        <p className="font-medium flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                            {new Date(invoice.period).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground">Generated On</p>
                                        <p className="font-medium flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                            {formatDate(invoice.generated_at)}
                                        </p>
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="font-medium">{formatCurrency(invoice.amount)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Total Paid</span>
                                        <span className="font-medium text-emerald-600">-{formatCurrency(totalPaid)}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="font-semibold">Balance Due</span>
                                        <span className="font-bold text-xl text-foreground">{formatCurrency(balance)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Payment History */}
                    <Card className="shadow-sm border-border">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Payment History</CardTitle>
                                <CardDescription>
                                    Transactions recorded for this invoice
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="font-mono">
                                {invoice.transactions.length} Transactions
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableHead>Date</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead>Recorded By</TableHead>
                                        {isAdmin && <TableHead>Proof</TableHead>}
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoice.transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={isAdmin ? 5 : 4} className="h-24 text-center text-muted-foreground">
                                                No payments found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        invoice.transactions.map((t) => (
                                            <TableRow key={t.id}>
                                                <TableCell className="font-medium">
                                                    {formatDateTime(t.paid_at)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="capitalize">
                                                        {t.method.replace('_', ' ')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {t.admin?.name || 'System'}
                                                </TableCell>
                                                {isAdmin && (
                                                    <TableCell>
                                                        {t.proof_url ? (
                                                            <a
                                                                href={t.proof_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                                View
                                                            </a>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">-</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(t.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
