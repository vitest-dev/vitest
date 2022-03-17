import { fileURLToPath } from 'url'
import { promises as fs } from 'fs'
import { resolve } from 'pathe'
import { notNullish } from '../packages/vitest/src/utils'

const noOnlinePlayground = [
  'puppeteer', // e2e doesn't work in StackBlitz
]

async function run() {
  const examplesRoot = resolve(fileURLToPath(import.meta.url), '../../examples')

  const examples = await fs.readdir(examplesRoot)

  const data = await Promise.all(examples.map(async(name) => {
    const path = resolve(examplesRoot, name)
    if ((await fs.lstat(path)).isFile())
      return

    const github = `https://github.com/vitest-dev/vitest/tree/main/examples/${name}`
    const stackblitz = noOnlinePlayground.includes(name) ? undefined : `https://stackblitz.com/fork/github/vitest-dev/vitest/tree/main/examples/${name}?initialPath=__vitest__`
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
