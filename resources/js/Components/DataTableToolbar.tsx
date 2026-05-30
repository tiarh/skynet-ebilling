import { X } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { DataTableFacetedFilter } from "@/Components/DataTableFacetedFilter";
import { FilterConfig } from "@/Components/DataTable";
import { ReactNode } from "react";

interface DataTableToolbarProps {
    search: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    activeFilters: Record<string, string>; // Kept as string for compatibility, but we might want to support arrays
    filterConfigs: FilterConfig[];
    onFilterChange: (key: string, value: string) => void;
    onReset: () => void;
    actions?: ReactNode;
}

export function DataTableToolbar({
    search,
    onSearchChange,
    searchPlaceholder = "Search...",
    activeFilters,
    filterConfigs,
    onFilterChange,
    onReset,
    actions,
}: DataTableToolbarProps) {
    const isFiltered = search.length > 0 || Object.values(activeFilters).some(v => v !== 'all');

    return (
        <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-border bg-card shadow-sm transition-all items-start sm:items-center">
            <div className="flex flex-1 flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
                <div className="relative w-full sm:w-[250px] lg:w-[300px]">
                    <Input
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="h-8 w-full bg-background border-input focus-visible:ring-ring pl-9"
                    />
                    <div className="absolute left-2.5 top-2 text-muted-foreground pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search h-4 w-4"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    </div>
                </div>

                {filterConfigs.map(config => {
                    // Adapt the single value "all" | string to Set<string> for FacetedFilter
                    const selectedValue = activeFilters[config.key] || 'all';
                    const selectedSet = new Set(selectedValue !== 'all' ? selectedValue.split(',') : []);

                    return (
                        <DataTableFacetedFilter
                            key={config.key}
                            title={config.placeholder}
                            options={config.options}
                            selectedValues={selectedSet}
                            onSelect={(values) => {
                                // Convert Set to comma separated string or 'all'
                                const newValues = Array.from(values);
                                const newVal = newValues.length > 0 ? newValues.join(',') : 'all';
                                onFilterChange(config.key, newVal);
                            }}
                        />
                    );
                })}

                {isFiltered && (
                    <Button
                        variant="ghost"
                        onClick={onReset}
                        className="h-8 px-2 lg:px-3 text-muted-foreground hover:text-destructive"
                    >
                        Reset
                        <X className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>

            {actions && (
                <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto justify-end">
                    {actions}
                </div>
            )}
        </div>
    );
}
