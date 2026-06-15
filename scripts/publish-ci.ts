import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as semver from 'semver'
import { $ } from 'zx'

// How to test release script locally:
// RELEASE_VERSION=4.1.9 pnpm release
// VITEST_GENERATE_UI_TOKEN=true VITE_TEST_WATCHER_DEBUG=false PUBLISH_DRY_RUN=true PUBLISH_BRANCH=v4 pnpm publish-ci 4.1.9

const $$ = $({ stdio: 'inherit' })

async function main() {
  if (process.env.VITEST_GENERATE_UI_TOKEN !== 'true' || process.env.VITE_TEST_WATCHER_DEBUG !== 'false') {
    throw new Error(`Cannot release Vitest without VITEST_GENERATE_UI_TOKEN=${process.env.VITEST_GENERATE_UI_TOKEN} and VITE_TEST_WATCHER_DEBUG=${process.env.VITE_TEST_WATCHER_DEBUG} environment variable. `)
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
  console.log(`Staging version '${version}' with tag '${releaseTag}'`)
  await $$`pnpm stage publish --recursive --access public --no-git-checks --tag ${releaseTag} ${dryRun ? ['--dry-run'] : []}`
}

async function getReleaseTag(version: string, publishBranch: string) {
  // Always specify the dist-tag explicitly since otherwise `latest` would be overwritten.
  // Note that `main` branch doesn't always mean `latest` tag because of pre-release phase.

  // check prerelease e.g. beta, alpha, rc
  const parsed = semver.parse(version, {}, true)
  if (parsed.prerelease.length > 0) {
    return parsed.prerelease[0]
  }

  // If the version is not a pre-release and is greater than the latest version on npm,
  // then that should become the new latest version.
  const npmView = await $`npm view vitest dist-tags --json`
  const latestVersion = JSON.parse(npmView.stdout).latest
  if (semver.gt(version, latestVersion)) {
    return 'latest'
  }

  // Otherwise this is a backport release.
  // Use the uppercase of the branch name to avoid npm dist-tag caveats
  // https://docs.npmjs.com/cli/v11/commands/npm-dist-tag#caveats
  // - v4 branch -> V4 dist tag
  // - v4.1 branch -> V4.1 dist tag
  return publishBranch.toUpperCase()
}

main().catch((error) => {
  console.error('Error during publishing:', error)
  process.exit(1)
})
