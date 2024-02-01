import { getTasks } from '@vitest/runner/utils'
import type { File, Reporter } from '../../types'
import { getFullName } from '../../utils'
import { parseErrorStacktrace } from '@vitest/utils/source-map'
import stripAnsi from 'strip-ansi'
import { printError } from '../error'

export class GithubActionsReporter implements Reporter {
  onFinished(files: File[] = []) {
    for (const file of files) {
      const tasks = getTasks(file)
      for (const suite of tasks) {
        for (const error of suite.result?.errors ?? []) {
          // TODO: do similar to `printError` (or just use whole thing with overriding `logger`?)
          printError
          stripAnsi

          // TODO: StackTraceParserOptions from project
          const stacks = parseErrorStacktrace(error)

          // TODO: nearest to project
          const stack = stacks[0]
          if (!stack) {
            continue
          }

          // TODO: include diff
          const message = error.stack ?? error.message
          const formatted = formatMessage({
            command: 'error',
            properties: {
              file: stack.file,
              title: getFullName(suite, ' > '),
              line: String(stack.line),
              column: String(stack.column),
            },
            message,
          })
          console.log('\n' + formatted)
        }
      }
    }
  }
}

// workflow command formatting based on
// https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-error-message
// https://github.com/actions/toolkit/blob/f1d9b4b985e6f0f728b4b766db73498403fd5ca3/packages/core/src/command.ts#L80-L85

function formatMessage({
  command,
  properties,
  message,
}: {
  command: string
  properties: Record<string, string>
  message: string
}): string {
  let result = `::${command}`
  Object.entries(properties).forEach(([k, v], i) => {
    result += i === 0 ? ' ' : ','
    result += `${k}=${escapeProperty(v)}`
  })
  result += `::${escapeData(message)}`
  return result
}

function escapeData(s: string): string {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

function escapeProperty(s: string): string {
  return s
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C')
}
