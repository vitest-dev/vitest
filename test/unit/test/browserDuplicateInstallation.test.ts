import type { Stats } from 'node:fs'
import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  findDuplicateInstallations,
  formatDuplicateInstallationError,
  resolvePackageDir,
} from '../../../packages/browser/src/node/duplicateInstallation'

let tmp: string

function makeFakePackage(root: string, name: string, version = '1.0.0'): string {
  const dir = join(root, 'node_modules', name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name, version, exports: { './package.json': './package.json' } }),
  )
  return dir
}

function symlinkPackage(root: string, name: string, target: string): void {
  const dir = join(root, 'node_modules')
  mkdirSync(dir, { recursive: true })
  symlinkSync(target, join(dir, name), 'junction')
}

function isCaseInsensitive(): boolean {
  let stats: Stats | undefined
  try {
    stats = statSync(__dirname.toUpperCase())
  }
  catch {
    return false
  }
  return stats != null
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'vitest-dup-detect-'))
})

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('findDuplicateInstallations', () => {
  it('returns no mismatches when both roots resolve a tracked package to the same physical copy via symlinks', () => {
    const physical = join(tmp, 'sym-same/physical')
    const realPkg = makeFakePackage(physical, 'vitest')
    const a = join(tmp, 'sym-same/a')
    const b = join(tmp, 'sym-same/b')
    mkdirSync(a, { recursive: true })
    mkdirSync(b, { recursive: true })
    symlinkPackage(a, 'vitest', realPkg)
    symlinkPackage(b, 'vitest', realPkg)

    expect(findDuplicateInstallations(a, b)).toEqual([])
  })

  it('flags a tracked package when the two roots resolve it to physically distinct copies', () => {
    const a = join(tmp, 'distinct/a')
    const b = join(tmp, 'distinct/b')
    makeFakePackage(a, 'vitest')
    makeFakePackage(b, 'vitest')

    const mismatches = findDuplicateInstallations(a, b)
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0].name).toBe('vitest')
    expect(mismatches[0].running).not.toBe(mismatches[0].project)
  })

  it('canonicalizes path casing on case-insensitive filesystems', () => {
    if (!isCaseInsensitive()) {
      return
    }
    const root = join(tmp, 'casing/root')
    makeFakePackage(root, 'vitest')

    const upper = resolve(root).replace(/^([a-z]):/i, (_, letter) => `${letter.toUpperCase()}:`)
    const lower = resolve(root).replace(/^([a-z]):/i, (_, letter) => `${letter.toLowerCase()}:`)
    expect(findDuplicateInstallations(upper, lower)).toEqual([])
  })

  it('flags @vitest/browser independently from vitest', () => {
    const a = join(tmp, 'browser/a')
    const b = join(tmp, 'browser/b')
    makeFakePackage(a, '@vitest/browser')
    makeFakePackage(b, '@vitest/browser')

    const mismatches = findDuplicateInstallations(a, b)
    expect(mismatches.map(m => m.name)).toEqual(['@vitest/browser'])
  })
})

describe('resolvePackageDir', () => {
  it('returns undefined when the package is not installed under fromDir', () => {
    expect(resolvePackageDir('definitely-not-a-real-package-xyz', tmp)).toBeUndefined()
  })
})

describe('formatDuplicateInstallationError', () => {
  it('mentions the project identifier and every mismatch', () => {
    const message = formatDuplicateInstallationError(
      [
        { name: 'vitest', running: '/run/vitest', project: '/proj/vitest' },
        { name: '@vitest/browser', running: '/run/browser', project: '/proj/browser' },
      ],
      'my-project',
    )
    expect(message).toContain('"my-project"')
    expect(message).toContain('/run/vitest')
    expect(message).toContain('/proj/vitest')
    expect(message).toContain('/run/browser')
    expect(message).toContain('/proj/browser')
    expect(message).toContain('common-errors.html#duplicate-vitest-installation')
  })
})
