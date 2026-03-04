import { resolve } from 'node:path'
import url from 'node:url'

export const rootDir: string = resolve(url.fileURLToPath(import.meta.url), '../../')
export const distDir: string = resolve(
  url.fileURLToPath(import.meta.url),
  '../../dist',
)
