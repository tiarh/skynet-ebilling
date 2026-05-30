import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { router } from "@inertiajs/react";
import { Button } from "@/Components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { PaginatedData } from "@/Components/DataTable";

interface DataTablePaginationProps<T> {
    data: PaginatedData<T>;
    filters?: Record<string, any>;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
}

export function DataTablePagination<T>({
    data,
    filters = {},
    onPageChange,
    onPageSizeChange,
}: DataTablePaginationProps<T>) {
    const handlePageChange = (page: number) => {
        if (onPageChange) {
            onPageChange(page);
        } else {
            router.get(data.path, { ...filters, page: page, limit: data.per_page }, {
                preserveScroll: true,
                preserveState: true,
            });
        }
    };

    const handlePageSizeChange = (val: string) => {
        const pageSize = Number(val);
        if (onPageSizeChange) {
            onPageSizeChange(pageSize);
        } else {
            router.get(data.path, { ...filters, limit: val }, {
                preserveState: true,
                preserveScroll: true
            });
        }
    };

    return (
        <div className="flex items-center justify-between px-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{data.from || 0}</span> to <span className="font-medium text-foreground">{data.to || 0}</span> of <span className="font-medium text-foreground">{data.total}</span> records
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8">
                <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">Rows per page</p>
                    <Select
                        value={data.per_page ? String(data.per_page) : "20"}
                        onValueChange={handlePageSizeChange}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder="20" />
                        </SelectTrigger>
                        <SelectContent>
                            {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                    Page {data.current_page} of {data.last_page}
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => handlePageChange(1)}
                        disabled={data.current_page === 1}
                    >
                        <span className="sr-only">Go to first page</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                            const prevUrl = data.links[0]?.url;
                            if (prevUrl && !onPageChange) {
                                router.get(prevUrl, { limit: data.per_page }, {
                                    preserveScroll: true,
                                    preserveState: true,
                                });
                            } else if (onPageChange) {
                                handlePageChange(data.current_page - 1);
                            }
                        }}
                        disabled={data.current_page === 1}
                    >
                        <span className="sr-only">Go to previous page</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                            const nextUrl = data.links[data.links.length - 1]?.url;
                            if (nextUrl && !onPageChange) {
                                router.get(nextUrl, { limit: data.per_page }, {
                                    preserveScroll: true,
                                    preserveState: true,
                                });
                            } else if (onPageChange) {
                                handlePageChange(data.current_page + 1);
                            }
                        }}
                        disabled={data.current_page === data.last_page}
                    >
                        <span className="sr-only">Go to next page</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => handlePageChange(data.last_page)}
                        disabled={data.current_page === data.last_page}
                    >
                        <span className="sr-only">Go to last page</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
