import { Link } from '@inertiajs/react';
import ApplicationLogo from '@/Components/ApplicationLogo';
import { PropsWithChildren } from 'react';
import { Shield } from 'lucide-react';

export default function PublicLayout({ children }: PropsWithChildren) {
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <Link href="/" className="flex items-center space-x-3 group">
                            <ApplicationLogo className="block h-9 w-auto fill-current text-foreground group-hover:text-primary transition-colors" />
                            <div className="flex flex-col">
                                <span className="text-base font-bold text-foreground leading-none">
                                    Skynet Network
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Secure Payment Portal
                                </span>
                            </div>
                        </Link>

                        {/* Trust Badge */}
                        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            <span>Secure Payment</span>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="py-8 sm:py-12">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                    {children}
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-border bg-card/30 mt-auto">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
                        <p>© {new Date().getFullYear()} PT. Skynet Lintas Nusantara. All rights reserved.</p>
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                SSL Secured
                            </span>
                            <span>•</span>
                            <span>Privacy Protected</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
