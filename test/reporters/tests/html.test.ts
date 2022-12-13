import fs from 'fs'
import { resolve } from 'pathe'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'
import { parse } from 'flatted'

describe('html reporter', async () => {
  const root = resolve(__dirname, '../fixtures')

  const skip = (process.platform === 'win32' || process.platform === 'darwin') && process.env.CI

  it.skipIf(skip).each([
    ['pass', 'all-passing-or-skipped', 'html/all-passing-or-skipped'],
    ['fail', 'json-fail', 'html/fail'],
  ])('resolves to "%s" status for test file "%s"', async (expected, file, basePath) => {
    await execa('npx', ['vitest', 'run', file, '--reporter=html', `--outputFile=${basePath}/html-meta.json`], {
      cwd: root,
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: 'true',
      },
      stdio: 'inherit',
    }).catch(e => e)
    const metaJson = fs.readFileSync(resolve(root, `${basePath}/html-meta.json`), { encoding: 'utf-8' })
    const indexHtml = fs.readFileSync(resolve(root, `${basePath}/index.html`), { encoding: 'utf-8' })
    expect(parse(metaJson).files[0].result.state).toMatch(expected)
    expect(indexHtml).toMatch('html-meta.json')
  }, 40000)
})
