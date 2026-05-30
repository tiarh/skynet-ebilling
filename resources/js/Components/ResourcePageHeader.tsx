import { ReactNode } from 'react';
import { Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/Components/ui/button';

interface ResourcePageHeaderProps {
    title: string;
    backHref?: string;
    actions?: ReactNode;
}

export function ResourcePageHeader({ title, backHref, actions }: ResourcePageHeaderProps) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
                {backHref && (
                    <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full">
                        <Link href={backHref}>
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                )}
                <h2 className="truncate text-xl font-semibold leading-tight text-foreground">
                    {title}
                </h2>
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
        </div>
    );
}
