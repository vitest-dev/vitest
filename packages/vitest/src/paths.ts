import { resolve } from 'node:path'
import url from 'node:url'

export const rootDir = resolve(url.fileURLToPath(import.meta.url), '../../')
export const distDir = resolve(
  url.fileURLToPath(import.meta.url),
  '../../dist',
)
