import { Button } from '@/Components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

interface ActionProps {
    onClick: () => void;
    title?: string;
    className?: string;
}

export function EditAction({ onClick, title = "Edit", className = "" }: ActionProps) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-blue-600 hover:text-white hover:bg-blue-600 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white transition-colors duration-200 ${className}`}
            title={title}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
        >
            <Pencil className="h-4 w-4" />
        </Button>
    );
}

export function DeleteAction({ onClick, title = "Delete", className = "" }: ActionProps) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-red-600 hover:text-white hover:bg-red-600 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white transition-colors duration-200 ${className}`}
            title={title}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    );
}
