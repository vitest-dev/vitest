import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFile, runInlineTests } from '../../test-utils'

describe('Typechecker Error Handling', () => {
  it('throws helpful error when tsc outputs help text (missing config)', async () => {
    // TESTING APPROACH:
    // We cannot reliably trigger tsc's help text output in normal usage because:
    // 1. tsc only shows help when called with NO arguments or INVALID arguments
    // 2. Vitest always calls tsc with proper arguments (--noEmit, --pretty, etc.)
    // 3. Invalid tsconfig causes ERROR output, not help text
    //
    // SOLUTION: Use a test executable that mimics tsc help output
    // This is NOT a mock (no jest.mock or similar), but a real executable script
    // that Vitest spawns and executes, validating the error handling logic works.

    // Create a temporary directory for our fake tsc
    const tmpDir = path.join(os.tmpdir(), `vitest-test-${Date.now()}`)

    // Create fake tsc script - cross-platform executable
    // Using createFile ensures cleanup even if test fails
    const fakeTscPath = path.join(tmpDir, 'fake-tsc')
    const scriptContent = '#!/usr/bin/env node\nconsole.log(\'Version 5.3.3\');\nconsole.log(\'tsc: The TypeScript Compiler - Version 5.3.3\');\nconsole.log(\'\');\nconsole.log(\'COMMON COMMANDS\');\n'

    createFile(fakeTscPath, scriptContent)
    fs.chmodSync(fakeTscPath, '755')

    const configContent = `import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    typecheck: {
      enabled: true,
      checker: '${fakeTscPath.replace(/\\/g, '/')}',
    },
  },
})`

    const { stderr, stdout } = await runInlineTests({
      'vitest.config.ts': configContent,
      'example.test-d.ts': 'import { expectTypeOf, test } from \'vitest\'\ntest(\'dummy type test\', () => { expectTypeOf(1).toEqualTypeOf<number>() })',
    })

    // Assert that Vitest caught the help text and threw the descriptive error
    const output = stderr + stdout
    expect(output).toContain('TypeScript compiler returned help text instead of type checking results')
    expect(output).toContain('This usually means the tsconfig file was not found')
    expect(output).toContain('Ensure \'tsconfig.json\' exists in your project root')
  })
})
