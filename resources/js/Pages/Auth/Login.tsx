import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { Globe, Command, Wifi, Server, Activity } from 'lucide-react';

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'));
    };

    return (
        <>
            <Head title="Login" />

            <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
                {/* Left Panel - Visuals */}
                <div className="hidden bg-muted lg:flex flex-col justify-between p-12 relative overflow-hidden">
                    <div className="absolute inset-0 bg-muted">
                        {/* Abstract Network Grid Background */}
                        <div className="absolute inset-0 opacity-20"
                            style={{
                                backgroundImage: `radial-gradient(circle at 2px 2px, var(--color-foreground) 1px, transparent 0)`,
                                backgroundSize: '40px 40px'
                            }}>
                        </div>

                        {/* Glowing Orbs */}
                        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
                    </div>

                    <div className="relative z-10 flex items-center gap-2 text-lg font-bold text-foreground">
                        <Command className="h-6 w-6" />
                        <span>Skynet E-Billing</span>
                    </div>

                    <div className="relative z-10">
                        <blockquote className="space-y-2">
                            <p className="text-lg text-muted-foreground">
                                "The complete solution for ISP management. Billing, bandwidth control, and customer management in one unified platform."
                            </p>
                            <footer className="text-sm text-muted-foreground/80">
                                &mdash; System Administrator
                            </footer>
                        </blockquote>
                    </div>

                    <div className="relative z-10 flex gap-4 text-muted-foreground text-sm">
                        <div className="flex items-center gap-1">
                            <Wifi className="h-4 w-4" />
                            <span>PPPoE Ready</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Server className="h-4 w-4" />
                            <span>Radius</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Activity className="h-4 w-4" />
                            <span>Real-time</span>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Form */}
                <div className="flex items-center justify-center p-8 bg-background">
                    <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                        <div className="flex flex-col space-y-2 text-center">
                            <div className="mx-auto h-10 w-10 bg-primary rounded-lg flex items-center justify-center lg:hidden">
                                <Command className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Welcome back
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Enter your credentials to access the admin portal
                            </p>
                        </div>

                        {status && (
                            <Alert>
                                <AlertDescription>{status}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid gap-6">
                            <form onSubmit={submit}>
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            placeholder="name@example.com"
                                            type="email"
                                            autoCapitalize="none"
                                            autoComplete="email"
                                            autoCorrect="off"
                                            disabled={processing}
                                            value={data.email}
                                            onChange={(e) => setData('email', e.target.value)}
                                            required
                                            autoFocus
                                        />
                                        {errors.email && (
                                            <p className="text-sm text-destructive">{errors.email}</p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="password">Password</Label>
                                            {canResetPassword && (
                                                <Link
                                                    href={route('password.request')}
                                                    className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                                                >
                                                    Forgot password?
                                                </Link>
                                            )}
                                        </div>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            disabled={processing}
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            required
                                        />
                                        {errors.password && (
                                            <p className="text-sm text-destructive">{errors.password}</p>
                                        )}
                                    </div>

                                    <Button disabled={processing}>
                                        {processing ? (
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                                        ) : null}
                                        Sign In
                                    </Button>
                                </div>
                            </form>

                        </div>

                        <p className="px-8 text-center text-sm text-muted-foreground">
                            By clicking sign in, you agree to our{' '}
                            <a href="#" className="underline underline-offset-4 hover:text-primary">
                                Terms of Service
                            </a>{' '}
                            and{' '}
                            <a href="#" className="underline underline-offset-4 hover:text-primary">
                                Privacy Policy
                            </a>
                            .
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
