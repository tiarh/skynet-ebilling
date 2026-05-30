import { useState, useEffect, ReactNode } from 'react';
import { router } from '@inertiajs/react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { DataTableToolbar } from '@/Components/DataTableToolbar';
import { DataTablePagination } from '@/Components/DataTablePagination';

// Helper for debounce
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

// Generic Types
export interface Column<T> {
    header: string;
    accessorKey?: keyof T;
    cell?: (item: T) => ReactNode;
    sortable?: boolean;
    className?: string; // For applying column specific styles like width or alignment
}

export interface FilterOption {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>; // Enhanced to support icons
}

export interface FilterConfig {
    key: string;
    placeholder: string;
    options: FilterOption[];
}

export interface PaginatedData<T> {
    data: T[];
    path: string;
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

interface DataTableProps<T> {
    data: PaginatedData<T>;
    columns: Column<T>[];
    title: string;
    description?: string;
    resourceName?: string; // e.g. "customers" for route generation if needed, mostly for logging/debugging
    filters?: Record<string, any>; // Current filter processing from backend
    searchPlaceholder?: string;
    filterConfigs?: FilterConfig[]; // Dropdown filters configuration
    actions?: ReactNode; // Slot for "Add Button" etc.
    loading?: boolean;
    onRowClick?: (item: T) => void;
    mobileCard?: (item: T) => ReactNode;
    routeName: string; // Base route name for router.get() e.g. "customers.index"
    routeParams?: any; // Parameters required for the route e.g. { id: 1 }
}

export default function DataTable<T extends { id: number | string }>({
    data,
    columns,
    title,
    description,
    filters = {},
    searchPlaceholder = "Search...",
    filterConfigs = [],
    actions,
    onRowClick,
    mobileCard,
    routeName,
    routeParams
}: DataTableProps<T>) {
    const safeFilters = Array.isArray(filters) ? {} : (filters || {});

    // State
    const [search, setSearch] = useState(safeFilters.search || '');
    const [limit, setLimit] = useState<number>(safeFilters.limit || data.per_page || 20);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        filterConfigs.forEach(config => {
            initial[config.key] = safeFilters[config.key] || 'all';
        });
        return initial;
    });

    const [sortField, setSortField] = useState<string>(
        (typeof safeFilters.sort === 'string') ? safeFilters.sort : 'created_at'
    );
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
        safeFilters.direction === 'asc' ? 'asc' : 'desc'
    );
    const [isLoading, setIsLoading] = useState(false);

    const debouncedSearch = useDebounce(search, 350);

    // Effect to trigger search/filter
    useEffect(() => {
        const params: Record<string, any> = {
            search: debouncedSearch,
            sort: sortField,
            direction: sortDirection,
            limit: limit,
        };

        // Add active filters excluding 'all'
        Object.keys(activeFilters).forEach(key => {
            if (activeFilters[key] !== 'all') {
                params[key] = activeFilters[key];
            }
        });

        setIsLoading(true);
        router.get(
            route(routeName, routeParams),
            params,
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onFinish: () => setIsLoading(false)
            }
        );
    }, [debouncedSearch, activeFilters, sortField, sortDirection, limit, routeName, routeParams]);

    // Handlers
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleFilterChange = (key: string, value: string) => {
        setActiveFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleReset = () => {
        setSearch('');
        const resetFilters: Record<string, string> = {};
        filterConfigs.forEach(config => {
            resetFilters[config.key] = 'all';
        });
        setActiveFilters(resetFilters);
        setSortField('created_at');
        setSortDirection('desc');
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (sortField !== field) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground/50" />;
        return sortDirection === 'asc'
            ? <ArrowUp className="ml-2 h-3 w-3 text-foreground" />
            : <ArrowDown className="ml-2 h-3 w-3 text-foreground" />;
    };

    return (
        <div className="space-y-4">
            {/* Filter Bar */}
            <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                activeFilters={activeFilters}
                filterConfigs={filterConfigs}
                onFilterChange={handleFilterChange}
                onReset={handleReset}
                searchPlaceholder={searchPlaceholder}
                actions={actions}
            />

            {/* Table Card */}
            <Card className="border-border bg-card shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>{title}</CardTitle>
                            {description && (
                                <CardDescription className="mt-1.5 flex items-center gap-2">
                                    {description}
                                    {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                </CardDescription>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {mobileCard && (
                        <div className="space-y-3 md:hidden">
                            {data.data.length === 0 ? (
                                <div className="flex h-48 flex-col items-center justify-center rounded-md border border-border text-center text-muted-foreground">
                                    <p className="text-lg font-medium">No results found</p>
                                    <p className="text-sm">Try adjusting your search or filters</p>
                                    <Button variant="link" onClick={handleReset} className="mt-2">
                                        Clear all filters
                                    </Button>
                                </div>
                            ) : (
                                data.data.map((item) => (
                                    <div
                                        key={item.id}
                                        className={onRowClick ? 'cursor-pointer' : ''}
                                        onClick={() => onRowClick && onRowClick(item)}
                                    >
                                        {mobileCard(item)}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    <div className={`rounded-md border border-border overflow-hidden ${mobileCard ? 'hidden md:block' : ''}`}>
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="border-border hover:bg-muted/50">
                                    {columns.map((col, idx) => (
                                        <TableHead key={idx} className={col.className}>
                                            {col.sortable && col.accessorKey ? (
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => handleSort(col.accessorKey as string)}
                                                    className="-ml-4 h-8 data-[state=open]:bg-accent text-xs uppercase font-medium"
                                                >
                                                    {col.header}
                                                    <SortIcon field={col.accessorKey as string} />
                                                </Button>
                                            ) : (
                                                <span className="text-xs uppercase font-medium text-muted-foreground">{col.header}</span>
                                            )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="h-48 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <p className="text-lg font-medium">No results found</p>
                                                <p className="text-sm">Try adjusting your search or filters</p>
                                                <Button variant="link" onClick={handleReset} className="mt-2">
                                                    Clear all filters
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.data.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            className={`group border-border transition-colors hover:bg-muted/50 ${onRowClick ? 'cursor-pointer' : ''}`}
                                            onClick={() => onRowClick && onRowClick(item)}
                                        >
                                            {columns.map((col, idx) => (
                                                <TableCell key={idx} className={col.className}>
                                                    {col.cell
                                                        ? col.cell(item)
                                                        : (col.accessorKey ? (item[col.accessorKey] as ReactNode) : null)
                                                    }
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <DataTablePagination
                        data={data}
                        filters={{ ...filters, limit }}
                        onPageSizeChange={(newLimit) => setLimit(newLimit)}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
