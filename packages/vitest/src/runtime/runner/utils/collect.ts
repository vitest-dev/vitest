import type { ParsedStack } from '@vitest/utils'
import { parseSingleStack } from '@vitest/utils/source-map'

export function findTestFileStackTrace(testFilePath: string, error: string): ParsedStack | undefined {
  // first line is the error message
  const lines = error.split('\n').slice(1)
  for (const line of lines) {
    const stack = parseSingleStack(line)
    if (stack && stack.file === testFilePath) {
      return stack
    }
  }
}
