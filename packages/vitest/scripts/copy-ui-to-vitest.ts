import { fileURLToPath } from 'url'
import fs from 'fs'
import { resolve } from 'pathe'
import fg from 'fast-glob'

const root = resolve(fileURLToPath(import.meta.url), '../../../../packages')

const ui = resolve(root, 'ui/dist/report')
const vitest = resolve(root, 'vitest/dist/html-report/')

const files = fg.sync('**/*', { cwd: ui })

fs.mkdirSync(vitest)
fs.mkdirSync(resolve(vitest, 'assets'))

files.forEach((f) => {
  fs.copyFileSync(resolve(ui, f), resolve(vitest, f))
})

