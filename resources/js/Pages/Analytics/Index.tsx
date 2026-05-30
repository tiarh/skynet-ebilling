import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';

interface MetricCardProps {
    title: string;
    value: string;
    trend?: string;
    trendDirection?: 'up' | 'down';
    icon?: React.ReactNode;
}

function MetricCard({ title, value, trend, trendDirection, icon }: MetricCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {trend && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        {trendDirection === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
                        {trendDirection === 'down' && <TrendingDown className="h-3 w-3 text-red-600" />}
                        {trend}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function Index() {
    const [revenueTrendData, setRevenueTrendData] = useState([]);
    const [mrrData, setMrrData] = useState<any>(null);
    const [collectionData, setCollectionData] = useState<any>(null);
    const [areaData, setAreaData] = useState([]);
    const [packageData, setPackageData] = useState([]);
    const [paymentMethodData, setPaymentMethodData] = useState([]);
    const [outstandingAgingData, setOutstandingAgingData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const [
                    revenueTrend,
                    mrr,
                    collectionRate,
                    revenueByArea,
                    packagePerformance,
                    paymentMethods,
                    outstandingAging,
                ] = await Promise.all([
                    fetch('/api/analytics/revenue-trend').then(r => r.json()),
                    fetch('/api/analytics/mrr').then(r => r.json()),
                    fetch('/api/analytics/collection-rate').then(r => r.json()),
                    fetch('/api/analytics/revenue-by-area').then(r => r.json()),
                    fetch('/api/analytics/package-performance').then(r => r.json()),
                    fetch('/api/analytics/payment-methods').then(r => r.json()),
                    fetch('/api/analytics/outstanding-aging').then(r => r.json()),
                ]);

                setRevenueTrendData(revenueTrend);
                setMrrData(mrr);
                setCollectionData(collectionRate);
                setAreaData(revenueByArea);
                setPackageData(packagePerformance);
                setPaymentMethodData(paymentMethods);
                setOutstandingAgingData(outstandingAging);
            } catch (error) {
                console.error('Failed to fetch analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    if (loading) {
        return (
            <AuthenticatedLayout>
                <Head title="Analytics & Reports" />
                <div className="py-12">
                    <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                        <div className="text-center">Loading analytics data...</div>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout>
            <Head title="Analytics & Reports" />

            <div className="py-6 space-y-6">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold">Analytics & Reports</h1>
                        <p className="text-muted-foreground">Revenue insights and business performance metrics</p>
                    </div>

                    {/* Summary Metrics */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                        <MetricCard
                            title="Current MRR"
                            value={formatCurrency(mrrData?.current_mrr || 0)}
                            trend={`${mrrData?.growth_percentage >= 0 ? '+' : ''}${mrrData?.growth_percentage}% from last month`}
                            trendDirection={mrrData?.growth_percentage >= 0 ? 'up' : 'down'}
                            icon={<DollarSign />}
                        />
                        <MetricCard
                            title="Collection Rate"
                            value={`${collectionData?.collection_rate || 0}%`}
                            trend="This month"
                            icon={<TrendingUp />}
                        />
                        <MetricCard
                            title="Outstanding Amount"
                            value={formatCurrency(collectionData?.by_status?.unpaid?.total_amount || 0)}
                            trend={`${collectionData?.by_status?.unpaid?.count || 0} unpaid invoices`}
                            icon={<AlertCircle />}
                        />
                        <MetricCard
                            title="Avg Days to Payment"
                            value={`${collectionData?.avg_days_to_payment || 0} days`}
                            trend="Payment efficiency"
                            icon={<Users />}
                        />
                    </div>

                    <Tabs defaultValue="revenue" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="revenue">Revenue</TabsTrigger>
                            <TabsTrigger value="areas">Areas</TabsTrigger>
                            <TabsTrigger value="packages">Packages</TabsTrigger>
                            <TabsTrigger value="payments">Payments</TabsTrigger>
                        </TabsList>

                        <TabsContent value="revenue" className="space-y-4">
                            {/* Monthly Revenue Trend */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Monthly Revenue Trend (12 Months)</CardTitle>
                                    <CardDescription>Track invoiced vs collected revenue over time</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={350}>
                                        <LineChart data={revenueTrendData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                                            <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)', borderRadius: 'var(--radius)' }}
                                                itemStyle={{ color: 'var(--color-foreground)' }}
                                                formatter={(value: any) => formatCurrency(Number(value || 0))}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Line type="monotone" dataKey="total_invoiced" stroke="var(--color-chart-1)" name="Invoiced" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                            <Line type="monotone" dataKey="total_collected" stroke="var(--color-chart-2)" name="Collected" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                            <Line type="monotone" dataKey="outstanding" stroke="var(--color-chart-3)" name="Outstanding" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* Outstanding Revenue Aging */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Outstanding Revenue Aging</CardTitle>
                                    <CardDescription>Unpaid invoices by overdue period</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={outstandingAgingData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                                            <XAxis dataKey="age_bucket" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                cursor={{ fill: 'var(--color-muted)', opacity: 0.1 }}
                                                contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)', borderRadius: 'var(--radius)' }}
                                                formatter={(value: any) => formatCurrency(Number(value || 0))}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="total_amount" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} name="Amount" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="areas" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Revenue by Area (Top 10)</CardTitle>
                                    <CardDescription>Geographic performance and collection rates</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={areaData} layout="vertical" margin={{ left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                                            <XAxis type="number" tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis dataKey="area_name" type="category" width={150} stroke="var(--color-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                cursor={{ fill: 'var(--color-muted)', opacity: 0.1 }}
                                                contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)', borderRadius: 'var(--radius)' }}
                                                formatter={(value: any) => formatCurrency(Number(value || 0))}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="total_collected" fill="var(--color-chart-2)" stackId="a" radius={[0, 4, 4, 0]} name="Collected" />
                                            <Bar dataKey="total_billed" fill="var(--color-chart-1)" stackId="a" radius={[0, 4, 4, 0]} name="Billed (Total)" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="packages" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Package Performance</CardTitle>
                                    <CardDescription>Revenue and customer count by package</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={packageData} layout="vertical" margin={{ left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                                            <XAxis type="number" tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis dataKey="package_name" type="category" width={200} stroke="var(--color-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                cursor={{ fill: 'var(--color-muted)', opacity: 0.1 }}
                                                contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)', borderRadius: 'var(--radius)' }}
                                                formatter={(value: any) => formatCurrency(Number(value || 0))}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="total_revenue" fill="var(--color-chart-4)" radius={[0, 4, 4, 0]} name="Revenue (3mo)" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="payments" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Payment Method Distribution</CardTitle>
                                    <CardDescription>How customers prefer to pay</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={paymentMethodData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="transaction_count"
                                            >
                                                {paymentMethodData.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={`var(--color-chart-${(index % 5) + 1})`} stroke="var(--color-card)" strokeWidth={2} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)', borderRadius: 'var(--radius)' }}
                                                formatter={(value: any) => `${value} transactions`}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
