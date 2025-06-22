import type { RunnerTestCase, RunnerTestSuite, TestError } from 'vitest'
import { createFileTask } from '@vitest/runner/utils'

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

const suite: RunnerTestSuite = {
  id: `${file.id}_0`,
  type: 'suite',
  name: 'suite',
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
  mode: 'run',
  fails: undefined,
  suite,
  meta: {},
  file: passedFile,
  timeout: 0,
  annotations: [],
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
    mode: 'run',
    fails: undefined,
    meta: {},
    file,
    suite,
    annotations: [],
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
    mode: 'run',
    annotations: [],
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
    mode: 'skip',
    suite,
    fails: undefined,
    meta: {},
    timeout: 0,
    file,
    annotations: [],
    result: undefined,
    context: null as any,
  },
  {
    id: `${suite.id}_4`,
    type: 'test',
    name: 'timeout',
    annotations: [],
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
    mode: 'run',
    suite,
    fails: undefined,
    annotations: [],
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
    mode: 'run',
    suite,
    fails: undefined,
    meta: {},
    timeout: 0,
    annotations: [],
    file,
    result: { state: 'pass', duration: 0.33245420455932617 },
    context: null as any,
  },
  {
    id: `${suite.id}_7`,
    type: 'test',
    name: 'callback setup success done(false)',
    mode: 'run',
    suite,
    fails: undefined,
    annotations: [],
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
    mode: 'run',
    suite,
    fails: undefined,
    annotations: [],
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
    mode: 'todo',
    suite,
    timeout: 0,
    fails: undefined,
    annotations: [],
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
