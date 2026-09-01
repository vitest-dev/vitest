import type { ParsedStack } from '@vitest/utils'
import { parseStacktrace } from '@vitest/utils/source-map'

export function findTestFileStackTrace(testFilePath: string, error: Error): ParsedStack | undefined {
  let stack: string | undefined
  try {
    stack = error.stack
  }
  catch {
    // accessing `.stack` runs `Error.prepareStackTrace`, which can throw
    // if the test froze `Object.prototype` (see vitest-dev/vscode#798)
    return undefined
  }
  if (!stack) {
    return undefined
  }
  return parseStacktrace(stack, { ignoreStackEntries: [] })
    .find(stack => stack.file === testFilePath)
}
