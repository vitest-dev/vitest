#!/usr/bin/env node
'use strict'

import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'
import { run } from 'vite-node'
import minimist from 'minimist'

const argv = minimist(process.argv.slice(2), {
  alias: {
    c: 'config',
  },
  string: ['root', 'config'],
  boolean: ['dev'],
})

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(argv.root || process.cwd())

await run({
  root,
  files: [
    resolve(__dirname, argv.dev ? '../src/cli.ts' : '../dist/cli.js'),
  ],
  config: resolve(root, argv.config || 'vitest.config.ts'),
  defaultConfig: {
    optimizeDeps: {
      exclude: [
        'vitest',
      ],
    },
  },
  shouldExternalize(id) {
    if (id.includes('/node_modules/vitest/'))
      return false
    else
      return id.includes('/node_modules/')
  },
})
