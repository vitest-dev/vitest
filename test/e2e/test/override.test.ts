import type { ResolvedConfig as ResolvedViteConfig, UserConfig as ViteUserConfig } from 'vite'
import type { CliOptions, ResolvedConfig, TestUserConfig } from 'vitest/node'
import { resolveTestConfig } from '#test-utils'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { parseCLI } from 'vitest/node'

async function config(options: TestUserConfig & { $cliOptions?: CliOptions; $viteConfig?: ViteUserConfig }) {
  const { config } = await resolveTestConfig(options) as any
  config.test.$viteConfig = config
  return config.test as ResolvedConfig & { $viteConfig: ResolvedViteConfig }
}

describe('correctly defines api flag', () => {
  it('CLI overrides disabling api', async () => {
    const c = await config({
      $cliOptions: { api: false },
      api: {
        port: 1234,
      },
      watch: true,
    })
    expect(c.$viteConfig.server.middlewareMode).toBe(true)
    expect(c.api).toEqual({
      allowExec: true,
      allowWrite: true,
      middlewareMode: true,
      token: expect.any(String),
      tokenCreated: expect.any(Boolean),
    })
  })

  it('CLI overrides inlined value', async () => {
    const c = await config({
      $cliOptions: { api: { port: 4321 } },
      api: {
        port: 1234,
      },
      watch: true,
    })
    expect(c.$viteConfig.server.port).toBe(4321)
    expect(c.api).toEqual({
      port: 4321,
      allowWrite: true,
      allowExec: true,
      token: expect.any(String),
      tokenCreated: expect.any(Boolean),
    })
  })

  it('allowWrite and allowExec default to true when not exposed to network', async () => {
    const c = await config({ api: { port: 5555 } })
    expect(c.api.allowWrite).toBe(true)
    expect(c.api.allowExec).toBe(true)
  })

  it('allowWrite and allowExec default to true for localhost', async () => {
    const c = await config({ api: { port: 5555, host: 'localhost' } })
    expect(c.api.allowWrite).toBe(true)
    expect(c.api.allowExec).toBe(true)
  })

  it('allowWrite and allowExec default to true for 127.0.0.1', async () => {
    const c = await config({ api: { port: 5555, host: '127.0.0.1' } })
    expect(c.api.allowWrite).toBe(true)
    expect(c.api.allowExec).toBe(true)
  })

  it('allowWrite and allowExec default to false when exposed to network', async () => {
    const c = await config({ api: { port: 5555, host: '0.0.0.0' } })
    expect(c.api.allowWrite).toBe(false)
    expect(c.api.allowExec).toBe(false)
  })

  it('allowWrite and allowExec can be explicitly overridden when exposed to network', async () => {
    const c = await config({ api: { port: 5555, host: '0.0.0.0', allowWrite: true, allowExec: true } })
    expect(c.api.allowWrite).toBe(true)
    expect(c.api.allowExec).toBe(true)
  })

  it('allowWrite and allowExec can be explicitly disabled', async () => {
    const c = await config({ api: { port: 5555, allowWrite: false, allowExec: false } })
    expect(c.api.allowWrite).toBe(false)
    expect(c.api.allowExec).toBe(false)
  })
})

describe.each([
  '--inspect',
  '--inspect-brk',
])('correctly parses %s flags', (inspectFlagName) => {
  it.each([
    ['', { enabled: true }],
    ['true', { enabled: true }],
    ['yes', { enabled: true }],
    ['false', { enabled: false }],
    ['no', { enabled: false }],

    ['1002', { enabled: true, port: 1002 }],
    ['www.remote.com:1002', { enabled: true, port: 1002, host: 'www.remote.com' }],
    ['www.remote.com', { enabled: true, host: 'www.remote.com' }],
  ])(`parses "vitest ${inspectFlagName} %s" value`, async (cliValue, inspect) => {
    const rawConfig = parseCLI(
      `vitest --no-file-parallelism ${inspectFlagName} ${cliValue}`,
    )
    const c = await config(rawConfig.options)
    expect(c.inspector).toEqual({
      ...inspect,
      waitForDebugger: inspectFlagName === '--inspect-brk' && inspect.enabled,
    })
  })
  it('cannot use URL', async () => {
    const url = 'https://www.remote.com:1002'
    const rawConfig = parseCLI([
      'vitest',
      '--no-file-parallelism',
      inspectFlagName,
      url,
    ])
    await expect(async () => {
      await config(rawConfig.options)
    }).rejects.toThrow(`Inspector host cannot be a URL. Use "host:port" instead of "${url}"`)
  })
})

it('experimental fsModuleCache is inherited in a project', async () => {
  const v = await config({
    experimental: {
      fsModuleCache: true,
      fsModuleCachePath: './node_modules/custom-cache-path',
    },
    projects: [
      {
        test: {
          name: 'project',
        },
      },
    ],
  })
  expect(v.experimental.fsModuleCache).toBe(true)
  expect(v.resolvedProjects[0].projectConfig.experimental.fsModuleCache).toBe(true)

  expect(v.experimental.fsModuleCachePath).toBe(resolve('./node_modules/custom-cache-path'))
  expect(v.resolvedProjects[0].projectConfig.experimental.fsModuleCachePath).toBe(resolve('./node_modules/custom-cache-path'))
})

it('project overrides experimental fsModuleCache', async () => {
  const v = await config({
    experimental: {
      fsModuleCache: true,
      fsModuleCachePath: './node_modules/custom-cache-path',
    },
    projects: [
      {
        test: {
          name: 'project',
          experimental: {
            fsModuleCache: false,
            fsModuleCachePath: './node_modules/project-cache-path',
          },
        },
      },
    ],
  })
  expect(v.experimental.fsModuleCache).toBe(true)
  expect(v.resolvedProjects[0].projectConfig.experimental.fsModuleCache).toBe(false)

  expect(v.experimental.fsModuleCachePath).toBe(resolve('./node_modules/custom-cache-path'))
  expect(v.resolvedProjects[0].projectConfig.experimental.fsModuleCachePath).toBe(resolve('./node_modules/project-cache-path'))
})
