#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { glob } from 'tinyglobby'

const args = parseArgs(process.argv.slice(2))
const range = getRequiredArg(args, 'range')
const branch = getRequiredArg(args, 'branch')

const releaseCommits = getReleaseCommits(range)

if (releaseCommits.length === 0) {
  console.log(`No release commit found in ${range}`)
  writeOutput('release', 'false')
  process.exit(0)
}

if (releaseCommits.length > 1) {
  throw new Error(`Found multiple release commits in ${range}: ${releaseCommits.map(commit => commit.subject).join(', ')}`)
}

const [{ sha, version }] = releaseCommits
const tag = `v${version}`
const head = process.env.GITHUB_SHA || git(['rev-parse', 'HEAD'])

validateReleaseBranch(branch)
validateVersionForBranch(branch, version)
validatePackageVersions(await getPackageFiles(), version)
validateTag(tag, head)

console.log(`Detected release ${tag} from commit ${sha}`)

writeOutput('release', 'true')
writeOutput('version', version)
writeOutput('tag', tag)
writeOutput('release_commit', sha)
writeOutput('publish_commit', head)

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

function getReleaseCommits(range: string): { sha: string; subject: string; version: string }[] {
  const lines = git(['log', '--format=%H%x00%s', range]).split('\n').filter(Boolean)

  return lines.flatMap((line) => {
    const [sha, subject] = line.split('\0')
    const match = /^chore: release v(\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?)$/.exec(subject)
    return match ? [{ sha, subject, version: match[1] }] : []
  })
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

function validateReleaseBranch(branch: string): void {
  if (branch === 'main' || /^v\d+(?:\.\d+)?$/.test(branch)) {
    return
  }

  throw new Error(`Release publish can only run from main, vN, or vN.M. Received "${branch}"`)
}

function validateVersionForBranch(branch: string, version: string): void {
  const match = /^v(\d+)(?:\.(\d+))?$/.exec(branch)
  if (!match) {
    return
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

function validateTag(tag: string, head: string): void {
  let tagSha: string | undefined

  try {
    tagSha = git(['rev-list', '-n', '1', tag])
  }
  catch {
    return
  }

  if (tagSha !== head) {
    throw new Error(`Tag ${tag} already exists at ${tagSha}, expected ${head}`)
  }
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf-8' }).trim()
}

function writeOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT
  if (outputPath) {
    appendFileSync(outputPath, `${name}=${value}\n`)
  }
}
