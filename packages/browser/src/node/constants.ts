import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'

const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
const require = createRequire(import.meta.url)
const uiPkgRoot = dirname(require.resolve('@vitest/ui/package.json'))

export const distRoot: string = resolve(pkgRoot, 'dist')
export const uiClientRoot: string = resolve(uiPkgRoot, 'dist/client')
