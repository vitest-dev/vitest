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

export const API_TOKEN_FS_DENY = '**/.vitest-secret-token'

function getUserDataDir(): string {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || join(homedir(), 'AppData/Local')
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library/Application Support')
  }
  return process.env.XDG_DATA_HOME || join(homedir(), '.local/share')
}

export function resolveApiToken(): string {
  // TODO: self expire token?
  const tokenPath = join(getUserDataDir(), 'vitest/.vitest-secret-token')
  if (existsSync(tokenPath)) {
    return readFileSync(tokenPath, 'utf-8').trim()
  }

  const token = crypto.randomBytes(32).toString('base64url')
  mkdirSync(dirname(tokenPath), { recursive: true, mode: 0o700 })
  writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 })
  try {
    chmodSync(dirname(tokenPath), 0o700)
    chmodSync(tokenPath, 0o600)
  }
  catch {}
  return token
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
