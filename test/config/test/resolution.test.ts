import type { UserConfig } from 'vitest'
import { describe, expect, it } from 'vitest'
import { createVitest } from 'vitest/node'

async function config(cliOptions: UserConfig, configValue: UserConfig = {}) {
  const vitest = await createVitest('test', { ...cliOptions, watch: false }, { test: configValue })
  return vitest.config
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
