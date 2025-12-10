import type { TestProject } from '../../../packages/vitest/src/node/project'
import { describe, expect, it } from 'vitest'
import { Typechecker } from '../../../packages/vitest/src/typecheck/typechecker'

describe('Typechecker', () => {
  it('detects tsc help text and throws clear error', async () => {
    // Create a minimal mock project
    const mockProject = {
      config: {
        root: '/fake/root',
        typecheck: {
          tsconfig: 'custom-tsconfig.json',
        },
      },
    } as unknown as TestProject

    const typechecker = new Typechecker(mockProject)
    typechecker.setFiles([])

    // Simulate tsc outputting help text (what happens when tsconfig is missing)
    const tscHelpOutput = `tsc: The TypeScript Compiler - Version 5.9.3

COMMON COMMANDS

  tsc
  Compiles the current project (tsconfig.json in the working directory.)

  tsc app.ts util.ts
  Ignoring tsconfig.json, compiles the specified files with default compiler options.`

    // The prepareResults method should detect help text and throw a clear error
    await expect(
      // @ts-expect-error - accessing protected method for testing
      typechecker.prepareResults(tscHelpOutput),
    ).rejects.toThrow('TypeScript compiler returned help text instead of type checking results')

    try {
      // @ts-expect-error - accessing protected method for testing
      await typechecker.prepareResults(tscHelpOutput)
    }
    catch (error: any) {
      // Verify error message contains helpful information
      expect(error.message).toContain('This usually means the tsconfig file was not found')
      expect(error.message).toContain('custom-tsconfig.json')
      expect(error.message).toContain('Possible solutions:')
    }
  })

  it('detects help text with "COMMON COMMANDS" marker', async () => {
    const mockProject = {
      config: {
        root: '/fake/root',
        typecheck: {},
      },
    } as unknown as TestProject

    const typechecker = new Typechecker(mockProject)
    typechecker.setFiles([])

    // Help text might only contain COMMON COMMANDS without version
    const tscHelpOutput = `COMMON COMMANDS

  tsc
  Compiles the current project (tsconfig.json in the working directory.)`

    await expect(
      // @ts-expect-error - accessing protected method for testing
      typechecker.prepareResults(tscHelpOutput),
    ).rejects.toThrow('TypeScript compiler returned help text')
  })

  it('does not throw error for normal tsc output', async () => {
    const mockProject = {
      config: {
        root: '/fake/root',
        typecheck: {},
      },
    } as unknown as TestProject

    const typechecker = new Typechecker(mockProject)
    typechecker.setFiles([])

    // Normal tsc error output (not help text)
    const normalTscOutput = `test.ts(5,10): error TS2322: Type 'string' is not assignable to type 'number'.`

    // Should not throw for normal tsc errors
    // Note: This will process the output normally
    const result = await
    // @ts-expect-error - accessing protected method for testing
    typechecker.prepareResults(normalTscOutput)

    expect(result).toBeDefined()
    expect(result.files).toBeDefined()
  })
})
