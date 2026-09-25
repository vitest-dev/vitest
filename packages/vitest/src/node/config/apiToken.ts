import crypto from 'node:crypto'
import {
  chmodSync,
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'pathe'
import { searchForWorkspaceRoot } from 'vite'

export const API_TOKEN_FILE = '.vitest-secret-token'

// Follows env-paths' user data directory conventions:
// https://github.com/sindresorhus/env-paths/blob/v4.0.0/index.js
function getUserDataDir(): string {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || join(homedir(), 'AppData/Local')
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library/Application Support')
  }
  return process.env.XDG_DATA_HOME || join(homedir(), '.local/share')
}

function readPublishedToken(tokenPath: string): string | undefined {
  try {
    return readFileSync(tokenPath, 'utf-8').trim() || undefined
  }
  catch {
    return undefined
  }
}

export function resolveTokenFromPath(tokenPath: string): { token: string; tokenCreated: boolean } {
  const published = readPublishedToken(tokenPath)
  if (published) {
    return { token: published, tokenCreated: false }
  }

  const dir = dirname(tokenPath)
  mkdirSync(dir, { recursive: true, mode: 0o700 })

  const token = crypto.randomUUID()
  const pendingPath = join(dir, `${API_TOKEN_FILE}.${process.pid}.${crypto.randomUUID()}`)
  writeFileSync(pendingPath, `${token}\n`, { mode: 0o600 })

  let tokenCreated = true
  try {
    // linking fails when another process already published, which keeps a single winner
    linkSync(pendingPath, tokenPath)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      tokenCreated = false
    }
    else {
      renameSync(pendingPath, tokenPath)
    }
  }
  finally {
    rmSync(pendingPath, { force: true })
  }

  const winner = readPublishedToken(tokenPath)
  if (!tokenCreated && !winner) {
    writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 })
    tokenCreated = true
  }

  try {
    chmodSync(dir, 0o700)
    chmodSync(tokenPath, 0o600)
  }
  catch {}
  return { token: (tokenCreated ? token : winner) ?? token, tokenCreated }
}

export function resolveApiToken(root: string): { token: string; tokenCreated: boolean; tokenPath: string } {
  const tokenPaths = [
    join(getUserDataDir(), 'vitest', API_TOKEN_FILE),
    join(searchForWorkspaceRoot(root), 'node_modules/.vitest', API_TOKEN_FILE),
  ]

  for (const tokenPath of tokenPaths) {
    try {
      return { ...resolveTokenFromPath(tokenPath), tokenPath }
    }
    catch {}
  }

  throw new Error(`Failed to create Vitest API token at ${tokenPaths.join(' or ')}`)
}
