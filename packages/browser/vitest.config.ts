import { defineConfig } from 'vitest/config'
import { resolve } from 'pathe'

export default defineConfig({
    test: {
        name: 'browser',
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./test/setup.ts'],
        include: ['test/**/*.test.ts'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/fixtures/**',
            '**/build/**'
        ],
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '~': resolve(__dirname, './'),
        },
    },
    esbuild: {
        target: 'node18',
    },
})