import fs from 'node:fs'

const file = 'pnpm-workspace.yaml'
const content = fs.readFileSync(file, 'utf8')
const updated = content.replace(`vite: 'catalog:'`, 'vite: npm:vite@7')

if (updated === content) {
  throw new Error(`Expected to find the "vite: 'catalog:'" override in ${file}`)
}

fs.writeFileSync(file, updated)
