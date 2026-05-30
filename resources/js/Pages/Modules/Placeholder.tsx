import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    ArrowRight,
    CheckCircle2,
    CircleDashed,
    Construction,
    ExternalLink,
} from 'lucide-react';

interface Action {
    label: string;
    route: string;
}

interface ModuleFeature {
    label: string;
    status: 'ready' | 'next';
}

interface Props {
    title: string;
    description: string;
    features: ModuleFeature[];
    actions: Action[];
}

export default function Placeholder({ title, description, features, actions }: Props) {
    return (
        <AuthenticatedLayout header={title}>
            <Head title={title} />

            <div className="space-y-6 py-6">
                <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                        <Badge variant="outline" className="w-fit gap-1.5">
                            <Construction className="h-3.5 w-3.5" />
                            Module cockpit
                        </Badge>
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {actions.map((action) => (
                            <Button key={action.label} asChild variant="outline">
                                <Link href={route(action.route)}>
                                    {action.label}
                                    <ExternalLink className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        ))}
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Checklist Fitur</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2">
                            {features.map((feature) => (
                                <div
                                    key={feature.label}
                                    className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
                                >
                                    <div className="flex items-center gap-3">
                                        {feature.status === 'ready' ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        ) : (
                                            <CircleDashed className="h-4 w-4 text-amber-500" />
                                        )}
                                        <span className="text-sm font-medium">{feature.label}</span>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={
                                            feature.status === 'ready'
                                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                                                : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                                        }
                                    >
                                        {feature.status === 'ready' ? 'Siap' : 'Next'}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                    Menu ini sudah dipasang agar struktur aplikasi terasa seperti billing radius lengkap.
                    Item berstatus Next akan disambungkan ke backend penuh setelah modul prioritasnya dibuat.
                    <ArrowRight className="ml-2 inline h-4 w-4 align-text-bottom" />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
