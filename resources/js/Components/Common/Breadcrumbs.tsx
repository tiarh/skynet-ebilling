import { Link } from '@inertiajs/react';
import { ChevronRight, Home } from 'lucide-react';
import { usePage } from '@inertiajs/react';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface Props {
    items?: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: Props) {
    const { url } = usePage();

    // If custom items are provided, use them
    if (items && items.length > 0) {
        return (
            <nav className="flex items-center text-sm text-muted-foreground">
                <Link
                    href="/dashboard"
                    className="flex items-center hover:text-foreground transition-colors"
                    title="Dashboard"
                >
                    <Home className="h-4 w-4" />
                </Link>

                {items.map((item, index) => (
                    <div key={index} className="flex items-center">
                        <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/50" />
                        {item.href ? (
                            <Link
                                href={item.href}
                                className="hover:text-foreground transition-colors capitalize"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span className="font-semibold text-foreground capitalize">
                                {item.label}
                            </span>
                        )}
                    </div>
                ))}
            </nav>
        );
    }

    // Default URL-based generation
    const pathSegments = url.split('?')[0].split('/').filter(Boolean);

    // Don't show on dashboard/home if empty or just dashboard
    if (pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === 'dashboard')) {
        return (
            <div className="flex items-center text-sm text-muted-foreground">
                <Home className="h-4 w-4 mr-2" />
                <span className="font-medium">Dashboard</span>
            </div>
        );
    }

    return (
        <nav className="flex items-center text-sm text-muted-foreground">
            <Link
                href="/dashboard"
                className="flex items-center hover:text-foreground transition-colors"
                title="Dashboard"
            >
                <Home className="h-4 w-4" />
            </Link>

            {pathSegments.map((segment, index) => {
                // Reconstruct path for this segment
                const path = `/${pathSegments.slice(0, index + 1).join('/')}`;
                const isLast = index === pathSegments.length - 1;

                // Format label: "customer-invoices" -> "Customer Invoices"
                const label = segment
                    .replace(/[-_]/g, ' ')
                    .replace(/^\w/, (c) => c.toUpperCase());

                // If segment is numeric, it's likely an ID. 
                // In URL-mode, we can't know the name, so we just show the number or "Details"
                // Ideally, pages with IDs should stick to passing custom items.
                const displayLabel = /^\d+$/.test(label) ? `#${label}` : label;

                return (
                    <div key={path} className="flex items-center">
                        <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/50" />
                        {isLast ? (
                            <span className="font-semibold text-foreground capitalize">
                                {displayLabel}
                            </span>
                        ) : (
                            <Link
                                href={path}
                                className="hover:text-foreground transition-colors capitalize"
                            >
                                {displayLabel}
                            </Link>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
