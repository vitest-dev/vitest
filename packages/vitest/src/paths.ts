import url from 'node:url'
import { resolve } from 'pathe'

export const rootDir = resolve(url.fileURLToPath(import.meta.url), '../../')
export const distDir = resolve(url.fileURLToPath(import.meta.url), '../../dist')

export const entryPath = 'vitest/dist/entry.js'
export const spyPath = 'vitest/dist/spy.js'
