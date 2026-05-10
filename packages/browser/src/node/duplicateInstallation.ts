import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'
import c from 'tinyrainbow'

export interface DuplicateInstallationMismatch {
  name: string
  running: string
  project: string
}

const TRACKED_PACKAGES = ['@vitest/browser', 'vitest'] as const

export function resolvePackageDir(name: string, fromDir: string): string | undefined {
  try {
    const require = createRequire(join(fromDir, '_'))
    const pkgDir = dirname(require.resolve(`${name}/package.json`))
    try {
      return realpathSync.native(pkgDir)
    }
    catch {
      return pkgDir
    }
  }
  catch {
    return undefined
  }
}

export function findDuplicateInstallations(
  runningFrom: string,
  projectRoot: string,
): DuplicateInstallationMismatch[] {
  const mismatches: DuplicateInstallationMismatch[] = []
  for (const name of TRACKED_PACKAGES) {
    const running = resolvePackageDir(name, runningFrom)
    const project = resolvePackageDir(name, projectRoot)
    if (running && project && running !== project) {
      mismatches.push({ name, running, project })
    }
  }
  return mismatches
}

export function formatDuplicateInstallationError(
  mismatches: DuplicateInstallationMismatch[],
  projectIdentifier: string,
): string {
  const lines = mismatches.map(m =>
    `  - ${c.bold(m.name)}\n    running:  ${m.running}\n    project:  ${m.project}`,
  ).join('\n')

  return (
    `[vitest] Detected duplicate installations of Vitest packages for project "${projectIdentifier}".\n`
    + `This is unsupported in browser mode with \`projects\` and will cause tests to hang.\n\n`
    + `${lines}\n\n`
    + `To fix this:\n`
    + `  1. Run \`pnpm why vitest\` (or \`npm ls vitest\`) to find why a package is duplicated.\n`
    + `     A common cause is a peer dependency (e.g. \`@types/node\`, \`vite\`) resolving\n`
    + `     to different versions across packages.\n`
    + `  2. Recommended: declare \`vitest\` and \`@vitest/browser*\` only in the root\n`
    + `     package.json, not in each sub-package, so they are hoisted as a single copy.\n`
    + `  3. Otherwise, force a single version with \`pnpm.overrides\` / \`resolutions\`\n`
    + `     for the diverging peer dependency, then run \`pnpm dedupe\`.\n\n`
    + `See https://vitest.dev/guide/common-errors.html#duplicate-vitest-installation`
  )
}

export function assertSingleInstallation(projectRoot: string, projectName: string): void {
  const runningFrom = dirname(fileURLToPath(import.meta.url))
  const mismatches = findDuplicateInstallations(runningFrom, projectRoot)
  if (!mismatches.length) {
    return
  }
  throw new Error(formatDuplicateInstallationError(mismatches, projectName || projectRoot))
}
