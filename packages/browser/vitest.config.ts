import { defineConfig } from 'vitest/config'
import { resolve } from 'pathe'

export default defineConfig({
    test: {
        name: 'browser',
        globals: true,
        setupFiles: ['./test/setup.ts'],
        include: ['test/**/*.test.ts'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/fixtures/**',
            '**/build/**'
        ],
        browser: {
            enabled: true,
            instances: [
                {
                    browser: 'chromium',    
                    provider: 'playwright', 
                    headless: true
                }
            ]
        }
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