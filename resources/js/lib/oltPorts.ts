export const PON_PORT_OPTIONS = [2, 3].flatMap((slot) =>
    Array.from({ length: 16 }, (_, index) => {
        const port = index + 1;
        const label = `1/${slot}/${port}`;

        return {
            label,
            value: `gpon-olt_${label}`,
        };
    }),
);
