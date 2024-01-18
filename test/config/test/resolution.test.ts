import type { UserConfig } from 'vitest'
import type { UserConfig as ViteUserConfig } from 'vite'
import { describe, expect, it } from 'vitest'
import { createVitest } from 'vitest/node'
import { extraInlineDeps } from 'vitest/config'

async function vitest(cliOptions: UserConfig, configValue: UserConfig = {}, viteConfig: ViteUserConfig = {}) {
  const vitest = await createVitest('test', { ...cliOptions, watch: false }, { ...viteConfig, test: configValue as any })
  return vitest
}

async function config(cliOptions: UserConfig, configValue: UserConfig = {}, viteConfig: ViteUserConfig = {}) {
  const v = await vitest(cliOptions, configValue, viteConfig)
  return v.config
}

describe('correctly defines isolated flags', async () => {
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
