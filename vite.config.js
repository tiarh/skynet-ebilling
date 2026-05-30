import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const devServerHost = env.VITE_DEV_SERVER_HOST || 'localhost';
    const devServerPort = Number(env.VITE_PORT || 5173);

    return {
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './resources/js'),
            },
        },
        server: {
            host: '0.0.0.0',
            port: devServerPort,
            strictPort: true,
            cors: true,
            origin: `http://${devServerHost}:${devServerPort}`,
            hmr: {
                host: devServerHost,
                port: devServerPort,
            },
        },
        plugins: [
            laravel({
                input: 'resources/js/app.tsx',
                refresh: true,
            }),
            react(),
            tailwindcss(),
        ],
    };
});
