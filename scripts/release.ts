#!/usr/bin/env tsx

import { appendFileSync, readFileSync } from 'node:fs'
import { versionBump } from 'bumpp'
import { glob } from 'tinyglobby'

const releaseTypes = new Set([
  'next',
  'patch',
  'minor',
  'major',
  'prepatch',
  'preminor',
  'premajor',
])

const args = parseArgs(process.argv.slice(2))
const targetBranch = getRequiredArg(args, 'target-branch')
const release = args.release || 'next'
const version = args.version

if (version && !isValidVersion(version)) {
  throw new Error(`Invalid release version "${version}"`)
}

if (!version && !releaseTypes.has(release)) {
  throw new Error(`Invalid release type "${release}". Expected one of: ${[...releaseTypes].join(', ')}`)
}

const packages = await getPackageFiles()
const selectedRelease = version || release

console.log(`Preparing ${selectedRelease} release from ${targetBranch}`)
console.log('Bumping versions in packages:', packages.join(', '), '\n')

const result = await versionBump({
  files: packages,
  release: selectedRelease,
  commit: false,
  tag: false,
  push: false,
  confirm: false,
  interface: false,
})

validateVersionForBranch(targetBranch, result.newVersion)
validatePackageVersions(packages, result.newVersion)

const tag = `v${result.newVersion}`
const prepareBranch = `prepare-${tag}`
const compareUrl = `https://github.com/vitest-dev/vitest/compare/${targetBranch}...${prepareBranch}?expand=1`

console.log(`Prepared ${tag}`)
console.log(`Prepare branch: ${prepareBranch}`)
console.log(`Compare URL: ${compareUrl}`)

writeOutput('version', result.newVersion)
writeOutput('tag', tag)
writeOutput('prepare_branch', prepareBranch)
writeOutput('compare_url', compareUrl)

function parseArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument "${arg}"`)
    }

    const key = arg.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }

    parsed[key] = value
    i++
  }

  return parsed
}

function getRequiredArg(args: Record<string, string>, name: string): string {
  const value = args[name]
  if (!value) {
    throw new Error(`Missing required argument --${name}`)
  }
  return value
}

async function getPackageFiles(): Promise<string[]> {
  return await glob(['package.json', './packages/*/package.json'], {
    expandDirectories: false,
  })
}

function validatePackageVersions(files: string[], version: string): void {
  for (const file of files) {
    const pkg = JSON.parse(readFileSync(file, 'utf-8'))
    if (pkg.version !== version) {
      throw new Error(`${file} has version ${pkg.version}, expected ${version}`)
    }
  }
}

function validateVersionForBranch(branch: string, version: string): void {
  const match = /^v(\d+)(?:\.(\d+))?$/.exec(branch)
  if (!match) {
    if (branch === 'main') {
      return
    }
    throw new Error(`Release target must be main, vN, or vN.M. Received "${branch}"`)
  }

  const [, major, minor] = match
  const versionMatch = /^(\d+)\.(\d+)\.\d+(?:-[0-9A-Z-.]+)?$/i.exec(version)

  if (!versionMatch) {
    throw new Error(`Invalid release version "${version}"`)
  }

  if (versionMatch[1] !== major || (minor && versionMatch[2] !== minor)) {
    throw new Error(`Version ${version} does not match release branch ${branch}`)
  }
}

function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Z-.]+)?(?:\+[0-9A-Z-.]+)?$/i.test(version)
}

function writeOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT
  if (outputPath) {
    appendFileSync(outputPath, `${name}=${value}\n`)
  }
}
