#!/usr/bin/env node
'use strict'

import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'
import { startAndRun } from 'vite-node'
import minimist from 'minimist'

const argv = minimist(process.argv.slice(2), {
  string: ['root'],
})

const __dirname = dirname(fileURLToPath(import.meta.url))

await startAndRun({
  root: resolve(argv.root || process.cwd()),
  files: [
    resolve(__dirname, '../dist/cli.js'),
  ],
})
