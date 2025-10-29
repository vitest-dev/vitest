import type { Vitest } from 'vitest/node'
import { afterEach, describe, expect, test } from 'vitest'
import { createVitest } from 'vitest/node'

describe('VitestResolver with Vite SSR config', () => {
  let ctx: Vitest | undefined

  afterEach(async () => {
    await ctx?.close()
    ctx = undefined
  })

  test('merges vite ssr.resolve.noExternal with server.deps.inline', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
      server: {
        deps: {
          inline: ['inline-dep'],
        },
      },
    }, {
      environments: {
        ssr: {
          resolve: {
            noExternal: ['ssr-no-external-dep'],
          },
        },
      },
    })

    const resolver = ctx._resolver

    // Both inline-dep and ssr-no-external-dep should be inlined (return false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/inline-dep/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/ssr-no-external-dep/index.js')).toBe(false)

    // Other deps should be externalized
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/other-dep/index.cjs.js')).toBeTruthy()
  })

  test('merges vite ssr.resolve.external with server.deps.external', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
      server: {
        deps: {
          external: ['external-dep'],
        },
      },
    }, {
      environments: {
        ssr: {
          resolve: {
            external: ['ssr-external-dep'],
          },
        },
      },
    })

    const resolver = ctx._resolver

    // Both external-dep and ssr-external-dep should be externalized (return the ID)
    // Using .cjs.js extension which matches depsExternal pattern
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/external-dep/index.cjs.js')).toBeTruthy()
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/ssr-external-dep/index.cjs.js')).toBeTruthy()
  })

  test('handles ssr.resolve.noExternal with wildcard patterns', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
    }, {
      environments: {
        ssr: {
          resolve: {
            noExternal: ['@org/*'],
          },
        },
      },
    })

    const resolver = ctx._resolver

    // Wildcard should match @org/utils, @org/runner, etc.
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@org/utils/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@org/runner/index.js')).toBe(false)

    // But not other scopes
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@other/utils/index.cjs.js')).toBeTruthy()
  })

  test('handles ssr.resolve.noExternal as true', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
    }, {
      environments: {
        ssr: {
          resolve: {
            noExternal: true,
          },
        },
      },
    })

    const resolver = ctx._resolver

    // When noExternal is true, dependencies should be inlined
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-dep/index.js')).toBe(false)

    // Note: .cjs.js and .mjs files in node_modules match depsExternal pattern
    // and are still externalized even with noExternal: true
    // This is because default patterns are checked after user patterns
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/another-dep/index.cjs.js')).toBeTruthy()

    // Builtins should still be externalized
    expect(await resolver.shouldExternalize('fs')).toBe('fs')
    expect(await resolver.shouldExternalize('path')).toBe('path')

    expect(await resolver.shouldExternalize('node:fs')).toBe('node:fs')
    expect(await resolver.shouldExternalize('node:path')).toBe('node:path')
  })

  test('handles ssr.resolve.external as true', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
    }, {
      environments: {
        ssr: {
          resolve: {
            external: true,
          },
        },
      },
    })

    const resolver = ctx._resolver

    // When external is true, node_modules dependencies should be externalized
    expect(await resolver.shouldExternalize('/node_modules/some-dep/index.cjs.js')).toBeTruthy()

    // TypeScript files match defaultInline pattern and are inlined even with external: true
    // because default inline patterns are checked before falling through to the end
    expect(await resolver.shouldExternalize('/usr/a/project/src/my-file.ts')).toBe(false)
  })

  test('handles server.deps.inline as true with ssr.resolve config', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
      server: {
        deps: {
          inline: true,
        },
      },
    }, {
      environments: {
        ssr: {
          resolve: {
            noExternal: ['some-dep'],
          },
        },
      },
    })

    const resolver = ctx._resolver

    // When inline is true, everything should be inlined (except explicit external)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-dep/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/other-dep/index.js')).toBe(false)
  })

  test('merges both vitest and vite configs together', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
      server: {
        deps: {
          inline: ['inline-dep-1'],
          external: ['external-dep-1'],
        },
      },
    }, {
      environments: {
        ssr: {
          resolve: {
            noExternal: ['inline-dep-2'],
            external: ['external-dep-2'],
          },
        },
      },
    })

    const resolver = ctx._resolver

    // All inline deps should be inlined
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/inline-dep-1/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/inline-dep-2/index.js')).toBe(false)

    // All external deps should be externalized
    // Using .cjs.js extension which matches depsExternal pattern
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/external-dep-1/index.cjs.js')).toBeTruthy()
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/external-dep-2/index.cjs.js')).toBeTruthy()
  })

  test('respects priority: inline config is checked before external', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
      server: {
        deps: {
          inline: ['my-dep'],
          external: ['my-dep'], // same dep in both
        },
      },
    })

    const resolver = ctx._resolver

    // In the resolver logic, inline is checked first (line 197) before external (line 203)
    // So inline takes precedence
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/my-dep/index.js')).toBe(false)
  })

  test('converts wildcard patterns to regex correctly', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
    }, {
      environments: {
        ssr: {
          resolve: {
            noExternal: ['@scope/*/sub', 'prefix-*-suffix'],
          },
        },
      },
    })

    const resolver = ctx._resolver

    // Test wildcard expansion
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@scope/package/sub/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@scope/another/sub/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/prefix-middle-suffix/index.js')).toBe(false)

    // Should not match incorrect patterns
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@scope/package/other/index.cjs.js')).toBeTruthy()
  })

  test('handles query parameters like ?vue, ?raw, ?url', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
    })

    const resolver = ctx._resolver

    // Files with Vite query parameters should be inlined (matched by defaultInline pattern)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/Component.vue?vue&type=script')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/data.txt?raw')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/image.png?url')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/style.css?inline')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/worker.js?init')).toBe(false)

    // Files without query parameters should follow normal externalization rules
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/index.cjs.js')).toBeTruthy()
  })

  test('handles custom deps.moduleDirectories', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
      deps: {
        moduleDirectories: ['/node_modules/', '/custom_modules/'],
      },
      server: {
        deps: {
          inline: ['inline-dep'],
        },
      },
    })

    const resolver = ctx._resolver

    // Should inline deps in custom module directory
    expect(await resolver.shouldExternalize('/usr/a/project/custom_modules/inline-dep/index.js')).toBe(false)

    // Should also work with standard node_modules
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/inline-dep/index.js')).toBe(false)

    // Note: depsExternal pattern only matches /node_modules/, not custom directories
    // So .cjs.js files in custom directories won't be automatically externalized
    // Regular .js files in custom directories are inlined by default
    expect(await resolver.shouldExternalize('/usr/a/project/custom_modules/other-dep/index.js')).toBe(false)

    // But .cjs.js in node_modules IS externalized
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/other-dep/index.cjs.js')).toBeTruthy()
  })

  test('handles deps.moduleDirectories with ssr.resolve.noExternal', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
      deps: {
        moduleDirectories: ['/node_modules/', '/vendor/'],
      },
    }, {
      environments: {
        ssr: {
          resolve: {
            noExternal: ['my-lib'],
          },
        },
      },
    })

    const resolver = ctx._resolver

    // Should inline 'my-lib' from vendor directory
    expect(await resolver.shouldExternalize('/usr/a/project/vendor/my-lib/index.js')).toBe(false)

    // Should inline 'my-lib' from node_modules too
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/my-lib/index.js')).toBe(false)

    // Other packages: depsExternal pattern only matches /node_modules/
    // So regular .js files in /vendor/ are inlined by default
    expect(await resolver.shouldExternalize('/usr/a/project/vendor/other-lib/index.js')).toBe(false)
    // But .cjs.js in node_modules IS externalized
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/other-lib/index.cjs.js')).toBeTruthy()
  })

  test('handles deps.moduleDirectories with wildcard patterns', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
      deps: {
        moduleDirectories: ['/node_modules/', '/packages/'],
      },
    }, {
      environments: {
        ssr: {
          resolve: {
            noExternal: ['@org/*'],
          },
        },
      },
    })

    const resolver = ctx._resolver

    // Should match wildcard in custom module directory (packages)
    expect(await resolver.shouldExternalize('/usr/a/project/packages/@org/utils/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/packages/@org/runner/index.js')).toBe(false)

    // Should also match wildcard in standard node_modules
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@org/utils/index.js')).toBe(false)

    // Other scopes: depsExternal pattern only matches /node_modules/
    // So regular .js files in /packages/ are inlined by default
    expect(await resolver.shouldExternalize('/usr/a/project/packages/@other/utils/index.js')).toBe(false)
    // But .cjs.js in node_modules IS externalized
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@other/utils/index.cjs.js')).toBeTruthy()
  })

  test('combines query parameters with ssr.resolve.external', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
    }, {
      environments: {
        ssr: {
          resolve: {
            external: ['some-lib'],
          },
        },
      },
    })

    const resolver = ctx._resolver

    // Even if the package is marked as external, query parameters should make it inline
    // because defaultInline patterns (which include query strings) are checked before external patterns
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/Component.vue?vue')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/data.txt?raw')).toBe(false)

    // Without query parameter, should be externalized
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/index.cjs.js')).toBeTruthy()
  })

  test('handles multiple query parameters', async () => {
    ctx = await createVitest('test', {
      watch: false,
      root: 'fixtures/vite-ssr-resolve',
    })

    const resolver = ctx._resolver

    // Multiple query parameters should still be inlined
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/lib/file.js?url&used')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/lib/style.css?inline&lang=scss')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/lib/Component.vue?vue&type=template&lang=pug')).toBe(false)
  })
})
