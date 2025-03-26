import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const snapshots = dirname(fileURLToPath(import.meta.url))
const dest = resolve(snapshots, 'test-update')

rmSync(dest, { recursive: true, force: true })
mkdirSync(dest)
cpSync(resolve(snapshots, './test/fixtures/test-update'), dest, { recursive: true })
