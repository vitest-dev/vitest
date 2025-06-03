#!/usr/bin/env zx

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { $ } from 'zx'

if (process.env.VITEST_GENERATE_UI_TOKEN !== 'true' || process.env.VITE_TEST_WATCHER_DEBUG !== 'false') {
  throw new Error(`Cannot release Vitest without VITEST_GENERATE_UI_TOKEN=${process.env.VITEST_GENERATE_UI_TOKEN} and VITE_TEST_WATCHER_DEBUG=${process.env.VITE_TEST_WATCHER_DEBUG} environment variable. `)
}

let version = process.argv[2]

if (!version) {
  throw new Error('No tag specified')
}

if (version.startsWith('v')) {
  version = version.slice(1)
}

const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url))
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

if (pkg.version !== version) {
  throw new Error(
    `Package version from tag "${version}" mismatches with the current version "${pkg.version}"`,
  )
}

const releaseTag = version.includes('beta')
  ? 'beta'
  : version.includes('alpha')
    ? 'alpha'
    : undefined

console.log('Publishing version', version, 'with tag', releaseTag || 'latest')

if (releaseTag) {
  await $`pnpm -r publish --access public --no-git-checks --tag ${releaseTag}`
}
else {
  await $`pnpm -r publish --access public --no-git-checks`
}
