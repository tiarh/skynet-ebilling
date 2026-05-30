import { useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Eye, PlusCircle, Send } from "lucide-react";
import DataTable, { Column, PaginatedData, FilterConfig } from '@/Components/DataTable';

interface Area {
    id: number;
    name: string;
}

interface Campaign {
    id: number;
    name: string;
    status: 'draft' | 'processing' | 'completed' | 'failed' | 'paused';
    target_type: string;
    total_recipients: number;
    sent_count: number;
    failed_count: number;
    created_at: string;
    target_area?: Area;
}

interface Props {
    campaigns: PaginatedData<Campaign>;
    filters: any;
}

export default function Index({ campaigns, filters }: Props) {
    useEffect(() => {
        // Only poll if there's at least one campaign that is currently processing
        const hasProcessing = campaigns.data.some(c => c.status === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(() => {
            router.reload({ only: ['campaigns'] });
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [campaigns]);

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            completed: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
            processing: 'text-blue-500 border-blue-500/20 bg-blue-500/10',
            failed: 'text-red-500 border-red-500/20 bg-red-500/10',
            draft: 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
            paused: 'text-orange-500 border-orange-500/20 bg-orange-500/10',
        };
        const className = variants[status] || variants.draft;

        return (
            <Badge variant="outline" className={`${className} capitalize border`}>
                {status}
            </Badge>
        );
    };

    const columns: Column<Campaign>[] = [
        {
            header: "Name",
            accessorKey: "name",
            cell: (campaign) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{campaign.name}</span>
                    <span className="text-xs text-muted-foreground">
                        Target: <span className="capitalize">{campaign.target_type}</span>
                        {campaign.target_area ? ` (${campaign.target_area.name})` : ' (All Areas)'}
                    </span>
                </div>
            )
        },
        {
            header: "Date",
            accessorKey: "created_at",
            cell: (campaign) => (
                <span className="text-sm">
                    {new Date(campaign.created_at).toLocaleDateString('id-ID', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    })}
                </span>
            )
        },
        {
            header: "Progress",
            accessorKey: "sent_count",
            cell: (campaign) => {
                const total = campaign.total_recipients || 1;
                const percent = Math.round(((campaign.sent_count + campaign.failed_count) / total) * 100);

                return (
                    <div className="flex flex-col gap-1 w-full max-w-[150px]">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-emerald-600 font-medium">{campaign.sent_count} sent</span>
                            {campaign.failed_count > 0 && <span className="text-red-500 font-medium">{campaign.failed_count} err</span>}
                            <span className="text-muted-foreground">{campaign.total_recipients} total</span>
                        </div>
                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${percent}%` }}></div>
                        </div>
                    </div>
                );
            }
        },
        {
            header: "Status",
            accessorKey: "status",
            cell: (campaign) => getStatusBadge(campaign.status)
        },
        {
            header: "Actions",
            className: "text-right",
            cell: (campaign) => (
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        title="View Details"
                        onClick={() => router.visit(route('broadcasts.show', campaign.id))}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ];

    const filterConfigs: FilterConfig[] = [
        {
            key: 'status',
            placeholder: 'All Status',
            options: [
                { label: 'Processing', value: 'processing' },
                { label: 'Completed', value: 'completed' },
                { label: 'Failed', value: 'failed' },
            ]
        }
    ];

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold leading-tight text-foreground flex items-center gap-2">
                        <Send className="h-5 w-5 text-primary" />
                        WhatsApp Broadcasts
                    </h2>
                    <Link href={route('broadcasts.create')}>
                        <Button className="gap-2">
                            <PlusCircle className="h-4 w-4" />
                            New Campaign
                        </Button>
                    </Link>
                </div>
            }
        >
            <Head title="WhatsApp Broadcasts" />

            <div className="py-8">
                <DataTable
                    data={campaigns}
                    columns={columns}
                    filters={filters}
                    filterConfigs={filterConfigs}
                    title="Campaigns"
                    description={`Showing ${campaigns.data.length} of ${campaigns.total} campaigns`}
                    searchPlaceholder="Search Campaigns..."
                    routeName="broadcasts.index"
                    onRowClick={(item: Campaign) => router.visit(route('broadcasts.show', item.id))}
                />
            </div>
        </AuthenticatedLayout>
    );
}
