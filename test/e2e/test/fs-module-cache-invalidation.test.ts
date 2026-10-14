import { readdirSync, statSync } from 'node:fs'
import { join } from 'pathe'
import { expect, test } from 'vitest'
import { runInlineTests, runVitest, useTmpFS } from '#test-utils'

function cacheTimestamps(cachePath: string) {
  return readdirSync(cachePath).map((file) => [file, statSync(join(cachePath, file)).mtimeMs])
}

// The import check must not report a false miss, or the cache is rewritten on
// every run: virtual modules resolve to ids that are not files.
test('an unchanged module graph is served from the cache', async () => {
  const cold = await runInlineTests({
    'vitest.config.js': /* js */ `
      export default {
        plugins: [
          {
            name: 'answer',
            resolveId(id) {
              if (id === 'virtual:answer') return '\\0virtual:answer'
            },
            load(id) {
              if (id === '\\0virtual:answer') return 'export const answer = 42'
            },
          },
        ],
        test: {
          fsModuleCache: true,
          fsModuleCachePath: './node_modules/.vitest-fs-cache',
        },
      }
    `,
    'src/a.ts': /* ts */ `
      import { answer } from 'virtual:answer'
      import { value } from './b'
      export const sum = answer + value
    `,
    'src/b.ts': `export const value = 1`,
    'src/a.test.ts': /* ts */ `
      import { expect, it } from 'vitest'
      import { sum } from './a'
      it('reads it', () => {
        expect(sum).toBe(43)
      })
    `,
  })
  expect(cold.stderr).toBe('')
  expect(cold.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "reads it": "passed",
      },
    }
  `)
  await cold.ctx?.close()

  const cachePath = join(cold.root, 'node_modules/.vitest-fs-cache')
  const timestamps = cacheTimestamps(cachePath)
  expect(timestamps.length).toBeGreaterThan(1)

  const warm = await runVitest({ root: cold.root })
  expect(warm.stderr).toBe('')
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "reads it": "passed",
      },
    }
  `)
  expect(cacheTimestamps(cachePath)).toEqual(timestamps)
})

// An id can look like an absolute path without being a file, so the url does
// not give it back. Windows cannot run such a module: its url has no drive
// letter, which is not a valid file url there.
test.skipIf(process.platform === 'win32')(
  'an import with an id that its url does not give back is served from the cache',
  async () => {
    const cold = await runInlineTests({
      'vitest.config.js': /* js */ `
        export default {
          plugins: [
            {
              name: 'base',
              resolveId(id) {
                if (id === 'virtual:base' || id === '/virtual/base') return '/virtual/base'
              },
              load(id) {
                if (id === '/virtual/base') return 'export const base = 42'
              },
            },
          ],
          test: {
            fsModuleCache: true,
            fsModuleCachePath: './node_modules/.vitest-fs-cache',
          },
        }
      `,
      'src/a.ts': /* ts */ `
        import { base } from 'virtual:base'
        export const sum = base + 1
      `,
      'src/a.test.ts': /* ts */ `
        import { expect, it } from 'vitest'
        import { sum } from './a'
        it('reads it', () => {
          expect(sum).toBe(43)
        })
      `,
    })
    expect(cold.stderr).toBe('')
    expect(cold.errorTree()).toMatchInlineSnapshot(`
      {
        "src/a.test.ts": {
          "reads it": "passed",
        },
      }
    `)
    await cold.ctx?.close()

    const cachePath = join(cold.root, 'node_modules/.vitest-fs-cache')
    const timestamps = cacheTimestamps(cachePath)
    expect(timestamps.length).toBeGreaterThan(1)

    const warm = await runVitest({ root: cold.root })
    expect(warm.stderr).toBe('')
    expect(warm.errorTree()).toMatchInlineSnapshot(`
      {
        "src/a.test.ts": {
          "reads it": "passed",
        },
      }
    `)
    expect(cacheTimestamps(cachePath)).toEqual(timestamps)
  },
)

// A cached transform embeds the resolved URLs of its imports, so it has to be
// dropped when those imports no longer resolve to the same modules, even if
// the importer's own source did not change (a branch switch renames a file).
test('a cached importer is re-transformed after its dependency is renamed', async () => {
  const structure = {
    'src/a.ts': `export { value } from './b'`,
    'src/b.ts': `export const value = 1`,
    'src/a.test.ts': /* ts */ `
      import { expect, it } from 'vitest'
      import { value } from './a'
      it('reads it', () => {
        expect(value).toBe(1)
      })
    `,
  }
  const config = {
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  }

  const cold = await runInlineTests(structure, config)
  expect(cold.stderr).toBe('')
  expect(cold.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "reads it": "passed",
      },
    }
  `)
  await cold.ctx?.close()

  cold.fs.renameFile('src/b.ts', 'src/b.tsx')

  const warm = await runVitest({ root: cold.root, ...config })
  expect(warm.stderr).toBe('')
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "reads it": "passed",
      },
    }
  `)
})

// Vite only lets a client environment read files outside `server.fs.allow`
// when import analysis saw them being imported. A cached importer skips import
// analysis, so its out-of-root imports have to be registered by the cache.
test('a changed dependency outside the root loads after its importer is served from the cache', async () => {
  const fs = useTmpFS(
    {
      'app/package.json': JSON.stringify({ name: 'app', type: 'module' }),
      // keeps the workspace root at app/, so shared/ is outside `server.fs.allow`
      'app/pnpm-workspace.yaml': '',
      'app/vitest.config.mjs': /* js */ `
        export default {
          test: {
            environment: 'jsdom',
            fsModuleCache: true,
            fsModuleCachePath: './node_modules/.vitest-fs-cache',
          },
        }
      `,
      'app/src/a.test.ts': /* ts */ `
        import { expect, it } from 'vitest'
        import { value } from '../../shared/index'
        it('reads it', () => {
          expect(value).toBe(1)
        })
      `,
      'shared/index.ts': `export * from './b'`,
      'shared/b.ts': `export const value = 1`,
    },
    false,
  )
  const root = join(fs.root, 'app')

  const cold = await runVitest({ root })
  expect(cold.stderr).toBe('')
  expect(cold.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "reads it": "passed",
      },
    }
  `)
  await cold.ctx?.close()

  fs.editFile('shared/b.ts', (content) => `${content}\nexport const probe = 2\n`)

  const warm = await runVitest({ root })
  expect(warm.stderr).toBe('')
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "reads it": "passed",
      },
    }
  `)
})

// Imports from outside the root are rewritten to /@fs/ urls, which the
// resolver accepts without checking that the file still exists.
test('a cached importer is re-transformed after a dependency outside the root is renamed', async () => {
  const fs = useTmpFS(
    {
      'app/package.json': JSON.stringify({ name: 'app', type: 'module' }),
      'app/vitest.config.mjs': /* js */ `
        export default {
          test: {
            fsModuleCache: true,
            fsModuleCachePath: './node_modules/.vitest-fs-cache',
          },
        }
      `,
      'app/src/a.test.ts': /* ts */ `
        import { expect, it } from 'vitest'
        import { value } from '../../shared/index'
        it('reads it', () => {
          expect(value).toBe(1)
        })
      `,
      'shared/index.ts': `export * from './b'`,
      'shared/b.ts': `export const value = 1`,
    },
    false,
  )
  const root = join(fs.root, 'app')

  const cold = await runVitest({ root })
  expect(cold.stderr).toBe('')
  expect(cold.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "reads it": "passed",
      },
    }
  `)
  await cold.ctx?.close()

  fs.renameFile('shared/b.ts', 'shared/b.tsx')

  const warm = await runVitest({ root })
  expect(warm.stderr).toBe('')
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "reads it": "passed",
      },
    }
  `)
})

test('a cached importer is re-transformed when an import specifier resolves to a different existing file', async () => {
  const structure = {
    'src/target/index.ts': `export const value = "index"`,
    'src/consumer.ts': `export { value } from "./target"`,
    'src/a.test.ts': /* ts */ `
      import { expect, it } from 'vitest'
      import { value } from './consumer'
      it('reads value', () => {
        expect(value).toBe("index")
      })
    `,
  }
  const config = {
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  }

  const cold = await runInlineTests(structure, config)
  expect(cold.stderr).toBe('')
  expect(cold.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "reads value": "passed",
      },
    }
  `)
  await cold.ctx?.close()

  cold.fs.createFile('src/target.ts', `export const value = "file"`)
  cold.fs.editFile('src/a.test.ts', (content) => content.replace('"index"', '"file"'))

  const warm = await runVitest({ root: cold.root, ...config })
  expect(warm.stderr).toBe('')
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "reads value": "passed",
      },
    }
  `)
})

test('a module with dynamic import template is not cached', async () => {
  const structure = {
    'locales/en.ts': `export const msg = "hello"`,
    'src/loader.ts': /* ts */ `
      export async function load(name: string) {
        return import(\`../locales/\${name}.ts\`)
      }
    `,
    'src/a.test.ts': /* ts */ `
      import { expect, it } from 'vitest'
      import { load } from './loader'
      it('loads dynamic', async () => {
        const mod = await load('en')
        expect(mod.msg).toBe('hello')
      })
    `,
  }
  const config = {
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  }

  const cold = await runInlineTests(structure, config)
  expect(cold.stderr).toBe('')
  expect(cold.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "loads dynamic": "passed",
      },
    }
  `)
  await cold.ctx?.close()

  cold.fs.createFile('locales/fr.ts', `export const msg = "bonjour"`)
  cold.fs.editFile('src/a.test.ts', (content) =>
    content.replace("'en'", "'fr'").replace("'hello'", "'bonjour'"),
  )

  const warm = await runVitest({ root: cold.root, ...config })
  expect(warm.stderr).toBe('')
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "loads dynamic": "passed",
      },
    }
  `)
})

test('a cached module is invalidated when nearest tsconfig changes', async () => {
  const structure = {
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        useDefineForClassFields: false,
      },
    }),
    'src/model.ts': /* ts */ `
      export class User {
        name?: string
      }
    `,
    'src/a.test.ts': /* ts */ `
      import { expect, it } from 'vitest'
      import { User } from './model'
      it('checks own property', () => {
        const u = new User()
        expect(Object.hasOwn(u, 'name')).toBe(false)
      })
    `,
  }
  const config = {
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  }

  const cold = await runInlineTests(structure, config)
  expect(cold.stderr).toBe('')
  expect(cold.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "checks own property": "passed",
      },
    }
  `)
  await cold.ctx?.close()

  cold.fs.editFile('tsconfig.json', () =>
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        useDefineForClassFields: true,
      },
    }),
  )
  cold.fs.editFile('src/a.test.ts', (content) => content.replace('toBe(false)', 'toBe(true)'))

  const warm = await runVitest({ root: cold.root, ...config })
  expect(warm.stderr).toBe('')
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "checks own property": "passed",
      },
    }
  `)
})

test('a cached module is invalidated when a nearer tsconfig is newly created', async () => {
  const structure = {
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        useDefineForClassFields: false,
      },
    }),
    'src/model.ts': /* ts */ `
      export class User {
        name?: string
      }
    `,
    'src/a.test.ts': /* ts */ `
      import { expect, it } from 'vitest'
      import { User } from './model'
      it('checks own property', () => {
        const u = new User()
        expect(Object.hasOwn(u, 'name')).toBe(false)
      })
    `,
  }
  const config = {
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  }

  const cold = await runInlineTests(structure, config)
  expect(cold.stderr).toBe('')
  expect(cold.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "checks own property": "passed",
      },
    }
  `)
  await cold.ctx?.close()

  // Create a nearer tsconfig in src/ with useDefineForClassFields: true
  cold.fs.createFile(
    'src/tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        useDefineForClassFields: true,
      },
    }),
  )
  cold.fs.editFile('src/a.test.ts', (content) => content.replace('toBe(false)', 'toBe(true)'))

  const warm = await runVitest({ root: cold.root, ...config })
  expect(warm.stderr).toBe('')
  expect(warm.errorTree()).toMatchInlineSnapshot(`
    {
      "src/a.test.ts": {
        "checks own property": "passed",
      },
    }
  `)
})
