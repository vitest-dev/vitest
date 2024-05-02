import assert from 'node:assert'
import fs from 'node:fs'
import { dirname } from 'node:path'
import fg from 'fast-glob'

// usage:
// npx tsx scripts/setup-overrides.ts <target-package.json>

async function main() {
  const [targetPath] = process.argv.slice(2)
  assert.ok(fs.existsSync(targetPath))

  const pkgPaths = await fg('./packages/*/package.json', { absolute: true })
  const overrides: Record<string, string> = {}
  for (const pkgPath of pkgPaths) {
    const pkg = await readJson(pkgPath)
    overrides[pkg.name] = `file:${dirname(pkgPath)}`
  }

  await editJson(targetPath, (data) => {
    Object.assign((data.pnpm ??= {}).overrides ??= {}, overrides)
    return data
  })
}

async function readJson(file: string) {
  return JSON.parse(await fs.promises.readFile(file, 'utf-8'))
}

async function editJson(file: string, edit: (data: any) => any) {
  const data = await readJson(file)
  await fs.promises.writeFile(file, JSON.stringify(edit(data), null, 2))
}

main()
