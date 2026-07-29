import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'

export const distClientRoot: string = resolve(fileURLToPath(import.meta.url), '../client')
