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
      import { two } from 'dep'
      import { expect, test } from 'vitest'
      import { add } from './math'

      test('add', () => {
        expect(add(1, two)).toBe(3)
      })
    `,
    'node_modules/dep/package.json': JSON.stringify({
      name: 'dep',
      type: 'module',
      main: 'index.js',
    }),
    'node_modules/dep/index.js': 'export const two = 2',
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

  expect(JSON.stringify(manifest.externalized, null, 2).replaceAll(manifest.root, '<root>'))
    .toMatchInlineSnapshot(`
    "{
      "ssr": {
        "/node_modules/dep/index.js": "<root>/node_modules/dep/index.js"
      }
    }"
  `)

  const mathCache = join(cachePath, manifest.modules.ssr['/src/math.ts'])
  const code = readFileSync(mathCache, 'utf-8')
  // Vite 7 indents with spaces and Vite 8 with tabs
  const transformed = code.slice(0, code.indexOf('//# sourceMappingSource')).replaceAll('\t', '  ')
  expect(transformed).toMatchInlineSnapshot(`
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

test('a watch rerun keeps the manifest entries that another process wrote', async () => {
  const { fs, stderr } = await runInlineTests(
    {
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
    },
    { watch: true },
  )
  expect(stderr).toBe('')

  const cachePath = fs.resolveFile('node_modules/.vitest-fs-cache')
  const { path, manifest } = readManifest(cachePath)
  const mathFile = manifest.modules.ssr['/src/math.ts']
  const otherFile = '0'.repeat(40)
  manifest.modules.ssr['/src/other.ts'] = otherFile
  writeFileSync(path, JSON.stringify(manifest, null, 2))

  fs.editFile('src/math.ts', (content) => content.replace('a + b', 'b + a'))

  await expect
    .poll(() => readManifest(cachePath).manifest.modules.ssr['/src/math.ts'])
    .not.toBe(mathFile)
  expect(readManifest(cachePath).manifest.modules.ssr['/src/other.ts']).toBe(otherFile)
})

test('a dependency moves to modules when it is inlined', async () => {
  const { root, stderr } = await runInlineTests({
    'vitest.config.js': {
      test: {
        fsModuleCache: true,
        fsModuleCachePath: './node_modules/.vitest-fs-cache',
      },
    },
    'basic.test.ts': /* ts */ `
      import { two } from 'dep'
      import { expect, test } from 'vitest'

      test('two', () => {
        expect(two).toBe(2)
      })
    `,
    'node_modules/dep/package.json': JSON.stringify({
      name: 'dep',
      type: 'module',
      main: 'index.js',
    }),
    'node_modules/dep/index.js': 'export const two = 2',
  })
  expect(stderr).toBe('')

  const cachePath = join(root, 'node_modules/.vitest-fs-cache')
  expect(Object.keys(readManifest(cachePath).manifest.externalized.ssr)).toEqual([
    '/node_modules/dep/index.js',
  ])

  const inlined = await runVitest({ root, server: { deps: { inline: ['dep'] } } })
  expect(inlined.stderr).toBe('')
  const { manifest } = readManifest(cachePath)
  expect(manifest.externalized.ssr).toEqual({})
  expect(Object.keys(manifest.modules.ssr)).toEqual([
    '/basic.test.ts',
    '/node_modules/dep/index.js',
  ])
})
