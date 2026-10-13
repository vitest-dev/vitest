import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GitVCSProvider } from '../../../packages/vitest/src/node/vcs/git'

describe('GitVCSProvider', () => {
  let root: string
  let provider: GitVCSProvider

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vitest-git-vcs-'))
    execSync('git init -q && git config user.name test && git config user.email test@example.com', {
      cwd: root,
    })
    provider = new GitVCSProvider()
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('resolves unstaged modified files with quoted names', async () => {
    const fileWithAccent = 'é.test.js'
    writeFileSync(join(root, fileWithAccent), 'initial')
    execSync('git add -A && git commit -qm "init"', { cwd: root })

    writeFileSync(join(root, fileWithAccent), 'updated')
    const files = await provider.findChangedFiles({ root })

    expect(files).toContain(resolve(root, fileWithAccent))
  })

  it('resolves staged files with quoted names', async () => {
    const fileWithQuote = '"quoted".test.js'
    writeFileSync(join(root, fileWithQuote), 'initial')
    execSync('git add -A', { cwd: root })

    const files = await provider.findChangedFiles({ root })

    expect(files).toContain(resolve(root, fileWithQuote))
  })

  it('resolves untracked files with quoted names', async () => {
    const fileWithAccent = 'café.spec.ts'
    writeFileSync(join(root, fileWithAccent), 'untracked')

    const files = await provider.findChangedFiles({ root })

    expect(files).toContain(resolve(root, fileWithAccent))
  })

  it('resolves files committed since revision with quoted names', async () => {
    const fileWithAccent = 'über.test.js'
    writeFileSync(join(root, 'base.js'), 'base')
    execSync('git add -A && git commit -qm "base"', { cwd: root })
    const baseHash = execSync('git rev-parse HEAD', { cwd: root }).toString().trim()

    writeFileSync(join(root, fileWithAccent), 'new file')
    execSync('git add -A && git commit -qm "add uber"', { cwd: root })

    const files = await provider.findChangedFiles({ root, changedSince: baseHash })

    expect(files).toContain(resolve(root, fileWithAccent))
  })
})
