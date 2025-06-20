import fs from 'node:fs'
import zlib from 'node:zlib'
import { parse } from 'flatted'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

describe('html reporter', async () => {
  const vitestRoot = resolve(import.meta.dirname, '../../..')
  const root = resolve(import.meta.dirname, '../fixtures')

  it('resolves to "passing" status for test file "all-passing-or-skipped"', async () => {
    const basePath = 'html/all-passing-or-skipped'

    const { stderr } = await runVitest(
      {
        reporters: 'html',
        outputFile: `${basePath}/index.html`,
        root,
        env: { NO_COLOR: '1' },
      },
      ['all-passing-or-skipped'],
    )

    expect(stderr).toBe('')

    const metaJsonGzipped = fs.readFileSync(resolve(root, `${basePath}/html.meta.json.gz`))
    const metaJson = zlib.gunzipSync(metaJsonGzipped).toString('utf-8')
    const indexHtml = fs.readFileSync(resolve(root, `${basePath}/index.html`), { encoding: 'utf-8' })
    const resultJson = parse(metaJson.replace(new RegExp(vitestRoot, 'g'), '<rootDir>'))
    resultJson.config = {} // doesn't matter for a test
    const file = resultJson.files[0]
    file.id = 0
    file.collectDuration = 0
    file.environmentLoad = 0
    file.prepareDuration = 0
    file.setupDuration = 0
    file.importDurations = {}
    file.result.duration = 0
    file.result.startTime = 0
    const task = file.tasks[0]
    task.id = 0
    task.result.duration = 0
    task.result.startTime = 0
    expect(task.result.errors).not.toBeDefined()
    expect(task.result.logs).not.toBeDefined()
    expect(resultJson).toMatchSnapshot(`tests are passing`)
    expect(indexHtml).toMatch('window.METADATA_PATH="html.meta.json.gz"')
  }, 120000)

  it('resolves to "failing" status for test file "json-fail"', async () => {
    const basePath = 'html/fail'

    const { stderr } = await runVitest(
      {
        reporters: 'html',
        outputFile: `${basePath}/index.html`,
        root,
        env: { NO_COLOR: '1' },
      },
      ['json-fail.test'],
    )

    expect(stderr).toBe('')

    const metaJsonGzipped = fs.readFileSync(resolve(root, `${basePath}/html.meta.json.gz`))
    const metaJson = zlib.gunzipSync(metaJsonGzipped).toString('utf-8')
    const indexHtml = fs.readFileSync(resolve(root, `${basePath}/index.html`), { encoding: 'utf-8' })
    const resultJson = parse(metaJson.replace(new RegExp(vitestRoot, 'g'), '<rootDir>'))
    resultJson.config = {} // doesn't matter for a test
    const file = resultJson.files[0]
    file.id = 0
    file.collectDuration = 0
    file.environmentLoad = 0
    file.prepareDuration = 0
    file.setupDuration = 0
    file.importDurations = {}
    file.result.duration = 0
    file.result.startTime = 0
    const task = file.tasks[0]
    task.id = 0
    task.result.duration = 0
    task.result.startTime = 0
    expect(task.result.errors).toBeDefined()
    task.result.errors[0].stack = task.result.errors[0].stack.split('\n')[0]
    expect(task.logs).toBeDefined()
    expect(task.logs).toHaveLength(1)
    task.logs[0].taskId = 0
    task.logs[0].time = 0
    expect(resultJson).toMatchSnapshot(`tests are failing`)
    expect(indexHtml).toMatch('window.METADATA_PATH="html.meta.json.gz"')
  }, 120000)
})
