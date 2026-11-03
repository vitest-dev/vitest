import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'pathe'
import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '#test-utils'

function readManifest(cachePath: string) {
  const manifests = readdirSync(cachePath).filter((file) => file.startsWith('_manifest-'))
  expect(manifests).toHaveLength(1)
  const path = join(cachePath, manifests[0])
  return { path, manifest: JSON.parse(readFileSync(path, 'utf-8')) }
}

test('the manifest maps every module to its cache file, which can be edited', async () => {
  const cold = await runInlineTests({
    'vitest.config.js': {
      test: {
        fsModuleCache: true,
        fsModuleCachePath: './node_modules/.vitest-fs-cache',
      },
    },
    'src/math.ts': /* ts */ `
      export function add(a: number, b: number): number {
        return a + b
      }
    `,
    'src/math.test.ts': /* ts */ `
      import { expect, test } from 'vitest'
      import { add } from './math'

      test('add', () => {
        expect(add(1, 2)).toBe(3)
      })
    `,
  })
  expect(cold.stderr).toBe('')
  expect(cold.testTree()).toMatchInlineSnapshot(`
    {
      "src/math.test.ts": {
        "add": "passed",
      },
    }
  `)

  const cachePath = join(cold.root, 'node_modules/.vitest-fs-cache')
  const { path, manifest } = readManifest(cachePath)
  expect(manifest.name).toBe('')
  expect(manifest.root).toBe(cold.root.replaceAll('\\', '/'))
  expect(JSON.stringify(manifest.modules, null, 2).replace(/"[\da-f]{40}"/g, '"<cache file>"'))
    .toMatchInlineSnapshot(`
    "{
      "ssr": {
        "/src/math.test.ts": "<cache file>",
        "/src/math.ts": "<cache file>"
      }
    }"
  `)

  const mathCache = join(cachePath, manifest.modules.ssr['/src/math.ts'])
  const code = readFileSync(mathCache, 'utf-8')
  expect(code.slice(0, code.indexOf('//# sourceMappingSource'))).toMatchInlineSnapshot(`
    "__vite_ssr_exportName__("add", () => { try { return add } catch {} });
    function add(a, b) {
    	return a + b;
    }
    "
  `)
  writeFileSync(mathCache, code.replace('return a + b', 'return a * b'))
  // a run served from the cache writes the manifest too
  rmSync(path)

  const warm = await runVitest({ root: cold.root })
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "src/math.test.ts": {
        "add": [
          "expected 2 to be 3 // Object.is equality",
        ],
      },
    }
  `)
  expect(readManifest(cachePath).manifest).toEqual(manifest)
})
