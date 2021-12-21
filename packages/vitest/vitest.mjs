#!/usr/bin/env node

import { fileURLToPath } from 'url'
import { ensurePackageInstalled, resolvePath } from './dist/utils.js'

const argv = process.argv.slice(2)

if (!await ensurePackageInstalled('vite'))
  process.exit(1)

if (argv.includes('--coverage')) {
  if (!await ensurePackageInstalled('c8'))
    process.exit(1)
  const filename = fileURLToPath(import.meta.url)
  const entry = resolvePath(filename, '../dist/cli.js')
  process.argv.splice(2, 0, process.argv[0], entry)
  await import('c8/bin/c8.js')
}
else {
  await import('./dist/cli.js')
}
