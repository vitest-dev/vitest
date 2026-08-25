import { createHash } from 'node:crypto'
import { relative, resolve } from 'pathe'
import { expect, test } from 'vitest'
import { configDefaults } from 'vitest/config'
import { resolveConfig } from 'vitest/node'
import { runVitest, ts, useFS, useTmpFS } from '#test-utils'

const exampleTest = ts`
  import { expect, test } from 'vitest'

  test('example', () => {
    expect(1).toBe(1)
  })
`

const testRootConfig = ts`
  import { resolve } from 'node:path'
  import { defineConfig } from 'vitest/config'

  export default defineConfig({
    test: {
      root: resolve(import.meta.dirname, './nested'),
    },
  })
`

test('tests are collected from `test.root` of the config file when `--root` is not passed', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': testRootConfig,
    './nested/example.test.ts': exampleTest,
  })

  const { ctx, stderr } = await runVitest({
    config: fs.resolveFile('./vitest.config.ts'),
  })

  expect(stderr).toBe('')
  expect(ctx?.config.root).toBe(resolve(fs.root, 'nested'))
  expect(ctx?.state.getTestModules()).toHaveLength(1)
})

test('watch mode re-resolves `test.root` when the config changes', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': testRootConfig,
    './nested/example.test.ts': exampleTest,
    './nested2/example.test.ts': exampleTest,
  })

  const { ctx, vitest, stderr } = await runVitest({
    config: fs.resolveFile('./vitest.config.ts'),
    watch: true,
  })

  expect(stderr).toBe('')
  await vitest.waitForStdout('Waiting for file changes')
  expect(ctx?.config.root).toBe(resolve(fs.root, 'nested'))

  fs.editFile('./vitest.config.ts', content => content.replace(`'./nested'`, `'./nested2'`))

  await vitest.waitForStdout('Restarting due to config changes')
  await expect.poll(() => ctx?.config.root, { timeout: 5000 }).toBe(resolve(fs.root, 'nested2'))
})

test('projects inherit the root watch mode', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': ts`
      import { defineConfig } from 'vitest/config'

      export default defineConfig({
        test: {
          projects: [{ test: { name: 'project' } }],
        },
      })
    `,
  })

  const config = await resolveConfig({
    config: fs.resolveFile('./vitest.config.ts'),
    watch: !configDefaults.watch,
  })

  expect(config.test.watch).toBe(!configDefaults.watch)
  expect(config.test.resolvedProjects.map(project => project.projectConfig.watch)).toEqual([
    config.test.watch,
  ])
})

test('`--root` overrides `test.root` from the config file', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': testRootConfig,
  })

  const config = await resolveConfig({ root: fs.root })

  expect(config.test.root).toBe(fs.root)
})

test('the Vite `root` from the config file applies when `--root` is not passed', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': ts`
      import { resolve } from 'node:path'
      import { defineConfig } from 'vitest/config'

      export default defineConfig({
        root: resolve(import.meta.dirname, './nested'),
      })
    `,
    './nested/.keep': '',
  })

  const config = await resolveConfig({ config: fs.resolveFile('./vitest.config.ts') })

  expect(config.test.root).toBe(resolve(fs.root, 'nested'))
})

test('`test.root` overrides the Vite `root` of the same config file', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': ts`
      import { resolve } from 'node:path'
      import { defineConfig } from 'vitest/config'

      export default defineConfig({
        root: resolve(import.meta.dirname, './vite-root'),
        test: {
          root: resolve(import.meta.dirname, './nested'),
        },
      })
    `,
    './nested/.keep': '',
  })

  const config = await resolveConfig({ config: fs.resolveFile('./vitest.config.ts') })

  expect(config.test.root).toBe(resolve(fs.root, 'nested'))
})

test('`--root` overrides the `root` from Vite overrides', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': ts`
      import { defineConfig } from 'vitest/config'

      export default defineConfig({})
    `,
  })

  const config = await resolveConfig(
    { root: fs.root, config: fs.resolveFile('./vitest.config.ts') },
    { root: resolve(fs.root, 'nested') },
  )

  expect(config.test.root).toBe(fs.root)
})

test('the `root` from Vite overrides applies when `--root` is not passed', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': ts`
      import { defineConfig } from 'vitest/config'

      export default defineConfig({})
    `,
    './nested/.keep': '',
  })

  const config = await resolveConfig(
    { config: fs.resolveFile('./vitest.config.ts') },
    { root: resolve(fs.root, 'nested') },
  )

  expect(config.test.root).toBe(resolve(fs.root, 'nested'))
})

test('`test.root` from the config file overrides the `root` from Vite overrides', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': testRootConfig,
    './nested/.keep': '',
  })

  const config = await resolveConfig(
    { config: fs.resolveFile('./vitest.config.ts') },
    { root: resolve(fs.root, 'other') },
  )

  expect(config.test.root).toBe(resolve(fs.root, 'nested'))
})

test('the `root` from Vite overrides wins over the Vite `root` of the config file', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': ts`
      import { resolve } from 'node:path'
      import { defineConfig } from 'vitest/config'

      export default defineConfig({
        root: resolve(import.meta.dirname, './vite-root'),
      })
    `,
    './nested/.keep': '',
  })

  const config = await resolveConfig(
    { config: fs.resolveFile('./vitest.config.ts') },
    { root: resolve(fs.root, 'nested') },
  )

  expect(config.test.root).toBe(resolve(fs.root, 'nested'))
})

test('a relative `--root` is resolved against the current working directory', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': ts`
      import { defineConfig } from 'vitest/config'

      export default defineConfig({})
    `,
  })

  const config = await resolveConfig({ root: relative(process.cwd(), fs.root) })

  expect(config.test.root).toBe(fs.root)
})

test('a relative `test.root` is resolved against the current working directory', async () => {
  const dirName = `vitest-test-${crypto.randomUUID()}`
  const fs = useFS(resolve(process.cwd(), dirName), {
    './vitest.config.ts': ts`
      import { defineConfig } from 'vitest/config'

      export default defineConfig({
        test: {
          root: '${dirName}/nested',
        },
      })
    `,
    './nested/.keep': '',
  })

  const config = await resolveConfig({ config: fs.resolveFile('./vitest.config.ts') })

  expect(config.test.root).toBe(resolve(fs.root, 'nested'))
})

test('does not load a config from the current working directory when the root has none', async () => {
  const fs = useTmpFS({
    './.keep': '',
  }, false)

  const config = await resolveConfig({ root: fs.root })

  expect(config.configFile).toBe(undefined)
  expect(config.test.root).toBe(fs.root)
})

test('`config: false` ignores the config file inside the root', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': testRootConfig,
  })

  const config = await resolveConfig({ root: fs.root, config: false })

  expect(config.configFile).toBe(undefined)
  expect(config.test.root).toBe(fs.root)
})

test('a relative `--config` is resolved against `--root`', async () => {
  const fs = useTmpFS({
    './conf/vitest.config.ts': ts`
      import { defineConfig } from 'vitest/config'

      export default defineConfig({})
    `,
  })

  const config = await resolveConfig({ root: fs.root, config: 'conf/vitest.config.ts' })

  expect(config.configFile).toBe(fs.resolveFile('./conf/vitest.config.ts'))
  expect(config.test.root).toBe(fs.root)
})

test('the cache directory is resolved against `test.root`', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': testRootConfig,
    './nested/.keep': '',
  })

  const config = await resolveConfig({ config: fs.resolveFile('./vitest.config.ts') })

  expect(config.cacheDir).toBe(
    resolve(fs.root, 'nested/node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709'),
  )
})

test('`test.root` from Vite overrides wins over the config file and loses to `--root`', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': testRootConfig,
    './override/.keep': '',
  })

  const fromOverrides = await resolveConfig(
    { config: fs.resolveFile('./vitest.config.ts') },
    { test: { root: resolve(fs.root, 'override') } },
  )
  expect(fromOverrides.test.root).toBe(resolve(fs.root, 'override'))

  const fromCli = await resolveConfig(
    { root: fs.root, config: fs.resolveFile('./vitest.config.ts') },
    { test: { root: resolve(fs.root, 'override') } },
  )
  expect(fromCli.test.root).toBe(fs.root)
})

const projectsConfig = ts`
  import { resolve } from 'node:path'
  import { defineConfig } from 'vitest/config'

  export default defineConfig({
    test: {
      projects: [
        { root: resolve(import.meta.dirname, './a'), test: { name: 'a' } },
        { test: { name: 'b', root: resolve(import.meta.dirname, './b') } },
        {
          root: resolve(import.meta.dirname, './a'),
          test: { name: 'both', root: resolve(import.meta.dirname, './b') },
        },
      ],
    },
  })
`

function getProjectRoots(config: Awaited<ReturnType<typeof resolveConfig>>) {
  return Object.fromEntries(
    config.test.resolvedProjects.map(p => [p.projectConfig.name, p.projectConfig.root]),
  )
}

test('an inline project resolves its `root` and `test.root`, preferring `test.root`', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': projectsConfig,
    './a/.keep': '',
    './b/.keep': '',
  })

  const config = await resolveConfig({ config: fs.resolveFile('./vitest.config.ts') })

  expect(getProjectRoots(config)).toEqual({
    a: resolve(fs.root, 'a'),
    b: resolve(fs.root, 'b'),
    both: resolve(fs.root, 'b'),
  })
})

test('a file-based project uses its config file directory as `root`', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': ts`
      import { defineConfig } from 'vitest/config'

      export default defineConfig({
        test: {
          projects: ['./packages/*'],
        },
      })
    `,
    './packages/one/vitest.config.ts': ts`
      import { defineConfig } from 'vitest/config'

      export default defineConfig({})
    `,
    './packages/two/vitest.config.ts': ts`
      import { resolve } from 'node:path'
      import { defineConfig } from 'vitest/config'

      export default defineConfig({
        test: {
          root: resolve(import.meta.dirname, '..'),
        },
      })
    `,
  })

  const config = await resolveConfig({ root: fs.root })

  expect(getProjectRoots(config)).toEqual({
    one: resolve(fs.root, 'packages/one'),
    two: resolve(fs.root, 'packages'),
  })
})

test('`--root` does not override project roots', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': projectsConfig,
    './a/.keep': '',
    './b/.keep': '',
  })

  const config = await resolveConfig({ root: fs.root })

  expect(config.test.root).toBe(fs.root)
  expect(getProjectRoots(config)).toEqual({
    a: resolve(fs.root, 'a'),
    b: resolve(fs.root, 'b'),
    both: resolve(fs.root, 'b'),
  })
})

test('the project cache directory is resolved against the project root', async () => {
  const fs = useTmpFS({
    './vitest.config.ts': projectsConfig,
    './a/.keep': '',
    './b/.keep': '',
  })

  const config = await resolveConfig({ config: fs.resolveFile('./vitest.config.ts') })

  const projectA = config.test.resolvedProjects.find(p => p.projectConfig.name === 'a')!
  const nameHash = createHash('sha1').update('a').digest('hex')
  expect(projectA.viteConfig.cacheDir).toBe(
    resolve(fs.root, 'a/node_modules/.vite/vitest', nameHash),
  )
})
