import { useEffect, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle, Clock } from "lucide-react";
import DataTable, { Column, PaginatedData } from '@/Components/DataTable';

interface Area {
    id: number;
    name: string;
}

interface Campaign {
    id: number;
    name: string;
    message_template: string;
    status: 'draft' | 'processing' | 'completed' | 'failed' | 'paused';
    target_type: string;
    total_recipients: number;
    sent_count: number;
    failed_count: number;
    created_at: string;
    target_area?: Area;
}

interface Customer {
    id: number;
    name: string;
}

interface Recipient {
    id: number;
    wa_campaign_id: number;
    customer_id: number;
    phone_number: string;
    status: 'pending' | 'sent' | 'failed';
    error_message: string | null;
    sent_at: string | null;
    customer: Customer;
}

interface Props {
    campaign: Campaign;
    recipients: PaginatedData<Recipient>;
    filters: any;
}

export default function Show({ campaign, recipients, filters = {} }: Props) {
    const campaignRouteParams = useMemo(() => ({ campaign: campaign.id }), [campaign.id]);

    useEffect(() => {
        if (campaign.status !== 'processing') return;

        const interval = setInterval(() => {
            router.reload({ only: ['campaign', 'recipients'] });
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [campaign.status]);

    const handleRetry = () => {
        if (confirm('Are you sure you want to retry all failed messages?')) {
            router.post(route('broadcasts.retry', campaign.id));
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            completed: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
            processing: 'text-blue-500 border-blue-500/20 bg-blue-500/10',
            failed: 'text-red-500 border-red-500/20 bg-red-500/10',
            draft: 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
            paused: 'text-orange-500 border-orange-500/20 bg-orange-500/10',
            sent: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
            pending: 'text-blue-500 border-blue-500/20 bg-blue-500/10',
        };
        const className = variants[status] || variants.draft;

        return (
            <Badge variant="outline" className={`${className} capitalize border`}>
                {status}
            </Badge>
        );
    };

    const columns: Column<Recipient>[] = [
        {
            header: "Customer",
            accessorKey: "customer",
            cell: (recipient) => (
                <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                        {recipient.customer ? recipient.customer.name : 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                        {recipient.phone_number}
                    </span>
                </div>
            )
        },
        {
            header: "Status",
            accessorKey: "status",
            cell: (recipient) => (
                <div className="flex items-center gap-2">
                    {getStatusBadge(recipient.status)}
                    {recipient.status === 'failed' && (
                        <span className="text-xs text-red-500 flex items-center gap-1 group relative">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[200px]" title={recipient.error_message || ''}>
                                {recipient.error_message}
                            </span>
                        </span>
                    )}
                </div>
            )
        },
        {
            header: "Time",
            accessorKey: "sent_at",
            cell: (recipient) => (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {recipient.sent_at
                        ? new Date(recipient.sent_at).toLocaleTimeString('id-ID')
                        : (recipient.status === 'pending' ? 'Waiting...' : '-')}
                </span>
            )
        }
    ];

    const total = campaign.total_recipients || 1;
    const percent = Math.round(((campaign.sent_count + campaign.failed_count) / total) * 100);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={route('broadcasts.index')}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h2 className="text-xl font-semibold leading-tight text-foreground flex items-center gap-3">
                                {campaign.name}
                                {getStatusBadge(campaign.status)}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Target: <span className="capitalize">{campaign.target_type}</span> {campaign.target_area ? ` (${campaign.target_area.name})` : ' (All Areas)'}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Created on {new Date(campaign.created_at).toLocaleDateString('id-ID', {
                                    year: 'numeric', month: 'long', day: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => router.reload()} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Refresh Status
                        </Button>
                        {campaign.failed_count > 0 && (
                            <Button variant="destructive" onClick={handleRetry} className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Retry Failed ({campaign.failed_count})
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <Head title={`Campaign: ${campaign.name}`} />

            <div className="py-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="col-span-1 md:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h3 className="font-semibold text-lg mb-4">Message Template</h3>
                        <div className="bg-muted p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">
                            {campaign.message_template}
                        </div>
                    </div>

                    <div className="col-span-1 bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
                        <h3 className="font-semibold text-lg">Progress Overview</h3>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{percent}% Complete</span>
                                <span className="text-muted-foreground">
                                    {campaign.sent_count + campaign.failed_count} / {campaign.total_recipients}
                                </span>
                            </div>
                            <div className="h-3 w-full bg-secondary rounded-full overflow-hidden flex">
                                <div className="h-full bg-emerald-500" style={{ width: `${(campaign.sent_count / total) * 100}%` }}></div>
                                <div className="h-full bg-red-500" style={{ width: `${(campaign.failed_count / total) * 100}%` }}></div>
                                <div className="h-full bg-blue-500" style={{ width: `${(Math.max(0, campaign.total_recipients - campaign.sent_count - campaign.failed_count) / total) * 100}%` }}></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Successfully Sent</p>
                                <p className="text-2xl font-bold text-emerald-600 flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5" />
                                    {campaign.sent_count}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Failed to Send</p>
                                <p className="text-2xl font-bold text-red-600 flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5" />
                                    {campaign.failed_count}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <DataTable
                    data={recipients}
                    columns={columns}
                    filters={{ ...filters, campaign: campaign.id }}
                    title="Recipients Log"
                    description="Detailed log of all messages for this campaign"
                    routeName={`broadcasts.show`}
                    routeParams={campaignRouteParams}
                />
            </div>
        </AuthenticatedLayout>
    );
}
