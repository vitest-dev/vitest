import { AssertionError } from 'assert'
import type { File, Suite, Task } from 'vitest'

function createSuiteHavingFailedTestWithXmlInError(): File[] {
  const file: File = {
    id: '1223128da3',
    name: 'test/core/test/basic.test.ts',
    type: 'suite',
    mode: 'run',
    filepath: '/vitest/test/core/test/basic.test.ts',
    result: { state: 'fail', duration: 145.99284195899963 },
    tasks: [],
  }

  const suite: Suite = {
    id: '',
    type: 'suite',
    name: 'suite',
    mode: 'run',
    file,
    result: { state: 'pass', duration: 1.90183687210083 },
    tasks: [],
  }

  const errorWithXml = new AssertionError({
    message: 'error message that has XML in it <tag>',
  })

  errorWithXml.stack = 'Error: error message that has XML in it <tag>\n'
    + '    at /vitest/test/core/test/basic.test.ts:8:32\n'
    + '    at etc....'

  const tasks: Task[] = [
    {
      id: '123_0',
      type: 'test',
      name: 'test with xml in error',
      mode: 'run',
      suite,
      fails: undefined,
      file,
      result: {
        state: 'fail',
        error: errorWithXml,
        duration: 2.123123123,
      },
      context: null as any,
    },
  ]

  file.tasks = [suite]
  suite.tasks = tasks

  return [file]
}

export { createSuiteHavingFailedTestWithXmlInError }

