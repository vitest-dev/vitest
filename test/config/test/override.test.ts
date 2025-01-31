import type { UserConfig as ViteUserConfig } from 'vite'
import type { UserConfig } from 'vitest/node'
import { describe, expect, it } from 'vitest'
import { extraInlineDeps } from 'vitest/config'
import { createVitest, parseCLI } from 'vitest/node'

type VitestOptions = Parameters<typeof createVitest>[3]

async function vitest(cliOptions: UserConfig, configValue: UserConfig = {}, viteConfig: ViteUserConfig = {}, vitestOptions: VitestOptions = {}) {
  const vitest = await createVitest('test', { ...cliOptions, watch: false }, { ...viteConfig, test: configValue as any }, vitestOptions)
  return vitest
}

async function config(cliOptions: UserConfig, configValue: UserConfig = {}, viteConfig: ViteUserConfig = {}, vitestOptions: VitestOptions = {}) {
  const v = await vitest(cliOptions, configValue, viteConfig, vitestOptions)
  return v.config
}

describe('correctly defines isolated flags', async () => {
  it('does not merge user-defined poolOptions with itself', async () => {
    const c = await config({}, {
      poolOptions: {
        array: [1, 2, 3],
      },
    })
    // Ensure poolOptions.array has not been merged with itself
    // Previously, this would have been [1,2,3,1,2,3]
    expect(c.poolOptions?.array).toMatchInlineSnapshot(`
      [
        1,
        2,
        3,
      ]
    `)
  })
  it('prefers CLI poolOptions flags over config', async () => {
    const c = await config({
      isolate: true,
      poolOptions: {
        threads: {
          isolate: false,
        },
        forks: {
          isolate: false,
        },
      },
    })
    expect(c.poolOptions?.threads?.isolate).toBe(false)
    expect(c.poolOptions?.forks?.isolate).toBe(false)
    expect(c.isolate).toBe(true)
  })

  it('override CLI poolOptions flags over isolate', async () => {
    const c = await config({
      isolate: false,
      poolOptions: {
        threads: {
          isolate: true,
        },
        forks: {
          isolate: true,
        },
      },
    }, {
      poolOptions: {
        threads: {
          isolate: false,
        },
        forks: {
          isolate: false,
        },
      },
    })
    expect(c.poolOptions?.threads?.isolate).toBe(true)
    expect(c.poolOptions?.forks?.isolate).toBe(true)
    expect(c.isolate).toBe(false)
  })

  it('override CLI isolate flag if poolOptions is not set via CLI', async () => {
    const c = await config({
      isolate: true,
    }, {
      poolOptions: {
        threads: {
          isolate: false,
        },
        forks: {
          isolate: false,
        },
      },
    })
    expect(c.poolOptions?.threads?.isolate).toBe(true)
    expect(c.poolOptions?.forks?.isolate).toBe(true)
    expect(c.isolate).toBe(true)
  })

  it('keeps user configured poolOptions if no CLI flag is provided', async () => {
    const c = await config({}, {
      poolOptions: {
        threads: {
          isolate: false,
        },
        forks: {
          isolate: false,
        },
      },
    })
    expect(c.poolOptions?.threads?.isolate).toBe(false)
    expect(c.poolOptions?.forks?.isolate).toBe(false)
    expect(c.isolate).toBe(true)
  })

  it('isolate config value overrides poolOptions defaults', async () => {
    const c = await config({}, {
      isolate: false,
    })
    expect(c.poolOptions?.threads?.isolate).toBe(false)
    expect(c.poolOptions?.forks?.isolate).toBe(false)
    expect(c.isolate).toBe(false)
  })

  it('if no isolation is defined in the config, fallback ot undefined', async () => {
    const c = await config({}, {})
    expect(c.poolOptions?.threads?.isolate).toBe(undefined)
    expect(c.poolOptions?.forks?.isolate).toBe(undefined)
    // set in configDefaults, so it's always defined
    expect(c.isolate).toBe(true)
  })
})

describe('correctly defines inline and noExternal flags', async () => {
  it('both are true if inline is true', async () => {
    const v = await vitest({}, {
      server: {
        deps: {
          inline: true,
        },
      },
    })
    expect(v.vitenode.options.deps?.inline).toBe(true)
    expect(v.vitenode.server.config.ssr.noExternal).toBe(true)
  })

  it('both are true if noExternal is true', async () => {
    const v = await vitest({}, {}, {
      ssr: {
        noExternal: true,
      },
    })
    expect(v.vitenode.options.deps?.inline).toBe(true)
    expect(v.vitenode.server.config.ssr.noExternal).toBe(true)
  })

  it('inline are added to noExternal', async () => {
    const regexp1 = /dep1/
    const regexp2 = /dep2/

    const v = await vitest({}, {
      server: {
        deps: {
          inline: ['dep1', 'dep2', regexp1, regexp2],
        },
      },
    })

    expect(v.vitenode.options.deps?.inline).toEqual([
      'dep1',
      'dep2',
      regexp1,
      regexp2,
      ...extraInlineDeps,
    ])
    expect(v.server.config.ssr.noExternal).toEqual([
      'dep1',
      'dep2',
      regexp1,
      regexp2,
      ...extraInlineDeps,
    ])
  })

  it('noExternal are added to inline', async () => {
    const regexp1 = /dep1/
    const regexp2 = /dep2/

    const v = await vitest({}, {}, {
      ssr: {
        noExternal: ['dep1', 'dep2', regexp1, regexp2],
      },
    })

    expect(v.vitenode.options.deps?.inline).toEqual([
      ...extraInlineDeps,
      'dep1',
      'dep2',
      regexp1,
      regexp2,
    ])
    expect(v.server.config.ssr.noExternal).toEqual([
      'dep1',
      'dep2',
      regexp1,
      regexp2,
    ])
  })

  it('noExternal and inline don\'t have duplicates', async () => {
    const regexp1 = /dep1/
    const regexp2 = /dep2/

    const v = await vitest({}, {
      server: {
        deps: {
          inline: ['dep2', regexp1, 'dep3'],
        },
      },
    }, {
      ssr: {
        noExternal: ['dep1', 'dep2', regexp1, regexp2],
      },
    })

    expect(v.vitenode.options.deps?.inline).toEqual([
      'dep2',
      regexp1,
      'dep3',
      ...extraInlineDeps,
      'dep1',
      regexp2,
    ])
    expect(v.server.config.ssr.noExternal).toEqual([
      'dep1',
      'dep2',
      regexp1,
      regexp2,
      'dep3',
    ])
  })
})

describe('correctly defines api flag', () => {
  it('CLI overrides disabling api', async () => {
    const c = await vitest({ api: false }, {
      api: {
        port: 1234,
      },
      watch: true,
    })
    expect(c.server.config.server.middlewareMode).toBe(true)
    expect(c.config.api).toEqual({
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
    expect(c.server.config.server.port).toBe(4321)
    expect(c.config.api).toEqual({
      port: 4321,
      token: expect.any(String),
    })
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
    }).rejects.toThrowError(`Inspector host cannot be a URL. Use "host:port" instead of "${url}"`)
  })
})
