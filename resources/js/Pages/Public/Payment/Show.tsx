import { useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';
import { Head, useForm } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Separator } from '@/Components/ui/separator';
import { AlertCircle, CheckCircle2, Clock, CreditCard, Building2, Smartphone, Mail } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/Components/ui/alert';

interface Invoice {
    id: number;
    uuid: string;
    code: string;
    period: string;
    amount: number;
    status: string;
    due_date: string;
    customer: {
        name: string;
        address: string;
    };
    payment_link?: string;
}

interface Channel {
    code: string;
    name: string;
    description: string;
    icon_url: string;
    group: string;
}

interface ManualAccount {
    bank: string;
    account_number: string;
    account_name: string;
}

interface Props {
    invoice: Invoice;
    channels: Channel[];
    company: {
        name: string;
        address: string;
    };
    manual_accounts: ManualAccount[];
}

export default function Show({ invoice, channels, company, manual_accounts }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        method: '',
    });

    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

    const handlePay = () => {
        if (!selectedChannel) return;
        setData('method', selectedChannel);
        post(route('public.invoice.pay', invoice.uuid));
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const groupedChannels = channels.reduce((acc, channel) => {
        const group = channel.group;
        if (!acc[group]) acc[group] = [];
        acc[group].push(channel);
        return acc;
    }, {} as Record<string, Channel[]>);

    const isOverdue = invoice.status === 'unpaid' && new Date(invoice.due_date) < new Date();
    const isPaid = invoice.status === 'paid';

    return (
        <PublicLayout>
            <Head title={`Invoice ${invoice.code}`} />

            <div className="space-y-6">
                {/* Status Banner */}
                {isPaid && (
                    <Alert className="border-emerald-500/50 bg-emerald-500/10">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <AlertTitle className="text-emerald-900 dark:text-emerald-100 font-semibold">Payment Confirmed</AlertTitle>
                        <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                            Thank you! Your payment has been received and your service is active.
                        </AlertDescription>
                    </Alert>
                )}

                {isOverdue && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-5 w-5" />
                        <AlertTitle className="font-semibold">Payment Overdue</AlertTitle>
                        <AlertDescription>
                            Service interruption may occur. Please complete payment immediately.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Invoice & Payment */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Invoice Card */}
                        <Card className="border-border">
                            <CardHeader className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-2xl font-bold">
                                                Invoice {invoice.code}
                                            </CardTitle>
                                        </div>
                                        <CardDescription className="text-sm">{company.name}</CardDescription>
                                    </div>
                                    <Badge
                                        variant={isPaid ? 'default' : 'destructive'}
                                        className="text-xs px-3 py-1 uppercase font-semibold"
                                    >
                                        {invoice.status}
                                    </Badge>
                                </div>

                                <Separator />

                                {/* Customer & Date Info */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground font-medium">Customer</p>
                                        <p className="font-semibold">{invoice.customer.name}</p>
                                        <p className="text-xs text-muted-foreground">{invoice.customer.address}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-muted-foreground font-medium">Due Date</p>
                                        <p className="font-semibold flex items-center justify-end gap-1.5">
                                            <Clock className="w-4 h-4" />
                                            {formatDate(invoice.due_date)}
                                        </p>
                                        {isOverdue && (
                                            <p className="text-xs text-destructive font-medium">Overdue</p>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <Separator />

                                {/* Line Item */}
                                <div className="flex justify-between items-center py-3">
                                    <div>
                                        <p className="font-medium">Internet Service</p>
                                        <p className="text-sm text-muted-foreground">
                                            {new Date(invoice.period).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <p className="text-lg font-bold">{formatCurrency(invoice.amount)}</p>
                                </div>

                                <Separator />

                                {/* Total */}
                                <div className="flex justify-between items-center py-4 bg-muted/50 -mx-6 px-6 rounded-lg">
                                    <p className="text-lg font-bold">Total Amount</p>
                                    <p className="text-2xl font-bold text-primary">{formatCurrency(invoice.amount)}</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Payment Methods */}
                        {!isPaid && (
                            <Card className="border-border">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <CreditCard className="w-5 h-5" />
                                        Payment Methods
                                    </CardTitle>
                                    <CardDescription>Choose your preferred payment method below</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Tabs defaultValue="instant" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="instant" className="gap-2">
                                                <Smartphone className="w-4 h-4" />
                                                Instant Payment
                                            </TabsTrigger>
                                            <TabsTrigger value="manual" className="gap-2">
                                                <Building2 className="w-4 h-4" />
                                                Bank Transfer
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="instant" className="mt-6 space-y-4">
                                            {channels.length > 0 ? (
                                                <>
                                                    <p className="text-sm text-muted-foreground">
                                                        Automatic verification • Instant reconnection
                                                    </p>

                                                    {Object.entries(groupedChannels).map(([group, groupChannels]) => (
                                                        <div key={group} className="space-y-3">
                                                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                                {group}
                                                            </h3>
                                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                                                {groupChannels.map((channel) => (
                                                                    <button
                                                                        key={channel.code}
                                                                        onClick={() => {
                                                                            setSelectedChannel(channel.code);
                                                                            setData('method', channel.code);
                                                                        }}
                                                                        className={`
                                                                            relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 
                                                                            transition-all hover:border-primary hover:bg-accent
                                                                            ${selectedChannel === channel.code
                                                                                ? 'border-primary bg-primary/5 shadow-sm'
                                                                                : 'border-border bg-card'
                                                                            }
                                                                        `}
                                                                    >
                                                                        <img
                                                                            src={channel.icon_url}
                                                                            alt={channel.name}
                                                                            className="h-8 w-auto object-contain"
                                                                        />
                                                                        <span className="text-xs font-medium text-center leading-tight">
                                                                            {channel.name}
                                                                        </span>
                                                                        {selectedChannel === channel.code && (
                                                                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                                                                <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                                                                            </div>
                                                                        )}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}

                                                    <Button
                                                        className="w-full mt-6"
                                                        size="lg"
                                                        onClick={handlePay}
                                                        disabled={!selectedChannel || processing}
                                                    >
                                                        {processing ? 'Processing...' : `Pay ${formatCurrency(invoice.amount)}`}
                                                    </Button>
                                                </>
                                            ) : (
                                                <div className="text-center py-12">
                                                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                                        <AlertCircle className="w-6 h-6 text-muted-foreground" />
                                                    </div>
                                                    <p className="font-medium text-muted-foreground mb-1">No Payment Channels Available</p>
                                                    <p className="text-sm text-muted-foreground">Please use bank transfer or contact support.</p>
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="manual" className="mt-6 space-y-4">
                                            <p className="text-sm text-muted-foreground">
                                                Transfer to one of our bank accounts below
                                            </p>

                                            {manual_accounts.length > 0 ? (
                                                <div className="space-y-3">
                                                    {manual_accounts.map((acc, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="p-4 border border-border rounded-lg bg-card hover:bg-accent transition-colors"
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-bold text-base">{acc.bank}</span>
                                                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="font-mono text-lg font-bold text-primary select-all">
                                                                    {acc.account_number}
                                                                </p>
                                                                <p className="text-sm text-muted-foreground uppercase">
                                                                    {acc.account_name}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    <Alert>
                                                        <Mail className="h-4 w-4" />
                                                        <AlertTitle className="text-sm">Confirmation Required</AlertTitle>
                                                        <AlertDescription className="text-xs">
                                                            After transfer, please send payment proof via WhatsApp for verification.
                                                        </AlertDescription>
                                                    </Alert>

                                                    <Button
                                                        variant="outline"
                                                        className="w-full"
                                                        asChild
                                                    >
                                                        <a
                                                            href={`https://wa.me/6289688597253?text=Hi, I've completed payment for Invoice ${invoice.code}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            Confirm via WhatsApp
                                                        </a>
                                                    </Button>
                                                </div>
                                            ) : (
                                                <p className="text-center text-sm text-muted-foreground py-4">
                                                    No manual accounts configured
                                                </p>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right Column - Help Card */}
                    <div className="space-y-6">
                        <Card className="border-border sticky top-24">
                            <CardHeader>
                                <CardTitle className="text-base">Need Assistance?</CardTitle>
                                <CardDescription className="text-xs">Our support team is ready to help</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground mb-1">WhatsApp Support</p>
                                        <a
                                            href="https://wa.me/6289688597253"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-mono text-sm font-bold text-primary hover:underline"
                                        >
                                            0896-8859-7253
                                        </a>
                                    </div>
                                </div>

                                <Separator />

                                <div className="text-xs text-muted-foreground space-y-2">
                                    <p className="font-medium">Payment Help:</p>
                                    <ul className="space-y-1 ml-4 list-disc">
                                        <li>Check payment channel availability</li>
                                        <li>Report payment issues</li>
                                        <li>Request invoice details</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
}
