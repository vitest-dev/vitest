import fs from 'fs'
import { resolve } from 'pathe'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'
import { parse } from 'flatted'

describe('html reporter', async () => {
  const vitestRoot = resolve(__dirname, '../../..')
  const root = resolve(__dirname, '../fixtures')

  const skip = (process.platform === 'win32' || process.platform === 'darwin') && process.env.CI

  it.skipIf(skip).each([
    ['passing', 'all-passing-or-skipped', 'html/all-passing-or-skipped'],
    ['failing', 'json-fail', 'html/fail'],
  ])('resolves to "%s" status for test file "%s"', async (expected, testFile, basePath) => {
    await execa('npx', ['vitest', 'run', testFile, '--reporter=html', `--outputFile=${basePath}/index.html`], {
      cwd: root,
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: 'true',
      },
      stdio: 'inherit',
    }).catch(e => e)
    const metaJson = fs.readFileSync(resolve(root, `${basePath}/html.meta.json`), { encoding: 'utf-8' })
    const indexHtml = fs.readFileSync(resolve(root, `${basePath}/index.html`), { encoding: 'utf-8' })
    const resultJson = parse(metaJson.replace(new RegExp(vitestRoot, 'g'), '<rootDir>'))
    resultJson.config = {} // doesn't matter for a test
    const file = resultJson.files[0]
    file.id = 0
    file.collectDuration = 0
    file.setupDuration = 0
    file.result.duration = 0
    file.result.startTime = 0
    const task = file.tasks[0]
    task.id = 0
    task.result.duration = 0
    task.result.startTime = 0
    if (task.result.error) {
      task.result.error.stack = task.result.error.stack.split('\n')[0]
      task.result.error.stackStr = task.result.error.stackStr.split('\n')[0]
    }
    expect(resultJson).toMatchSnapshot(`tests are ${expected}`)
    expect(indexHtml).toMatch('window.METADATA_PATH="html.meta.json"')
  }, 120000)
})
