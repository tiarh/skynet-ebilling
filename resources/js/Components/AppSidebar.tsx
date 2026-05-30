import { Link, usePage } from '@inertiajs/react';
import ApplicationLogo from '@/Components/ApplicationLogo';
import {
    BarChart3,
    Boxes,
    CreditCard,
    FileText,
    Globe2,
    Handshake,
    Headset,
    LayoutDashboard,
    LogOut,
    LucideIcon,
    MapPin,
    MessageCircle,
    MoreVertical,
    Package,
    Router,
    Send,
    Server,
    Settings,
    ShieldCheck,
    Smartphone,
    TicketCheck,
    Users,
    Wifi,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { PageProps } from '@/types';

export interface NavItem {
    name: string;
    route: string;
    icon: LucideIcon;
    section: 'operasi' | 'radius' | 'billing' | 'network' | 'growth' | 'system';
    globalOnly?: boolean;
    superOnly?: boolean;
}

export const navItems: NavItem[] = [
    { name: 'Dashboard', route: 'dashboard', icon: LayoutDashboard, section: 'operasi' },
    { name: 'Pelanggan', route: 'customers.index', icon: Users, section: 'operasi' },
    { name: 'PPPoE Radius', route: 'routers.index', icon: Router, section: 'radius', globalOnly: true },
    { name: 'Hotspot Voucher', route: 'modules.hotspot', icon: Wifi, section: 'radius', globalOnly: true },
    { name: 'Paket Internet', route: 'packages.index', icon: Package, section: 'radius', globalOnly: true },
    { name: 'Invoice', route: 'invoices.index', icon: FileText, section: 'billing' },
    { name: 'Payment Gateway', route: 'modules.payment-gateway', icon: CreditCard, section: 'billing', globalOnly: true },
    { name: 'Laporan Keuangan', route: 'analytics.index', icon: BarChart3, section: 'billing' },
    { name: 'WhatsApp Gateway', route: 'settings.index', icon: MessageCircle, section: 'network', globalOnly: true },
    { name: 'Broadcast WA', route: 'broadcasts.index', icon: Send, section: 'network' },
    { name: 'Ticketing', route: 'modules.ticketing', icon: TicketCheck, section: 'network' },
    { name: 'Mapping POP/ODP', route: 'areas.index', icon: MapPin, section: 'network', globalOnly: true },
    { name: 'MikroTik / NAS', route: 'routers.index', icon: Server, section: 'network', globalOnly: true },
    { name: 'OLT Management', route: 'olts.index', icon: Boxes, section: 'network', globalOnly: true },
    { name: 'Portal Pelanggan', route: 'modules.portal', icon: Smartphone, section: 'growth' },
    { name: 'Kemitraan', route: 'modules.reseller', icon: Handshake, section: 'growth', globalOnly: true },
    { name: 'GenieACS TR069', route: 'modules.genieacs', icon: Globe2, section: 'growth', globalOnly: true },
    { name: 'Support Center', route: 'modules.support', icon: Headset, section: 'growth' },
    { name: 'Settings', route: 'settings.index', icon: Settings, section: 'system', globalOnly: true },
    { name: 'Users', route: 'users.index', icon: ShieldCheck, section: 'system', superOnly: true },
];

const sectionLabels: Record<NavItem['section'], string> = {
    operasi: 'Operasi',
    radius: 'Radius',
    billing: 'Billing',
    network: 'Network',
    growth: 'Layanan',
    system: 'System',
};

export function AppSidebar() {
    const user = usePage<PageProps>().props.auth.user;
    const isSuperAdmin = user.role === 'superadmin';
    const isGlobalAdmin = user.scope === 'global_admin' || isSuperAdmin;
    const roleLabel = user.scope === 'superadmin' ? 'Superadmin' : user.scope === 'global_admin' ? 'Global Admin' : 'Scoped Admin';
    const visibleNavItems = navItems.filter((item) => {
        if (item.superOnly) {
            return isSuperAdmin;
        }

        if (item.globalOnly) {
            return isGlobalAdmin;
        }

        return true;
    });
    const groupedItems = Object.entries(sectionLabels)
        .map(([section, label]) => ({
            section,
            label,
            items: visibleNavItems.filter((item) => item.section === section),
        }))
        .filter((group) => group.items.length > 0);

    return (
        <aside className="hidden w-64 flex-col border-r border-border bg-card text-card-foreground md:flex shadow-sm z-30">
            <div className="flex h-16 items-center border-b border-border px-6 bg-card">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <ApplicationLogo className="h-6 w-6 fill-current text-primary" />
                    <span className="text-lg tracking-tight">Skynet Admin</span>
                </Link>
            </div>
            <div className="flex-1 overflow-auto py-4 bg-card">
                <nav className="grid items-start px-4 text-sm font-medium space-y-1">
                    {groupedItems.map((group) => (
                        <div key={group.section} className="space-y-1">
                            <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {group.label}
                            </p>
                            {group.items.map((item) => {
                                const baseRoute = item.route.split('.')[0];
                                const isActive = route().current(`${baseRoute}.*`) || route().current(item.route);

                                return (
                                    <Link
                                        key={`${group.section}-${item.name}`}
                                        href={route(item.route)}
                                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all outline-none relative group ${isActive
                                            ? 'text-primary font-semibold'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                            }`}
                                    >
                                        {isActive && (
                                            <div className="absolute inset-0 bg-primary/10 rounded-lg border-l-2 border-primary" />
                                        )}

                                        <item.icon className={`h-4 w-4 relative z-10 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                                        <span className="relative z-10">{item.name}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>
            </div>
            {/* User Footer Section */}
            <div className="border-t border-border p-4 bg-card">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex w-full items-center gap-3 rounded-lg border border-border p-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left outline-none">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                U
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="truncate text-sm font-medium">{user.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
                            </div>
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-56 mb-2">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href={route('logout')} method="post" as="button" className="w-full cursor-pointer flex items-center gap-2 text-destructive focus:text-destructive">
                                <LogOut className="h-4 w-4" />
                                <span>Log Out</span>
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
}
