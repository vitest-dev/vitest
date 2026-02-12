import { afterEach, describe, expect, test, vi } from 'vitest'
import { createTerminalLink } from '../../../packages/vitest/src/node/reporters/terminalLink'

describe('createTerminalLink', () => {
    const originalEnv = process.env
    let originalIsTTY: boolean | undefined

    afterEach(() => {
        process.env = originalEnv
        if (originalIsTTY !== undefined) {
            if (process.stdout) {
                process.stdout.isTTY = originalIsTTY
            }
        }
        vi.restoreAllMocks()
    })

    function mockIsTTY(value: boolean) {
        if (process.stdout) {
            originalIsTTY = process.stdout.isTTY
            Object.defineProperty(process.stdout, 'isTTY', {
                value,
                configurable: true,
                writable: true,
            })
        }
    }

    test('returns plain text when TTY is false', () => {
        mockIsTTY(false)
        expect(createTerminalLink('text', '/path/to/file')).toBe('text')
    })

    test('returns plain text when CI is present', () => {
        mockIsTTY(true)
        process.env = { ...originalEnv, CI: 'true' }
        expect(createTerminalLink('text', '/path/to/file')).toBe('text')
    })

    test('returns plain text when VITEST_FORCE_TTY is false', () => {
        mockIsTTY(true)
        process.env = { ...originalEnv, VITEST_FORCE_TTY: 'false' }
        expect(createTerminalLink('text', '/path/to/file')).toBe('text')
    })

    test('returns plain text for node: internal modules', () => {
        mockIsTTY(true)
        expect(createTerminalLink('text', 'node:internal')).toBe('text')
    })

    test('returns plain text for empty file', () => {
        mockIsTTY(true)
        expect(createTerminalLink('text', '')).toBe('text')
    })

    test('returns OSC 8 hyperlink when conditions met', () => {
        mockIsTTY(true)
        process.env = { ...originalEnv, CI: undefined, VITEST_FORCE_TTY: undefined }

        const file = '/absolute/path/to/file.ts'
        const result = createTerminalLink('my-file.ts:10:5', file)

        expect(result).toContain('\x1B]8;;')
        expect(result).toContain('file:///')
        expect(result).toContain('/absolute/path/to/file.ts')
        expect(result).toContain('\x1B\\my-file.ts:10:5\x1B]8;;\x1B\\')
    })
})
