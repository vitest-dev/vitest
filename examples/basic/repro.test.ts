import { test } from 'vitest'

test('repro duplicate ANSI error heading in UI', () => {
  const red = '\x1B[31m'
  const reset = '\x1B[0m'
  const message = `${red}expect(element).toHaveTextContent()${reset}`
  const error = new Error(message)
  throw error
})
