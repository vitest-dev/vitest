import type { ViteUserConfig } from 'vitest/config'
import * as vite from 'vite'
import { expect, test } from 'vitest'
import { isFileLoadingAllowed, resolveConfig } from 'vitest/node'

const files = ['.env', 'server.pem', 'secret.txt', 'node_modules/.vitest/.vitest-secret-token']

const projects = [
  { test: { name: 'shared' } },
  { test: { name: 'own-server', alias: { foo: '/foo' } } },
]

async function denied(viteConfig: ViteUserConfig = {}) {
  const config = await resolveConfig({ config: false }, { ...viteConfig, test: { projects } })
  expect(config.test.resolvedProjects.map((p) => p.viteConfig === config)).toEqual([true, false])
  const servers = {
    root: config,
    ...Object.fromEntries(
      config.test.resolvedProjects.map((p) => [p.projectConfig.name, p.viteConfig]),
    ),
  }
  return Object.fromEntries(
    Object.entries(servers).map(([name, server]) => [
      name,
      files.filter((file) => !isFileLoadingAllowed(server, `${config.root}/${file}`)),
    ]),
  )
}

test('keeps vite default fs.deny and denies the api token file', async () => {
  expect(await denied()).toMatchInlineSnapshot(`
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
  expect(await denied({ server: { fs: { deny: ['secret.txt'] } } })).toMatchInlineSnapshot(`
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
  const viteDefaults = await vite.resolveConfig({ configFile: false }, 'serve')
  const config = await resolveConfig({ config: false })
  expect(config.server.fs.deny).toEqual([...viteDefaults.server.fs.deny, '.vitest-secret-token'])
})
