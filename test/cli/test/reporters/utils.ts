import type { ModuleGraph, ViteDevServer } from 'vite'
import type { RunnerTestCase, RunnerTestSuite, TestError } from 'vitest'
import type { Vitest } from 'vitest/src/node/core.js'
import type { Logger } from 'vitest/src/node/logger.js'
import type { StateManager } from 'vitest/src/node/state.js'
import type { ResolvedConfig } from 'vitest/src/node/types/config.js'
import type { RunnerTestFile } from 'vitest/src/public/index.js'
import { createFileTask } from '@vitest/runner/utils'

export function trimReporterOutput(report: string) {
  const rows = report.replace(/\d+ms/g, '[...]ms').split('\n')

  // Trim start and end, capture just rendered tree
  rows.splice(0, 1 + rows.findIndex(row => row.includes('RUN  v')))
  rows.splice(rows.findIndex(row => row.includes('Test Files')))

  return rows.join('\n').trim()
}

interface Context {
  vitest: Vitest
  output: string
}

export function getContext(): Context {
  let output = ''

  const config: Partial<ResolvedConfig> = {
    root: '/vitest',
  }

  const moduleGraph: Partial<ModuleGraph> = {
    getModuleById: () => undefined,
  }

  const vite: Partial<ViteDevServer> = {
    moduleGraph: moduleGraph as ModuleGraph,
  }

  const state: Partial<StateManager> = {
    filesMap: new Map<string, RunnerTestFile[]>(),
  }

  const context: Partial<Vitest> = {
    state: state as StateManager,
    config: config as ResolvedConfig,
    vite: vite as ViteDevServer,
    getProjectByName: () => ({ getBrowserSourceMapModuleById: () => undefined }) as any,
    snapshot: {
      summary: { added: 100, _test: true },
    } as any,
  }

  // @ts-expect-error logger is readonly
  context.logger = {
    ctx: context as Vitest,
    log: (text: string) => output += `${text}\n`,
    highlight: () => {},
  } as unknown as Logger

  return {
    vitest: context as Vitest,
    get output() {
      return output
    },
  }
}

const file = createFileTask(
  '/vitest/test/core/test/basic.test.ts',
  '/vitest/test/core/test',
  '',
)
file.mode = 'run'
file.result = {
  state: 'fail',
  duration: 145.99284195899963,
}

const suiteName = 'suite'
const suite: RunnerTestSuite = {
  id: `${file.id}_0`,
  type: 'suite',
  name: suiteName,
  fullName: `${file.fullName} > ${suiteName}`,
  fullTestName: `${file.fullTestName} > ${suiteName}`,
  mode: 'run',
  meta: {},
  file,
  result: { state: 'pass', duration: 1.90183687210083 },
  tasks: [],
}

const passedFile = createFileTask(
  '/vitest/test/core/test/basic.test.ts',
  '/vitest/test/core/test',
  '',
)
passedFile.mode = 'run'
passedFile.result = { state: 'pass', duration: 145.99284195899963 }
passedFile.tasks.push({
  id: `${file.id}_1`,
  type: 'test',
  name: 'Math.sqrt()',
  fullName: `${suite.fullName} > Math.sqrt()`,
  fullTestName: `${suite.fullTestName} > Math.sqrt()`,
  mode: 'run',
  fails: undefined,
  suite,
  meta: {},
  file: passedFile,
  timeout: 0,
  annotations: [],
  artifacts: [],
  result: {
    state: 'pass',
    duration: 1.4422860145568848,
  },
  context: null as any,
})

const error: TestError = {
  name: 'AssertionError',
  message: 'expected 2.23606797749979 to equal 2',
  actual: '2.23606797749979',
  expected: '2',
  operator: 'strictEqual',
  stacks: undefined!,
}
error.showDiff = true
error.stack = 'AssertionError: expected 2.23606797749979 to equal 2\n'
  + '    at /vitest/test/core/test/basic.test.ts:8:32\n'
  + '    at /vitest/packages/vitest/dist/vi-ac0504aa.js:73:26\n'
  + '    at runTest (/vitest/packages/vitest/dist/entry.js:1689:40)\n'
  + '    at async runSuite (/vitest/packages/vitest/dist/entry.js:1741:13)\n'
  + '    at async runSuites (/vitest/packages/vitest/dist/entry.js:1769:5)\n'
  + '    at async startTests (/vitest/packages/vitest/dist/entry.js:1774:3)\n'
  + '    at async /vitest/packages/vitest/dist/entry.js:1798:7\n'
  + '    at async withEnv (/vitest/packages/vitest/dist/entry.js:1481:5)\n'
  + '    at async run (/vitest/packages/vitest/dist/entry.js:1797:5)\n'
  + '    at async file:///vitest/node_modules/.pnpm/tinypool@0.1.1/node_modules/tinypool/dist/esm/worker.js:96:20'

const tasks: RunnerTestCase[] = [
  {
    id: `${suite.id}_0`,
    type: 'test',
    name: 'Math.sqrt()',
    fullName: `${suite.fullName} > Math.sqrt()`,
    fullTestName: `${suite.fullTestName} > Math.sqrt()`,
    mode: 'run',
    fails: undefined,
    meta: {},
    file,
    suite,
    annotations: [],
    artifacts: [],
    result: {
      state: 'fail',
      errors: [error],
      duration: 1.4422860145568848,
    },
    location: {
      column: 32,
      line: 8,
    },
    timeout: 0,
    context: null as any,
  },
  {
    id: `${suite.id}_1`,
    type: 'test',
    name: 'JSON',
    fullName: `${suite.fullName} > JSON`,
    fullTestName: `${suite.fullTestName} > JSON`,
    mode: 'run',
    annotations: [],
    artifacts: [],
    suite,
    fails: undefined,
    timeout: 0,
    meta: {},
    file,
    result: { state: 'pass', duration: 1.0237109661102295 },
    context: null as any,
  },
  {
    id: `${suite.id}_3`,
    type: 'test',
    name: 'async with timeout',
    fullName: `${suite.fullName} > async with timeout`,
    fullTestName: `${suite.fullTestName} > async with timeout`,
    mode: 'skip',
    suite,
    fails: undefined,
    meta: {},
    timeout: 0,
    file,
    annotations: [],
    artifacts: [],
    result: undefined,
    context: null as any,
  },
  {
    id: `${suite.id}_4`,
    type: 'test',
    name: 'timeout',
    fullName: `${suite.fullName} > timeout`,
    fullTestName: `${suite.fullTestName} > timeout`,
    annotations: [],
    artifacts: [],
    mode: 'run',
    suite,
    fails: undefined,
    meta: {},
    timeout: 0,
    file,
    result: { state: 'pass', duration: 100.50598406791687 },
    context: null as any,
  },
  {
    id: `${suite.id}_5`,
    type: 'test',
    name: 'callback setup success ',
    fullName: `${suite.fullName} > callback setup success `,
    fullTestName: `${suite.fullTestName} > callback setup success `,
    mode: 'run',
    suite,
    fails: undefined,
    annotations: [],
    artifacts: [],
    meta: {},
    timeout: 0,
    file,
    result: { state: 'pass', duration: 20.184875011444092 },
    context: null as any,
  },
  {
    id: `${suite.id}_6`,
    type: 'test',
    name: 'callback test success ',
    fullName: `${suite.fullName} > callback test success `,
    fullTestName: `${suite.fullTestName} > callback test success `,
    mode: 'run',
    suite,
    fails: undefined,
    meta: {},
    timeout: 0,
    annotations: [],
    artifacts: [],
    file,
    result: { state: 'pass', duration: 0.33245420455932617 },
    context: null as any,
  },
  {
    id: `${suite.id}_7`,
    type: 'test',
    name: 'callback setup success done(false)',
    fullName: `${suite.fullName} > callback setup success done(false)`,
    fullTestName: `${suite.fullTestName} > callback setup success done(false)`,
    mode: 'run',
    suite,
    fails: undefined,
    annotations: [],
    artifacts: [],
    meta: {},
    timeout: 0,
    file,
    result: { state: 'pass', duration: 19.738605976104736 },
    context: null as any,
  },
  {
    id: `${suite.id}_8`,
    type: 'test',
    name: 'callback test success done(false)',
    fullName: `${suite.fullName} > callback test success done(false)`,
    fullTestName: `${suite.fullTestName} > callback test success done(false)`,
    mode: 'run',
    suite,
    fails: undefined,
    annotations: [],
    artifacts: [],
    meta: {},
    timeout: 0,
    file,
    result: { state: 'pass', duration: 0.1923508644104004 },
    context: null as any,
    logs: [
      {
        content: '[33merror[39m',
        type: 'stderr',
        time: 1642587001759,
        size: 15,
      },
    ],
  },
  {
    id: `${suite.id}_9`,
    type: 'test',
    name: 'todo test',
    fullName: `${suite.fullName} > todo test`,
    fullTestName: `${suite.fullTestName} > todo test`,
    mode: 'todo',
    suite,
    timeout: 0,
    fails: undefined,
    annotations: [],
    artifacts: [],
    meta: {},
    file,
    result: undefined,
    context: null as any,
  },
]

file.tasks = [suite]
suite.tasks = tasks

const files = [file]
const passedFiles = [passedFile]

export { files, passedFiles }
