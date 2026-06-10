import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as semver from 'semver'
import { $ } from 'zx'

// Example:
// VITE_TEST_WATCHER_DEBUG=false PUBLISH_DRY_RUN=true PUBLISH_BRANCH=main pnpm publish-ci 5.0.0-beta.4

const $$ = $({ stdio: 'inherit' })

async function main() {
  if (process.env.VITE_TEST_WATCHER_DEBUG !== 'false') {
    throw new Error(`Cannot release Vitest without VITE_TEST_WATCHER_DEBUG=${process.env.VITE_TEST_WATCHER_DEBUG} environment variable. `)
  }

  const version = process.argv[2]
  if (!version) {
    throw new Error('Missing argument to specify version')
  }

  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url))
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  if (pkg.version !== version) {
    throw new Error(
      `Input version "${version}" does not match package.json version "${pkg.version}"`,
    )
  }

  const publishBranch = process.env.PUBLISH_BRANCH
  if (!publishBranch) {
    throw new Error('Missing PUBLISH_BRANCH environment variable')
  }
  const releaseTag = await getReleaseTag(version, publishBranch)

  const dryRun = process.env.PUBLISH_DRY_RUN === 'true'
  if (dryRun) {
    console.log('== DRY RUN ==')
  }
  console.log(`Publishing version '${version}' with tag '${releaseTag}'`)
  await $$`pnpm -r publish --access public --no-git-checks --tag ${releaseTag} ${dryRun ? ['--dry-run'] : []}`
}

async function getReleaseTag(version: string, publishBranch: string) {
  if (version.includes('beta')) {
    return 'beta'
  }
  if (version.includes('alpha')) {
    return 'alpha'
  }

  // Need to specify tag explicitly for backport version releases
  // since otherwise `latest` tag would be overwritten.
  // Note that `main` branch doesn't always mean `latest` tag because of pre-release phase.
  // Use following mapping to avoid https://docs.npmjs.com/cli/v11/commands/npm-dist-tag#caveats
  // - v4 branch -> V4 dist tag
  // - v4.1 branch -> V4.1 dist tag

  const npmView = await $`npm view vitest dist-tags --json`
  const latestVersion = JSON.parse(npmView.stdout).latest
  if (semver.gt(version, latestVersion)) {
    return 'latest'
  }

  return publishBranch.toUpperCase()
}

main().catch((error) => {
  console.error('Error during publishing:', error)
  process.exit(1)
})
