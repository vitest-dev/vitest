#!/usr/bin/env zx

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { glob } from 'tinyglobby'
import { $ } from 'zx'

if (process.env.VITE_TEST_WATCHER_DEBUG !== 'false') {
  throw new Error(`Cannot release Vitest without VITE_TEST_WATCHER_DEBUG=${process.env.VITE_TEST_WATCHER_DEBUG} environment variable. `)
}

const args = parseArgs(process.argv.slice(2))
let version = args.version || args._[0]
const dryRun = args['dry-run'] === 'true'

if (!version) {
  throw new Error('No version specified')
}

if (version.startsWith('v')) {
  version = version.slice(1)
}

if (!isValidVersion(version)) {
  throw new Error(`Invalid release version "${version}"`)
}

const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url))
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

if (pkg.version !== version) {
  throw new Error(
    `Package version from tag "${version}" mismatches with the current version "${pkg.version}"`,
  )
}

const packages = await getPublishPackages(version)
const releaseTag = version.includes('beta')
  ? 'beta'
  : version.includes('alpha')
    ? 'alpha'
    : undefined

console.log(dryRun ? 'Dry-running version' : 'Publishing version', version, 'with tag', releaseTag || 'latest')

for (const pkg of packages) {
  if (!dryRun && packageExists(pkg.name, version)) {
    console.log(`Skipping ${pkg.name}@${version}; it already exists on npm`)
    continue
  }

  const publishArgs = ['--dir', pkg.dir, 'publish', '--access', 'public', '--no-git-checks']

  if (releaseTag) {
    publishArgs.push('--tag', releaseTag)
  }

  if (dryRun) {
    publishArgs.push('--dry-run')
  }

  await $`pnpm ${publishArgs}`
}

interface ParsedArgs {
  '_': string[]
  'version'?: string
  'dry-run'?: string
  [key: string]: string | string[] | undefined
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { _: [] }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (!arg.startsWith('--')) {
      parsed._.push(arg)
      continue
    }

    const key = arg.slice(2)
    const value = argv[i + 1]

    if (!value || value.startsWith('--')) {
      parsed[key] = 'true'
      continue
    }

    parsed[key] = value
    i++
  }

  return parsed
}

async function getPublishPackages(version: string): Promise<{ dir: string; name: string }[]> {
  const files = await glob(['package.json', './packages/*/package.json'], {
    expandDirectories: false,
  })

  const packages: { dir: string; name: string }[] = []

  for (const file of files) {
    const pkg = JSON.parse(readFileSync(file, 'utf-8'))

    if (pkg.version !== version) {
      throw new Error(`${file} has version ${pkg.version}, expected ${version}`)
    }

    if (pkg.private) {
      continue
    }

    packages.push({
      dir: file === 'package.json' ? '.' : file.replace(/\/package\.json$/, ''),
      name: pkg.name,
    })
  }

  return packages
}

function packageExists(name: string, version: string): boolean {
  try {
    execFileSync('npm', ['view', `${name}@${version}`, 'version', '--json'], { stdio: 'pipe' })
    return true
  }
  catch {
    return false
  }
}

function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Z-.]+)?(?:\+[0-9A-Z-.]+)?$/i.test(version)
}
