import type { ErrorWithDiff, File, Suite, Task } from 'vitest'

const file: File = {
  id: '1223128da3',
  name: 'test/core/test/basic.test.ts',
  type: 'suite',
  meta: {},
  mode: 'run',
  filepath: '/vitest/test/core/test/basic.test.ts',
  result: { state: 'fail', duration: 145.99284195899963 },
  tasks: [],
  projectName: '',
  file: null!,
}
file.file = file

const suite: Suite = {
  id: '1223128da3_0',
  type: 'suite',
  name: 'suite',
  mode: 'run',
  meta: {},
  file,
  result: { state: 'pass', duration: 1.90183687210083 },
  tasks: [],
}

const passedFile: File = {
  id: '1223128da3',
  name: 'basic.test.ts',
  type: 'suite',
  suite,
  meta: {},
  mode: 'run',
  filepath: '/vitest/test/core/test/basic.test.ts',
  result: { state: 'pass', duration: 145.99284195899963 },
  tasks: [
  ],
  projectName: '',
  file: null!,
}
passedFile.file = passedFile
passedFile.tasks.push({
  id: '1223128da3_0_0',
  type: 'test',
  name: 'Math.sqrt()',
  mode: 'run',
  fails: undefined,
  suite,
  meta: {},
  file: passedFile,
  result: {
    state: 'pass',
    duration: 1.4422860145568848,
  },
  context: null as any,
})

const error: ErrorWithDiff = {
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

const tasks: Task[] = [
  {
    id: '1223128da3_0_0',
    type: 'test',
    name: 'Math.sqrt()',
    mode: 'run',
    fails: undefined,
    meta: {},
    file,
    suite,
    result: {
      state: 'fail',
      errors: [error],
      duration: 1.4422860145568848,
    },
    location: {
      column: 32,
      line: 8,
    },
    context: null as any,
  },
  {
    id: '1223128da3_0_1',
    type: 'test',
    name: 'JSON',
    mode: 'run',
    suite,
    fails: undefined,
    meta: {},
    file,
    result: { state: 'pass', duration: 1.0237109661102295 },
    context: null as any,
  },
  {
    id: '1223128da3_0_3',
    type: 'test',
    name: 'async with timeout',
    mode: 'skip',
    suite,
    fails: undefined,
    meta: {},
    file,
    result: undefined,
    context: null as any,
  },
  {
    id: '1223128da3_0_4',
    type: 'test',
    name: 'timeout',
    mode: 'run',
    suite,
    fails: undefined,
    meta: {},
    file,
    result: { state: 'pass', duration: 100.50598406791687 },
    context: null as any,
  },
  {
    id: '1223128da3_0_5',
    type: 'test',
    name: 'callback setup success ',
    mode: 'run',
    suite,
    fails: undefined,
    meta: {},
    file,
    result: { state: 'pass', duration: 20.184875011444092 },
    context: null as any,
  },
  {
    id: '1223128da3_0_6',
    type: 'test',
    name: 'callback test success ',
    mode: 'run',
    suite,
    fails: undefined,
    meta: {},
    file,
    result: { state: 'pass', duration: 0.33245420455932617 },
    context: null as any,
  },
  {
    id: '1223128da3_0_7',
    type: 'test',
    name: 'callback setup success done(false)',
    mode: 'run',
    suite,
    fails: undefined,
    meta: {},
    file,
    result: { state: 'pass', duration: 19.738605976104736 },
    context: null as any,
  },
  {
    id: '1223128da3_0_8',
    type: 'test',
    name: 'callback test success done(false)',
    mode: 'run',
    suite,
    fails: undefined,
    meta: {},
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
    id: '1223128da3_0_9',
    type: 'test',
    name: 'todo test',
    mode: 'todo',
    suite,
    fails: undefined,
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
