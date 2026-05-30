interface MoneyTextProps {
    amount: number;
    className?: string;
}

export function formatIdr(amount: number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
}

export function MoneyText({ amount, className }: MoneyTextProps) {
    return <span className={className}>{formatIdr(amount)}</span>;
}
