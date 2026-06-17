import crypto from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'pathe'
import { searchForWorkspaceRoot } from 'vite'

export const API_TOKEN_FS_DENY = '.vitest-secret-token'

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

function resolveTokenFromPath(tokenPath: string): string | undefined {
  if (existsSync(tokenPath)) {
    return readFileSync(tokenPath, 'utf-8').trim()
  }

  const token = crypto.randomUUID()
  mkdirSync(dirname(tokenPath), { recursive: true, mode: 0o700 })
  writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 })
  try {
    chmodSync(dirname(tokenPath), 0o700)
    chmodSync(tokenPath, 0o600)
  }
  catch {}
  return token
}

export function resolveApiToken(root: string): string {
  // TODO: self expire token?
  const tokenPaths = [
    join(getUserDataDir(), 'vitest/.vitest-secret-token'),
    join(searchForWorkspaceRoot(root), 'node_modules/.vitest/.vitest-secret-token'),
  ]

  for (const tokenPath of tokenPaths) {
    try {
      const token = resolveTokenFromPath(tokenPath)
      if (token) {
        return token
      }
    }
    catch {}
  }

  throw new Error(`Failed to create Vitest API token at ${tokenPaths.join(' or ')}`)
}

// TODO: inline. or stash UI url earlier in ctx.something?
export function getUiCapabilityPath(base: string, token: string): string {
  const url = new URL(base, 'http://localhost')
  url.searchParams.set('token', token)
  return `${url.pathname}${url.search}${url.hash}`
}

export function getUiCapabilityUrl(origin: string, base: string, token: string): string {
  return new URL(getUiCapabilityPath(base, token), origin).toString()
}
