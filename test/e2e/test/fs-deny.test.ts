import type { Vitest } from 'vitest/node'
import { resolveConfig } from 'vite'
import { expect, test } from 'vitest'
import { isFileLoadingAllowed } from 'vitest/node'
import { runInlineTests } from '../../test-utils'

const files = ['.env', 'server.pem', 'secret.txt', 'node_modules/.vitest/.vitest-secret-token']

function denied(ctx: Vitest | undefined, root: string) {
  const servers = {
    root: ctx!.viteConfig,
    ...Object.fromEntries(ctx!.projects.map((p) => [p.name, p.viteConfig])),
  }
  return Object.fromEntries(
    Object.entries(servers).map(([name, config]) => [
      name,
      files.filter((file) => !isFileLoadingAllowed(config, `${root}/${file}`)),
    ]),
  )
}

test('keeps vite default fs.deny and denies the api token file', async () => {
  const { ctx, root, stderr } = await runInlineTests({
    'basic.test.js': `test('ok', () => {})`,
    'vitest.config.js': `export default {
      test: {
        globals: true,
        projects: [
          { test: { name: 'shared' } },
          { test: { name: 'own-server', alias: { foo: '/foo' } } },
        ],
      },
    }`,
  })
  expect(stderr).toBe('')
  expect(ctx!.projects.map((p) => p.viteConfig === ctx!.viteConfig)).toEqual([true, false])
  expect(denied(ctx, root)).toMatchInlineSnapshot(`
    {
      "own-server": [
        ".env",
        "server.pem",
        "node_modules/.vitest/.vitest-secret-token",
      ],
      "root": [
        ".env",
        "server.pem",
        "node_modules/.vitest/.vitest-secret-token",
      ],
      "shared": [
        ".env",
        "server.pem",
        "node_modules/.vitest/.vitest-secret-token",
      ],
    }
  `)
})

test('user fs.deny replaces vite defaults but still denies the api token file', async () => {
  const { ctx, root, stderr } = await runInlineTests({
    'basic.test.js': `test('ok', () => {})`,
    'vitest.config.js': `export default {
      server: { fs: { deny: ['secret.txt'] } },
      test: {
        globals: true,
        projects: [
          { test: { name: 'shared' } },
          { test: { name: 'own-server', alias: { foo: '/foo' } } },
        ],
      },
    }`,
  })
  expect(stderr).toBe('')
  expect(denied(ctx, root)).toMatchInlineSnapshot(`
    {
      "own-server": [
        "secret.txt",
        "node_modules/.vitest/.vitest-secret-token",
      ],
      "root": [
        "secret.txt",
        "node_modules/.vitest/.vitest-secret-token",
      ],
      "shared": [
        "secret.txt",
        "node_modules/.vitest/.vitest-secret-token",
      ],
    }
  `)
})

test('keeps the same fs.deny defaults as vite', async () => {
  const { server } = await resolveConfig({ configFile: false }, 'serve')
  const { ctx, stderr } = await runInlineTests({
    'basic.test.js': `import { test } from 'vitest'; test('ok', () => {})`,
  })
  expect(stderr).toBe('')
  expect(ctx!.viteConfig.server.fs.deny).toEqual([...server.fs.deny, '.vitest-secret-token'])
})
