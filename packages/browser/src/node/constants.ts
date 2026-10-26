import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'

const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
export const distRoot: string = resolve(pkgRoot, 'dist')
export const errorCatcherPath: string = resolve(distRoot, 'client/error-catcher.js')
export const matchersPath: string = resolve(distRoot, 'expect-element.js')
