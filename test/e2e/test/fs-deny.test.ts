import type { ViteUserConfig } from 'vitest/config'
import { expect, test } from 'vitest'
import { isFileLoadingAllowed, resolveConfig } from 'vitest/node'

// checks the root server, an inline project sharing it, and a project
// with its own server (`alias` keeps it from sharing the root server)
async function resolveDeniedFiles(viteConfig: ViteUserConfig = {}) {
  const config = await resolveConfig(
    { config: false },
    {
      ...viteConfig,
      test: {
        projects: [
          { test: { name: 'shared' } },
          { test: { name: 'own-server', alias: { foo: '/foo' } } },
        ],
      },
    },
  )
  expect(config.test.resolvedProjects.map((p) => p.viteConfig === config)).toEqual([true, false])

  const files = ['.env', 'server.pem', 'secret.txt', 'node_modules/.vitest/.vitest-secret-token']
  const serverConfigs = {
    root: config,
    ...Object.fromEntries(
      config.test.resolvedProjects.map((p) => [p.projectConfig.name, p.viteConfig]),
    ),
  }
  return Object.fromEntries(
    Object.entries(serverConfigs).map(([name, serverConfig]) => [
      name,
      files.filter((file) => !isFileLoadingAllowed(serverConfig, `${config.root}/${file}`)),
    ]),
  )
}

test('keeps vite default fs.deny and denies the api token file', async () => {
  expect(await resolveDeniedFiles()).toMatchInlineSnapshot(`
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
  expect(await resolveDeniedFiles({ server: { fs: { deny: ['secret.txt'] } } }))
    .toMatchInlineSnapshot(`
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

test('keeps vite default fs.deny', async () => {
  const config = await resolveConfig({ config: false })
  // newest Vite default + api token file
  expect(config.server.fs.deny).toMatchInlineSnapshot(`
    [
      ".env",
      ".env.*",
      "*.{crt,pem,key,p12,pfx,cer,der}",
      ".npmrc",
      ".yarnrc.yml",
      "**/.git/**",
      ".vitest-secret-token",
    ]
  `)
})
