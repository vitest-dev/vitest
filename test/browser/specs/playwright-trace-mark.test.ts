import { readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { resolve } from 'pathe'
import { afterEach, describe, expect, test } from 'vitest'
import * as yauzl from 'yauzl'
import { buildTestProjectTree } from '../../test-utils'
import { instances, provider, runBrowserTests } from './utils'

const tracesFolder = resolve(import.meta.dirname, '../fixtures/trace-mark/__traces__')
const basicTestTracesFolder = resolve(tracesFolder, 'basic.test.ts')

describe.runIf(provider.name === 'playwright')('playwright trace marks', () => {
  afterEach(() => {
    rmSync(tracesFolder, { recursive: true, force: true })
  })

  test('vitest mark is present in zipped trace events', async () => {
    const { results, ctx } = await runBrowserTests({
      root: './fixtures/trace-mark',
      browser: {
        trace: {
          mode: 'on',
          screenshots: false, // makes it lighter
        },
      },
    })
    const projectTree = buildTestProjectTree(results, (testCase) => {
      const result = testCase.result()
      return result.state === 'failed'
        ? result.errors.map(e => stripVTControlCharacters(e.message))
        : result.state
    })
    expect(Object.keys(projectTree).sort()).toEqual(instances.map(i => i.browser).sort())

    for (const [name, tree] of Object.entries(projectTree)) {
      expect.soft(tree).toMatchInlineSnapshot(`
        {
          "basic.test.ts": {
            "click": "passed",
            "expect.element fail": [
              "expect(element).toHaveTextContent()

        Expected element to have text content:
          World
        Received:
          Hello",
            ],
            "expect.element pass": "passed",
            "failure": [
              "Test failure",
            ],
            "locator.mark": "passed",
            "page.mark": "passed",
          },
        }
      `)

      const traceFiles = readdirSync(basicTestTracesFolder)
        .filter(file => file.startsWith(`${name}-`) && file.endsWith('.trace.zip'))
        .sort()
      expect(traceFiles).toEqual([
        expect.stringContaining('click'),
        expect.stringContaining('expect-element-fail'),
        expect.stringContaining('expect-element-pass'),
        expect.stringContaining('failure'),
        expect.stringContaining('locator-mark'),
        expect.stringContaining('page-mark'),
      ])

      for (const traceFile of traceFiles) {
        const zipPath = resolve(basicTestTracesFolder, traceFile)
        const parsed = await readTraceZip(zipPath)
        const events = parsed.events.filter(event => event.type === 'before')

        if (traceFile.includes('locator-mark')) {
          expect(events).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                method: 'tracingGroup',
                title: 'button rendered - locator',
              }),
              expect.objectContaining({
                method: 'expect',
                params: expect.objectContaining({
                  selector:
                    '[data-vitest="true"] >> internal:control=enter-frame >> internal:role=button',
                }),
              }),
            ]),
          )
          const frame = events.find(e => e.title === 'button rendered - locator')?.stack?.[0]
          frame.file = path.relative(ctx.config.root, frame.file)
          if (name === 'webkit') {
            expect(frame).toMatchInlineSnapshot(`
              {
                "column": 38,
                "file": "basic.test.ts",
                "line": 10,
              }
            `)
          }
          else {
            expect(frame).toMatchInlineSnapshot(`
              {
                "column": 33,
                "file": "basic.test.ts",
                "line": 10,
              }
            `)
          }
        }

        if (traceFile.includes('page-mark')) {
          expect(events).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                method: 'tracingGroup',
                title: 'button rendered - page',
              }),
              expect.objectContaining({
                method: 'evaluateExpression',
              }),
            ]),
          )
          const frame = events.find(e => e.title === 'button rendered - page')?.stack?.[0]
          frame.file = path.relative(ctx.config.root, frame.file)
          if (name === 'webkit') {
            expect(frame).toMatchInlineSnapshot(`
              {
                "column": 18,
                "file": "basic.test.ts",
                "line": 15,
              }
            `)
          }
          else {
            expect(frame).toMatchInlineSnapshot(`
              {
                "column": 13,
                "file": "basic.test.ts",
                "line": 15,
              }
            `)
          }
        }

        if (traceFile.includes('expect-element-pass')) {
          expect(events).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                method: 'tracingGroup',
                title: 'expect.element().toHaveTextContent',
              }),
              expect.objectContaining({
                method: 'expect',
                params: expect.objectContaining({
                  selector:
                    '[data-vitest="true"] >> internal:control=enter-frame >> internal:role=button',
                }),
              }),
            ]),
          )
          const frame = events.find(e => e.title === 'expect.element().toHaveTextContent')
            ?.stack?.[0]
          frame.file = path.relative(ctx.config.root, frame.file)
          if (name === 'webkit') {
            expect(frame).toMatchInlineSnapshot(`
              {
                "column": 23,
                "file": "basic.test.ts",
                "line": 20,
              }
            `)
          }
          else {
            expect(frame).toMatchInlineSnapshot(`
              {
                "column": 15,
                "file": "basic.test.ts",
                "line": 20,
              }
            `)
          }
        }

        if (traceFile.includes('expect-element-fail')) {
          expect(events).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                method: 'tracingGroup',
                title: 'button rendered',
              }),
              expect.objectContaining({
                method: 'tracingGroup',
                title: 'expect.element().toHaveTextContent [ERROR]',
              }),
              expect.objectContaining({
                method: 'expect',
                params: expect.objectContaining({
                  selector:
                    '[data-vitest="true"] >> internal:control=enter-frame >> internal:role=button',
                }),
              }),
            ]),
          )
          const frame = events.find(e => e.title === 'expect.element().toHaveTextContent [ERROR]')
            ?.stack?.[0]
          frame.file = path.relative(ctx.config.root, frame.file)
          if (name === 'webkit') {
            expect(frame).toMatchInlineSnapshot(`
              {
                "column": 23,
                "file": "basic.test.ts",
                "line": 26,
              }
            `)
          }
          else {
            expect(frame).toMatchInlineSnapshot(`
              {
                "column": 15,
                "file": "basic.test.ts",
                "line": 26,
              }
            `)
          }
        }

        if (traceFile.includes('failure')) {
          const frame = events.find(e => e.title === 'onAfterRetryTask [fail]')?.stack?.[0]
          frame.file = path.relative(ctx.config.root, frame.file)
          if (name === 'webkit') {
            expect(frame).toMatchInlineSnapshot(`
              {
                "column": 18,
                "file": "basic.test.ts",
                "line": 31,
              }
            `)
          }
          else {
            expect(frame).toMatchInlineSnapshot(`
              {
                "column": 8,
                "file": "basic.test.ts",
                "line": 31,
              }
            `)
          }
        }

        if (traceFile.includes('click')) {
          expect(events).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                method: 'click',
                params: expect.objectContaining({
                  selector:
                    '[data-vitest="true"] >> internal:control=enter-frame >> internal:role=button',
                }),
              }),
            ]),
          )
        }
      }
    }
  })
})

async function readTraceZip(zipPath: string): Promise<{ entries: string[]; events: any[] }> {
  const zipFile = new ZipFile(zipPath)
  try {
    const entries = await zipFile.entries()
    const traceText = (await zipFile.read('trace.trace')).toString('utf-8')
    const events = traceText
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        return JSON.parse(line)
      })
    return { entries, events }
  }
  finally {
    zipFile.close()
  }
}

// https://github.com/microsoft/playwright/blob/cd36dab6ecc7f4b3adeec333e55f9ac03711a9b1/packages/playwright-core/src/server/utils/zipFile.ts#L21
class ZipFile {
  private readonly fileName: string
  private zipFile?: yauzl.ZipFile
  private readonly openedPromise: Promise<void>
  private readonly entriesMap = new Map<string, yauzl.Entry>()

  constructor(fileName: string) {
    this.fileName = fileName
    this.openedPromise = this.open()
  }

  private async open(): Promise<void> {
    this.zipFile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
      yauzl.open(this.fileName, { lazyEntries: true, autoClose: false }, (error, zipFile) => {
        if (error || !zipFile) {
          reject(error || new Error(`Cannot open zip: ${this.fileName}`))
          return
        }
        resolve(zipFile)
      })
    })

    await new Promise<void>((resolve, reject) => {
      this.zipFile!.readEntry()
      this.zipFile!.on('entry', (entry) => {
        this.entriesMap.set(entry.fileName, entry)
        this.zipFile!.readEntry()
      })
      this.zipFile!.on('end', resolve)
      this.zipFile!.on('error', reject)
    })
  }

  async entries(): Promise<string[]> {
    await this.openedPromise
    return [...this.entriesMap.keys()]
  }

  async read(entryPath: string): Promise<Buffer> {
    await this.openedPromise
    const entry = this.entriesMap.get(entryPath)
    if (!entry || !this.zipFile) {
      throw new Error(`${entryPath} not found in file ${this.fileName}`)
    }

    return await new Promise((resolve, reject) => {
      this.zipFile!.openReadStream(entry, (error, stream) => {
        if (error || !stream) {
          reject(error || new Error(`Cannot read ${entryPath} from file ${this.fileName}`))
          return
        }

        const buffers: Buffer[] = []
        stream.on('data', data => buffers.push(data))
        stream.on('error', reject)
        stream.on('end', () => resolve(Buffer.concat(buffers)))
      })
    })
  }

  close(): void {
    this.zipFile?.close()
  }
}
