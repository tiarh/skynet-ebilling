import { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Eye, CreditCard, Calendar, AlertCircle, MoreHorizontal, Plus, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/Components/ui/dropdown-menu";
import DataTable, { Column, FilterConfig, PaginatedData } from '@/Components/DataTable';
import { PageProps } from '@/types';

interface Customer {
    id: number;
    name: string;
    code: string | null;
}

interface Invoice {
    id: number;
    code: string | null;
    period: string;
    amount: number;
    status: 'unpaid' | 'paid' | 'void';
    due_date: string;
    customer: Customer;
}

interface Props {
    invoices: PaginatedData<Invoice>;
    filters: {
        search?: string;
        status?: string;
        sort?: string;
        direction?: 'asc' | 'desc';
        limit?: string;
    };
}

export default function Index({ invoices, filters = {} }: Props) {
    const { auth } = usePage<PageProps>().props;
    const isAdmin = auth.user.role === 'admin' || auth.user.role === 'superadmin';

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
            month: 'short',
            day: 'numeric',
        });
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            paid: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
            unpaid: 'text-red-500 border-red-500/20 bg-red-500/10',
            void: 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
        };
        const className = variants[status] || 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10';

        return (
            <Badge variant="outline" className={`${className} capitalize border`}>
                {status}
            </Badge>
        );
    };

    const isOverdue = (invoice: Invoice) => {
        return invoice.status === 'unpaid' && new Date(invoice.due_date) < new Date();
    };

    const columns: Column<Invoice>[] = [
        {
            header: "ID",
            className: "w-[80px]",
            cell: (invoice) => (
                <span className="font-mono text-xs text-muted-foreground font-medium">
                    #{invoice.id}
                </span>
            )
        },
        {
            header: "Code",
            accessorKey: "code",
            className: "w-[180px]",
            cell: (invoice) => (
                <span className="font-mono text-xs font-semibold">
                    {invoice.code}
                </span>
            )
        },
        {
            header: "Customer",
            accessorKey: "customer", // Sorting might need specific handling backend side if we want to sort by customer name
            sortable: false,
            cell: (invoice) => (
                <div className="flex flex-col">
                    <Link
                        href={route('customers.show', invoice.customer.id)}
                        className="font-medium text-foreground hover:underline"
                    >
                        {invoice.customer.name}
                    </Link>
                    {invoice.customer.code && (
                        <span className="text-xs text-muted-foreground">
                            {invoice.customer.code}
                        </span>
                    )}
                </div>
            )
        },
        {
            header: "Period",
            accessorKey: "period",
            sortable: true,
            cell: (invoice) => (
                <span className="font-medium">
                    {new Date(invoice.period).toLocaleDateString('id-ID', {
                        month: 'long',
                        year: 'numeric'
                    })}
                </span>
            )
        },
        {
            header: "Amount",
            accessorKey: "amount",
            cell: (invoice) => (
                <span className="font-mono">
                    {formatCurrency(invoice.amount)}
                </span>
            )
        },
        {
            header: "Status",
            accessorKey: "status",
            sortable: true,
            cell: (invoice) => getStatusBadge(invoice.status)
        },
        {
            header: "Due Date",
            accessorKey: "due_date",
            cell: (invoice) => (
                <div className="flex flex-col gap-1">
                    <div className={`flex items-center gap-2 text-sm ${isOverdue(invoice) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(invoice.due_date)}</span>
                    </div>
                    {isOverdue(invoice) && (
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 animate-pulse mt-0.5">
                            <AlertCircle className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Overdue</span>
                        </div>
                    )}
                </div>
            )
        },
        {
            header: "Actions",
            className: "text-right w-[120px]",
            cell: (invoice) => (
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    {isAdmin && invoice.status === 'unpaid' && (
                        <Link href={route('invoices.show', invoice.id)}>
                            <Button size="sm" className="h-8 px-2 text-xs">
                                <CreditCard className="mr-1.5 h-3 w-3" />
                                Pay
                            </Button>
                        </Link>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        title="View Details"
                        onClick={() => router.visit(route('invoices.show', invoice.id))}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                        title="Download PDF"
                        onClick={() => window.open(route('invoices.download', invoice.id), '_blank')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
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
                { label: 'Paid', value: 'paid' },
                { label: 'Unpaid', value: 'unpaid' },
                { label: 'Void', value: 'void' },
            ]
        }
    ];

    const exportUrl = () => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                params.set(key, String(value));
            }
        });

        const query = params.toString();
        return query ? `${route('invoices.export')}?${query}` : route('invoices.export');
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold leading-tight text-foreground">
                        Invoices
                    </h2>
                    <div className="flex items-center gap-2">
                        <a href={exportUrl()}>
                            <Button variant="outline" className="gap-2">
                                <Download className="h-4 w-4" />
                                Export XLSX
                            </Button>
                        </a>
                        {isAdmin && (
                            <Link href={route('invoices.create')}>
                                <Button className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Create Invoice
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Invoices" />

            <div className="py-8">
                <DataTable
                    data={invoices}
                    columns={columns}
                    filters={filters}
                    title="Invoices"
                    description={`Showing ${invoices.data.length} of ${invoices.total} invoices`}
                    searchPlaceholder="Search Customer, Code..."
                    filterConfigs={filterConfigs}
                    routeName="invoices.index"
                    onRowClick={(item: Invoice) => router.visit(route('invoices.show', item.id))}
                />
            </div>
        </AuthenticatedLayout>
    );
}
