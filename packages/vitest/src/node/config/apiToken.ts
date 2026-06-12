import crypto from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'pathe'

export const API_TOKEN_FS_DENY = '**/.vitest/secrets/**'

export function resolveApiToken(root: string): string {
  const tokenPath = resolve(root, '.vitest/secrets/api-token')
  if (existsSync(tokenPath)) {
    return readFileSync(tokenPath, 'utf-8').trim()
  }

  const token = crypto.randomBytes(32).toString('base64url')
  mkdirSync(dirname(tokenPath), { recursive: true })
  writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 })
  try {
    chmodSync(tokenPath, 0o600)
  }
  catch {}
  return token
}

export function getUiCapabilityPath(base: string, token: string): string {
  const url = new URL(base, 'http://localhost')
  url.searchParams.set('token', token)
  return `${url.pathname}${url.search}${url.hash}`
}

export function getUiCapabilityUrl(origin: string, base: string, token: string): string {
  return new URL(getUiCapabilityPath(base, token), origin).toString()
}
