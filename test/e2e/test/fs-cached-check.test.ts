import { runInlineTests } from '#test-utils'
import { expect, test } from 'vitest'

test('import a generated file', async () => {
  const { stderr, stdout, testTree } = await runInlineTests({
    'basic.test.js': /* js */ `
      import { expect, test } from "vitest"
      import fs from "node:fs"
      import path from "node:path"
      test("import a generated file", async () => {
        const dist = path.join(import.meta.dirname, "dist");
        await fs.promises.mkdir(dist, { recursive: true });
        await fs.promises.writeFile(path.join(dist, "generated.js"), "export default 'ok'");

        // this file was just generated
        const mod = await import("./dist/generated.js")

        expect(mod.default).toBe("ok");
      })
    `,
  })
  expect(stdout).not.toContain('generated.js')
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "import a generated file": "passed",
      },
    }
  `)
})
