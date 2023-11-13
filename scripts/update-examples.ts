import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { basename, dirname, resolve } from 'pathe'
import fg from 'fast-glob'
import { notNullish } from '../packages/vitest/src/utils'

const noOnlinePlayground = [
  'playwright',
]

async function run() {
  const examplesRoot = resolve(fileURLToPath(import.meta.url), '../../examples')

  const examples = await fg('*/package.json', { cwd: examplesRoot, absolute: true })

  const data = await Promise.all(examples.sort().map(async (pkgPath) => {
    const path = dirname(pkgPath)
    const name = basename(path)
    if ((await fs.lstat(path)).isFile())
      return

    const github = `https://github.com/vitest-dev/vitest/tree/main/examples/${name}`
    const stackblitz = noOnlinePlayground.includes(name) ? undefined : `https://stackblitz.com/fork/github/vitest-dev/vitest/tree/main/examples/${name}?initialPath=__vitest__/`
    return {
      name,
      path,
      github,
      stackblitz,
    }
  }))

  const table = `| Example | Source | Playground |\n|---|---|---|\n${data.filter(notNullish).map(i => `| \`${i.name}\` | [GitHub](${i.github}) | ${i.stackblitz ? `[Play Online](${i.stackblitz}) ` : ''}|`).join('\n')}`

  await fs.writeFile(resolve(examplesRoot, 'README.md'), `${table}\n`, 'utf-8')
}

run()
