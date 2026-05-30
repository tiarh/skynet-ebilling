import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Badge } from '@/Components/ui/badge';
import { Activity, CreditCard, DollarSign, AlertCircle, Wifi, Server, CheckCircle2, FileWarning, BarChart3 } from 'lucide-react';

interface Transaction {
    id: number;
    amount: number;
    method: string;
    paid_at: string;
    invoice: {
        id: number;
        period: string;
        customer: {
            id: number;
            name: string;
            code: string | null;
        };
    };
    admin: {
        name: string;
    } | null;
}

interface DashboardStats {
    projected_revenue: number;
    actual_revenue: number;
    outstanding: number;
    overdue_count: number;
    active_customers: number;
    paid_invoices: number;
    unpaid_invoices: number;
    collection_rate: number;
    customers_without_invoice: number;
}

interface Props {
    stats: DashboardStats;
    recent_payments: Transaction[];
}

export default function Dashboard({ stats, recent_payments }: Props) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    const getMethodBadgeVariant = (method: string) => {
        switch (method.toLowerCase()) {
            case 'cash':
                return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
            case 'transfer':
                return 'text-blue-500 border-blue-500/20 bg-blue-500/10';
            case 'payment_gateway':
                return 'text-violet-500 border-violet-500/20 bg-violet-500/10';
            default:
                return 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10';
        }
    };

    return (
        <AuthenticatedLayout header="Dashboard">
            <Head title="Dashboard" />

            <div className="space-y-8 py-8">
                {/* Visual Header with Greeting (Optional, keeps it clean) */}

                {/* Stats Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {/* Projected Revenue */}
                    <Card className="border-border bg-card/50 backdrop-blur-sm hover:bg-card hover:border-border transition-all duration-300 group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                Projected Revenue
                            </CardTitle>
                            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                                <Activity className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tracking-tight text-foreground">
                                {formatCurrency(stats.projected_revenue)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Sum of all active packages
                            </p>
                        </CardContent>
                    </Card>

                    {/* Actual Revenue */}
                    <Card className="border-border bg-card/50 backdrop-blur-sm hover:bg-card hover:border-border transition-all duration-300 group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                Actual Revenue
                            </CardTitle>
                            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                                <DollarSign className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tracking-tight text-foreground">
                                {formatCurrency(stats.actual_revenue)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Collected this month
                            </p>
                        </CardContent>
                    </Card>

                    {/* Outstanding */}
                    <Card className="border-border bg-card/50 backdrop-blur-sm hover:bg-card hover:border-border transition-all duration-300 group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                Outstanding
                            </CardTitle>
                            <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl group-hover:bg-orange-500/20 transition-colors">
                                <CreditCard className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tracking-tight text-foreground">
                                {formatCurrency(stats.outstanding)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Remaining to collect
                            </p>
                        </CardContent>
                    </Card>

                    {/* Overdue Count */}
                    <Card className="border-border bg-card/50 backdrop-blur-sm hover:bg-card hover:border-border transition-all duration-300 group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                Overdue Invoices
                            </CardTitle>
                            <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl group-hover:bg-red-500/20 transition-colors">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tracking-tight text-foreground">
                                {stats.overdue_count}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Unpaid past due date
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Billing Health */}
                <Card className="border-border bg-card/50 backdrop-blur-sm shadow-none">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-blue-500" />
                                    Billing Health
                                </CardTitle>
                                <CardDescription>
                                    Invoice collection status for the current billing period
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="font-mono text-sm">
                                {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Collection Rate Progress Bar */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Collection Rate</span>
                                <span className="font-bold text-lg text-foreground">{stats.collection_rate}%</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-emerald-500 to-emerald-400"
                                    style={{ width: `${Math.min(stats.collection_rate, 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    <span className="text-xs text-muted-foreground">Paid</span>
                                </div>
                                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {stats.paid_invoices}
                                </span>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                    <span className="text-xs text-muted-foreground">Unpaid</span>
                                </div>
                                <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                                    {stats.unpaid_invoices}
                                </span>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <FileWarning className="h-4 w-4 text-orange-500" />
                                    <span className="text-xs text-muted-foreground">Missing</span>
                                </div>
                                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                    {stats.customers_without_invoice}
                                </span>
                            </div>
                        </div>

                        {/* Warning Alert */}
                        {stats.customers_without_invoice > 0 && (
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm">
                                <FileWarning className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-orange-500">
                                        {stats.customers_without_invoice} customer{stats.customers_without_invoice > 1 ? 's' : ''} missing invoices
                                    </p>
                                    <p className="text-muted-foreground text-xs mt-0.5">
                                        Run <code className="bg-orange-500/15 px-1 py-0.5 rounded font-mono text-orange-500">php artisan billing:generate</code> or create invoices manually.
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Payments Table */}
                <Card className="border-border bg-card/50 backdrop-blur-sm shadow-none">
                    <CardHeader>
                        <CardTitle className="text-lg">Recent Payments</CardTitle>
                        <CardDescription>
                            Latest 10 transactions confirmed in the system
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-border">
                                    <TableHead className="w-[180px]">Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead>Admin</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recent_payments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                            No payments recorded yet
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    recent_payments.map((payment) => (
                                        <TableRow key={payment.id} className="group hover:bg-muted/50 border-border transition-colors">
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {formatDate(payment.paid_at)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground">
                                                        {payment.invoice.customer.name}
                                                    </span>
                                                    {payment.invoice.customer.code && (
                                                        <span className="text-xs text-muted-foreground font-mono">
                                                            {payment.invoice.customer.code}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {new Date(payment.invoice.period).toLocaleDateString('id-ID', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`capitalize font-medium ${getMethodBadgeVariant(payment.method)}`}>
                                                    {payment.method.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground group-hover:bg-muted/80 transition-colors">
                                                        {(payment.admin?.name || 'S').charAt(0)}
                                                    </div>
                                                    <span className="text-sm text-muted-foreground">
                                                        {payment.admin?.name.split(' ')[0] || 'System'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold font-mono tracking-tight text-foreground">
                                                {formatCurrency(payment.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
