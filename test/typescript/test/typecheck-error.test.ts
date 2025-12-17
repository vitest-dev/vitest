import { describe, expect, it } from 'vitest'
import { runInlineTests } from '../../test-utils'

describe('Typechecker Error Handling', () => {
  it('throws helpful error when tsc outputs help text (missing config)', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const os = await import('node:os')

    // Create a temporary directory for our fake tsc
    const tmpDir = path.join(os.tmpdir(), `vitest-test-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    // Create fake tsc script - cross-platform executable
    const fakeTscPath = path.join(tmpDir, 'fake-tsc')
    const scriptContent = '#!/usr/bin/env node\nconsole.log(\'Version 5.3.3\');\nconsole.log(\'tsc: The TypeScript Compiler - Version 5.3.3\');\nconsole.log(\'\');\nconsole.log(\'COMMON COMMANDS\');\n'

    fs.writeFileSync(fakeTscPath, scriptContent)
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
      'test.ts': `import { test } from 'vitest'\ntest('placeholder', () => { })`
    })

    // Cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch { }

    // Assert that Vitest caught the help text and threw the descriptive error
    const output = stderr + stdout
    expect(output).toContain('TypeScript compiler returned help text instead of type checking results')
    expect(output).toContain('This usually means the tsconfig file was not found')
    expect(output).toContain("Ensure 'tsconfig.json' exists in your project root")
  })
})
