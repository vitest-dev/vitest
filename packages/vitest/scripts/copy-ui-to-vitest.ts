import { fileURLToPath } from 'url'
import fs from 'fs'
import { resolve } from 'pathe'
import fg from 'fast-glob'

const root = resolve(fileURLToPath(import.meta.url), '../../../../packages')

const ui = resolve(root, 'ui/dist/report')
const vitest = resolve(root, 'vitest/dist/html-report/')

const files = fg.sync('**/*', { cwd: ui })
const originFiles = fg.sync('**/*', { cwd: vitest })

originFiles.forEach((f) => {
  fs.unlinkSync(resolve(vitest, f))
})

if (!fs.existsSync(resolve(vitest, 'assets')))
  fs.mkdirSync(resolve(vitest, 'assets'), { recursive: true })

files.forEach((f) => {
  fs.copyFileSync(resolve(ui, f), resolve(vitest, f))
})
