import type { BrowserCommand } from 'vitest/node'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as util from 'node:util'
import { defineConfig } from 'vitest/config'
import { instances, provider } from './settings'

const dir = dirname(fileURLToPath(import.meta.url))

const myCustomCommand: BrowserCommand<[arg1: string, arg2: string]> = ({ testPath }, arg1, arg2) => {
  return { testPath, arg1, arg2 }
}

const stripVTControlCharacters: BrowserCommand<[text: string]> = (_, text) => {
  return util.stripVTControlCharacters(text)
}

export default defineConfig({
  server: {
    headers: {
      'x-custom': 'hello',
      // Vitest iframe should still be loaded
      'X-Frame-Options': 'DENY',
      'content-security-policy': 'frame-src https://example.com; frame-ancestors https://example.com',
    },
  },
  optimizeDeps: {
    include: ['@vitest/cjs-lib', '@vitest/bundled-lib', 'react/jsx-dev-runtime'],
  },
  define: {
    'import.meta.env.DEFINE_CUSTOM_ENV': JSON.stringify('define-custom-env'),
  },
  test: {
    include: ['test/**.test.{ts,js,tsx}'],
    includeSource: ['src/*.ts'],
    // having a snapshot environment doesn't affect browser tests
    snapshotEnvironment: './custom-snapshot-env.ts',
    env: {
      CUSTOM_ENV: 'foo',
    },
    browser: {
      enabled: true,
      headless: false,
      instances,
      provider,
      // isolate: false,
      testerHtmlPath: './custom-tester.html',
      orchestratorScripts: [
        {
          content: 'console.log("Hello, World");globalThis.__injected = []',
          type: 'text/javascript',
        },
        {
          content: 'import "./injected.ts"',
        },
        {
          content: 'if(__injected[0] !== 2) throw new Error("injected not working")',
        },
      ],
      commands: {
        myCustomCommand,
        stripVTControlCharacters,
        async startTrace(ctx) {
          await ctx.page.context().tracing.start({ screenshots: true, snapshots: true })
        },
        async stopTrace(ctx) {
          await ctx.page.context().tracing.stop({ path: 'trace.zip' })
        },
      },
    },
    tags: [
      { name: 'e2e', priority: 10 },
      { name: 'test', priority: 5 },
      { name: 'browser', priority: 1 },
    ],
    alias: {
      '#src': resolve(dir, './src'),
    },
    open: false,
    diff: './custom-diff-config.ts',
    outputFile: {
      html: './html/index.html',
      json: './browser.json',
    },
    onConsoleLog(log) {
      if (log.includes('MESSAGE ADDED')) {
        return false
      }
    },
  },
  plugins: [
    {
      name: 'test-no-transform-ui',
      transform(_code, id, _options) {
        if (id.includes('/__vitest__/')) {
          throw new Error(`Unexpected transform: ${id}`)
        }
      },
    },
    {
      name: 'test-early-transform',
      async configureServer(server) {
        await server.ssrLoadModule('/package.json')
      },
    },
  ],
})
