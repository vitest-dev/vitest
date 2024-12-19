import type { BrowserCommand } from 'vitest/node'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as util from 'node:util'
import { defineConfig } from 'vitest/config'

const dir = dirname(fileURLToPath(import.meta.url))

function noop() {}

const provider = process.env.PROVIDER || 'playwright'
const browser = process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome')

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
    include: ['@vitest/cjs-lib', 'react/jsx-dev-runtime'],
  },
  test: {
    include: ['test/**.test.{ts,js,tsx}'],
    includeSource: ['src/*.ts'],
    // having a snapshot environment doesn't affect browser tests
    snapshotEnvironment: './custom-snapshot-env.ts',
    browser: {
      enabled: true,
      name: browser,
      headless: false,
      provider,
      // isolate: false,
      testerScripts: [
        {
          content: 'globalThis.__injected = []',
          type: 'text/javascript',
        },
        {
          content: '__injected.push(1)',
        },
        {
          id: 'ts.ts',
          content: '(__injected as string[]).push(2)',
        },
        {
          src: './injected.ts',
        },
        {
          src: '@vitest/injected-lib',
        },
      ],
      orchestratorScripts: [
        {
          content: 'console.log("Hello, World");globalThis.__injected = []',
          type: 'text/javascript',
        },
        {
          content: 'import "./injected.ts"',
        },
        {
          content: 'if(__injected[0] !== 3) throw new Error("injected not working")',
        },
      ],
      commands: {
        myCustomCommand,
        stripVTControlCharacters,
      },
    },
    alias: {
      '#src': resolve(dir, './src'),
    },
    open: false,
    diff: './custom-diff-config.ts',
    outputFile: './browser.json',
    reporters: ['json', {
      onInit: noop,
      onPathsCollected: noop,
      onCollected: noop,
      onFinished: noop,
      onTaskUpdate: noop,
      onTestRemoved: noop,
      onWatcherStart: noop,
      onWatcherRerun: noop,
      onServerRestart: noop,
      onUserConsoleLog: noop,
    }, 'default'],
    env: {
      BROWSER: browser,
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
  ],
})
