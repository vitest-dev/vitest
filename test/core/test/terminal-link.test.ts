import { describe, expect, test } from 'vitest'
import { createTerminalLink } from '../../../packages/vitest/src/node/reporters/terminalLink'

describe('createTerminalLink', () => {
  test('returns plain text when TTY is false', () => {
    expect(createTerminalLink('text', '/path/to/file', { isTTY: false, isCI: false })).toBe('text')
  })

  test('returns plain text when CI is true', () => {
    expect(createTerminalLink('text', '/path/to/file', { isTTY: true, isCI: true })).toBe('text')
  })

  test('returns plain text for node: internal modules', () => {
    expect(createTerminalLink('text', 'node:internal', { isTTY: true, isCI: false })).toBe('text')
  })

  test('returns plain text for empty file', () => {
    expect(createTerminalLink('text', '', { isTTY: true, isCI: false })).toBe('text')
  })

  test('returns OSC 8 hyperlink when conditions met', () => {
    const file = '/absolute/path/to/file.ts'
    const result = createTerminalLink('my-file.ts:10:5', file, { isTTY: true, isCI: false })

    expect(result).toContain('\x1B]8;;')
    expect(result).toContain('file:///')
    expect(result).toContain('/absolute/path/to/file.ts')
    expect(result).toContain('\x1B\\my-file.ts:10:5\x1B]8;;\x1B\\')
  })
})
