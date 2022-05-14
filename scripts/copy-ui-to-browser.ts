import { fileURLToPath } from 'url'
import fs from 'fs'
import { resolve } from 'pathe'
import fg from 'fast-glob'

const root = resolve(fileURLToPath(import.meta.url), '../../packages')

const ui = resolve(root, 'ui/dist/client')
const browser = resolve(root, 'browser/dist/client/__vitest__/')

const files = fg.sync('**/*', { cwd: ui })

fs.mkdirSync(browser)
fs.mkdirSync(resolve(browser, 'assets'))

files.forEach((f) => {
  fs.copyFileSync(resolve(ui, f), resolve(browser, f))
})

