import type { UserConfig as ViteUserConfig } from 'vite'
import type { TestUserConfig } from 'vitest/node'
import { resolve } from 'pathe'
import { describe, expect, it, onTestFinished } from 'vitest'
import { createVitest, parseCLI } from 'vitest/node'

type VitestOptions = Parameters<typeof createVitest>[3]

async function vitest(cliOptions: TestUserConfig, configValue: TestUserConfig = {}, viteConfig: ViteUserConfig = {}, vitestOptions: VitestOptions = {}) {
  const vitest = await createVitest('test', { ...cliOptions, watch: false }, { ...viteConfig, test: configValue as any }, vitestOptions)
  onTestFinished(() => vitest.close())
  return vitest
}

async function config(cliOptions: TestUserConfig, configValue: TestUserConfig = {}, viteConfig: ViteUserConfig = {}, vitestOptions: VitestOptions = {}) {
  const v = await vitest(cliOptions, configValue, viteConfig, vitestOptions)
  return v.config
}

describe('correctly defines api flag', () => {
  it('CLI overrides disabling api', async () => {
    const c = await vitest({ api: false }, {
      api: {
        port: 1234,
      },
      watch: true,
    })
    expect(c.vite.config.server.middlewareMode).toBe(true)
    expect(c.config.api).toEqual({
      allowExec: true,
      allowWrite: true,
      middlewareMode: true,
      token: expect.any(String),
    })
  })

  it('CLI overrides inlined value', async () => {
    const c = await vitest({ api: { port: 4321 } }, {
      api: {
        port: 1234,
      },
      watch: true,
    })
    expect(c.vite.config.server.port).toBe(4321)
    expect(c.config.api).toEqual({
      port: 4321,
      allowWrite: true,
      allowExec: true,
      token: expect.any(String),
    })
  })

  it('browser.isolate is inherited', async () => {
    const c = await vitest({ isolate: false }, {})
    expect(c.config.isolate).toBe(false)
    expect(c.config.browser.isolate).toBe(false)
  })

  it('allowWrite and allowExec default to true when not exposed to network', async () => {
    const c = await config({ api: { port: 5555 } }, {})
    expect(c.api.allowWrite).toBe(true)
    expect(c.api.allowExec).toBe(true)
  })

  it('allowWrite and allowExec default to true for localhost', async () => {
    const c = await config({ api: { port: 5555, host: 'localhost' } }, {})
    expect(c.api.allowWrite).toBe(true)
    expect(c.api.allowExec).toBe(true)
  })

  it('allowWrite and allowExec default to true for 127.0.0.1', async () => {
    const c = await config({ api: { port: 5555, host: '127.0.0.1' } }, {})
    expect(c.api.allowWrite).toBe(true)
    expect(c.api.allowExec).toBe(true)
  })

  it('allowWrite and allowExec default to false when exposed to network', async () => {
    const c = await config({ api: { port: 5555, host: '0.0.0.0' } }, {})
    expect(c.api.allowWrite).toBe(false)
    expect(c.api.allowExec).toBe(false)
  })

  it('allowWrite and allowExec can be explicitly overridden when exposed to network', async () => {
    const c = await config({ api: { port: 5555, host: '0.0.0.0', allowWrite: true, allowExec: true } }, {})
    expect(c.api.allowWrite).toBe(true)
    expect(c.api.allowExec).toBe(true)
  })

  it('allowWrite and allowExec can be explicitly disabled', async () => {
    const c = await config({ api: { port: 5555, allowWrite: false, allowExec: false } }, {})
    expect(c.api.allowWrite).toBe(false)
    expect(c.api.allowExec).toBe(false)
  })

  it('browser.api inherits allowWrite and allowExec from api', async () => {
    const c = await config({ api: { port: 5555, allowWrite: false, allowExec: false } }, {})
    expect(c.browser.api.allowWrite).toBe(false)
    expect(c.browser.api.allowExec).toBe(false)
  })

  it('browser.api can override inherited allowWrite and allowExec', async () => {
    const c = await config({
      api: { port: 5555, allowWrite: false, allowExec: false },
      browser: { api: { allowWrite: true, allowExec: true } },
    }, {
      browser: {},
    })
    expect(c.api.allowWrite).toBe(false)
    expect(c.api.allowExec).toBe(false)
    expect(c.browser.api.allowWrite).toBe(true)
    expect(c.browser.api.allowExec).toBe(true)
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
  const v = await vitest({}, {
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
  expect(v.config.experimental.fsModuleCache).toBe(true)
  expect(v.projects[0].config.experimental.fsModuleCache).toBe(true)

  expect(v.config.experimental.fsModuleCachePath).toBe(resolve('./node_modules/custom-cache-path'))
  expect(v.projects[0].config.experimental.fsModuleCachePath).toBe(resolve('./node_modules/custom-cache-path'))
})

it('project overrides experimental fsModuleCache', async () => {
  const v = await vitest({}, {
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
  expect(v.config.experimental.fsModuleCache).toBe(true)
  expect(v.projects[0].config.experimental.fsModuleCache).toBe(false)

  expect(v.config.experimental.fsModuleCachePath).toBe(resolve('./node_modules/custom-cache-path'))
  expect(v.projects[0].config.experimental.fsModuleCachePath).toBe(resolve('./node_modules/project-cache-path'))
})
