import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { API_TOKEN_FILE, resolveTokenFromPath } from '../../../packages/vitest/src/node/config/apiToken'

const dirs: string[] = []

function tokenDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vitest-api-token-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('resolveTokenFromPath', () => {
  it('reuses a token that is already published', () => {
    const path = join(tokenDir(), API_TOKEN_FILE)
    writeFileSync(path, 'already-published\n')

    expect(resolveTokenFromPath(path)).toEqual({ token: 'already-published', tokenCreated: false })
  })

  it('never returns an empty token for a zero-length file', () => {
    const path = join(tokenDir(), API_TOKEN_FILE)
    writeFileSync(path, '')

    expect(resolveTokenFromPath(path).token).not.toBe('')
  })

  it('never returns an empty token for a whitespace-only file', () => {
    const path = join(tokenDir(), API_TOKEN_FILE)
    writeFileSync(path, '\n')

    expect(resolveTokenFromPath(path).token).not.toBe('')
  })

  it('publishes a file whose contents match the token it returns', () => {
    const path = join(tokenDir(), API_TOKEN_FILE)

    const { token } = resolveTokenFromPath(path)

    expect(readFileSync(path, 'utf-8').trim()).toBe(token)
  })

  it('leaves no intermediate files in the token directory', () => {
    const dir = tokenDir()

    resolveTokenFromPath(join(dir, API_TOKEN_FILE))

    expect(readdirSync(dir)).toEqual([API_TOKEN_FILE])
  })
})
