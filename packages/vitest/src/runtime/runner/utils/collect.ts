import type { ParsedStack } from '@vitest/utils'
import { parseSingleStack } from '@vitest/utils/source-map'

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
  // first line is the error message
  const lines = stack.split('\n').slice(1)
  for (const line of lines) {
    const parsed = parseSingleStack(line)
    if (parsed && parsed.file === testFilePath) {
      return parsed
    }
  }
}
