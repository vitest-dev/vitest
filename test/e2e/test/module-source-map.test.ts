import type { TestUserConfig } from 'vitest/node'
import { readdirSync, readFileSync } from 'node:fs'
import { open as openInspector, close as closeInspector } from 'node:inspector'
import { join } from 'pathe'
import { expect, onTestFinished, test } from 'vitest'
import { runInlineTests, runVitest, ts } from '#test-utils'

const testFile = ts`
import type { Debugger } from 'node:inspector'
import { Session } from 'node:inspector/promises'
import { expect, inject, test } from 'vitest'

interface Point {
  x: number
  y: number
}

function fail(point: Point): never {
  throw new Error('failed at ' + point.x)
}

test('compiled source', async () => {
  const session = new Session()
  session.connect()
  const scripts: Debugger.ScriptParsedEventDataType[] = []
  session.on('Debugger.scriptParsed', ({ params }) => scripts.push(params))
  await session.post('Debugger.enable')
  session.disconnect()
  const script = scripts.find(s => s.url.endsWith('basic.test.ts'))!
  const sourceMapComment = '//# ' + ['sourceMa', 'ppingURL'].join('') + '='

  const modules = (globalThis as any).__vitest_worker__.evaluatedModules.idToModuleMap.values()
  const module = [...modules].find(m => m.id.endsWith('/basic.test.ts'))
  let stack = ''
  try {
    fail({ x: 1, y: 2 })
  }
  catch (error: any) {
    stack = error.stack
  }

  expect({
    compiledSourceMap: script.sourceMapURL.slice(0, 29),
    codeHasSourceMap: module.meta.code.includes(sourceMapComment),
    sourceMapSources: JSON.parse(module.meta.sourceMap).sources.map((s: string) => s.split('/').pop()),
    throwLocation: stack.split('\n')[1].match(/basic\.test\.ts:(\d+:\d+)/)?.[1],
  }).toEqual(inject('expected'))
})
`

function expected(compiledSourceMap: string): TestUserConfig['provide'] {
  return {
    expected: {
      compiledSourceMap,
      codeHasSourceMap: false,
      sourceMapSources: ['basic.test.ts'],
      throwLocation: '12:9',
    },
  }
}

test.for(['forks', 'threads', 'vmForks', 'vmThreads'] as const)(
  'compiles modules without the source map comment in %s',
  async (pool) => {
    const { stderr, testTree } = await runInlineTests(
      { 'basic.test.ts': testFile },
      { pool, fsModuleCache: false, provide: expected('') },
    )
    expect(stderr).toBe('')
    expect(testTree()).toEqual({ 'basic.test.ts': { 'compiled source': 'passed' } })
  },
)

test('keeps the source map comment when the main process has an open inspector', async () => {
  // a debugger attached to the main process can attach to worker threads too
  openInspector(0)
  onTestFinished(() => closeInspector())

  const { stderr, testTree } = await runInlineTests(
    { 'basic.test.ts': testFile },
    {
      pool: 'threads',
      fsModuleCache: false,
      provide: expected('data:application/json;base64,'),
    },
  )
  expect(stderr).toBe('')
  expect(testTree()).toEqual({ 'basic.test.ts': { 'compiled source': 'passed' } })
})

test('the fs module cache stores the source map after the code', async () => {
  const config = {
    fsModuleCache: true,
    fsModuleCachePath: './.module-cache',
    provide: expected(''),
  }
  const first = await runInlineTests({ 'basic.test.ts': testFile }, config)
  expect(first.stderr).toBe('')
  expect(first.testTree()).toEqual({ 'basic.test.ts': { 'compiled source': 'passed' } })

  const cacheDir = join(first.root, '.module-cache')
  const cached = readdirSync(cacheDir)
    .filter((file) => !file.startsWith('.') && !file.endsWith('.json') && file !== 'CACHEDIR.TAG')
    .map((file) => readFileSync(join(cacheDir, file), 'utf-8'))
    .find((content) => content.includes('function fail('))!
  const separator = '\n//# vitestSourceMap='
  const sourceMapComment = `//# ${['sourceMa', 'ppingURL'].join('')}=`
  const [code, sourceMap] = cached.split(separator)
  expect(code).not.toContain(sourceMapComment)
  expect(JSON.parse(sourceMap).sources).toEqual(['basic.test.ts'])

  // the second run reads the module back from the cache
  const second = await runVitest({ root: first.root, ...config })
  expect(second.stderr).toBe('')
  expect(second.testTree()).toEqual({ 'basic.test.ts': { 'compiled source': 'passed' } })
  const node = second
    .ctx!.getRootProject()
    .vite.environments.ssr.moduleGraph.getModuleById(join(first.root, 'basic.test.ts'))
  expect(node?.transformResult?.code).toContain('vitestCache=')
  expect(node?.transformResult?.map).toMatchObject({
    file: join(first.root, 'basic.test.ts'),
    sources: ['basic.test.ts'],
  })
})

test('maps stack traces of a changed module in watch mode', async () => {
  const { fs, vitest } = await runInlineTests(
    {
      'basic.test.ts': ts`
import { test } from 'vitest'

function fail(value: number): never {
  throw new Error('failed with ' + value)
}

test('fails', () => {
  fail(1)
})
`,
    },
    { watch: true, isolate: false, maxWorkers: 1 },
  )
  await vitest.waitForStdout('Watching for file changes')
  expect(vitest.stderr).toContain('basic.test.ts:5:9')
  vitest.resetOutput()

  fs.editFile('basic.test.ts', (content) =>
    content.replace('function fail', 'const a: number = 1\nconst b: number = 2\nfunction fail'),
  )
  await vitest.waitForStdout('Watching for file changes')
  expect(vitest.stderr).toContain('basic.test.ts:7:9')
})
