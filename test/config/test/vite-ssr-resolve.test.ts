import type { Plugin } from 'vite'
import type { CliOptions } from 'vitest/node'
import { join } from 'pathe'
import { describe, expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

const nodeModulesDir = join(import.meta.dirname, '../../node_modules')

describe.each(['deprecated', 'environment'] as const)('VitestResolver with Vite SSR config in %s style', (style) => {
  test('merges vite ssr.resolve.noExternal with server.deps.inline', async () => {
    const resolver = await getResolver(style, {
      server: {
        deps: {
          inline: ['inline-dep'],
        },
      },
    }, {
      noExternal: ['ssr-no-external-dep'],
    })

    expect(resolver.options.inline).toEqual(['inline-dep', 'ssr-no-external-dep'])

    // Both inline-dep and ssr-no-external-dep should be inlined (return false)
    expect(await resolver.shouldExternalize(join(nodeModulesDir, 'inline-dep/index.js'))).toBe(false)
    expect(await resolver.shouldExternalize(join(nodeModulesDir, 'ssr-no-external-dep/index.js'))).toBe(false)

    // Other deps should be externalized
    expect(await resolver.shouldExternalize(join(nodeModulesDir, 'other-dep/index.js'))).toBeTruthy()

    // hard-coded pattern for external
    expect(await resolver.shouldExternalize('/usr/a/non-existing/node_modules/non-existing/index.cjs.js')).toBeTruthy()
    expect(await resolver.shouldExternalize('/usr/a/non-existing/node_modules/non-existing/index.mjs')).toBeTruthy()

    // non-existing files are inlined
    expect(await resolver.shouldExternalize('/usr/a/non-existing/node_modules/non-existing/index.js')).toBeUndefined()
  })

  test('merges vite ssr.resolve.external with server.deps.external', async () => {
    const resolver = await getResolver(style, {
      server: {
        deps: {
          external: ['external-dep'],
        },
      },
    }, {
      external: ['ssr-external-dep'],
    })

    expect(resolver.options.external).toEqual(['external-dep', 'ssr-external-dep'])

    // Both external-dep and ssr-external-dep should be externalized (return the ID)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/external-dep/index.js')).toBeTruthy()
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/ssr-external-dep/index.js')).toBeTruthy()
  })

  test('handles ssr.resolve.noExternal with wildcard patterns', async () => {
    const resolver = await getResolver(style, {}, {
      noExternal: ['@org/*'],
    })

    // Wildcard should match @org/utils, @org/runner, etc.
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@org/utils/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@org/runner/index.js')).toBe(false)

    // But not other scopes
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@other/utils/index.cjs.js')).toBeTruthy()
  })

  test('handles ssr.resolve.noExternal as true', async () => {
    const resolver = await getResolver(style, {}, {
      noExternal: true,
    })

    // When noExternal is true, dependencies should be inlined
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-dep/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/another-dep/index.cjs.js')).toBe(false)

    // Builtins should still be externalized
    expect(await resolver.shouldExternalize('fs')).toBe('fs')
    expect(await resolver.shouldExternalize('path')).toBe('path')

    expect(await resolver.shouldExternalize('node:fs')).toBe('node:fs')
    expect(await resolver.shouldExternalize('node:path')).toBe('node:path')
  })

  test('handles ssr.resolve.external as true', async () => {
    const resolver = await getResolver(style, {}, {
      external: true,
    })

    // When external is true, node_modules dependencies should be externalized
    expect(await resolver.shouldExternalize('/node_modules/some-dep/index.cjs.js')).toBeTruthy()

    // TypeScript files match defaultInline pattern and are inlined even with external: true
    // because default inline patterns are checked before falling through to the end
    expect(await resolver.shouldExternalize('/usr/a/project/src/my-file.ts')).toBe(false)
  })

  test('handles server.deps.inline as true with ssr.resolve config', async () => {
    const resolver = await getResolver(style, {
      server: {
        deps: {
          inline: true,
        },
      },
    }, {
      noExternal: ['some-dep'],
    })

    // When inline is true, everything should be inlined (except explicit external)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-dep/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/other-dep/index.js')).toBe(false)
  })

  test('merges both vitest and vite configs together', async () => {
    const resolver = await getResolver(style, {
      server: {
        deps: {
          inline: ['inline-dep-1'],
          external: ['external-dep-1'],
        },
      },
    }, {
      noExternal: ['inline-dep-2'],
      external: ['external-dep-2'],
    })

    // All inline deps should be inlined
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/inline-dep-1/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/inline-dep-2/index.js')).toBe(false)

    // All external deps should be externalized
    // Using .cjs.js extension which matches depsExternal pattern
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/external-dep-1/index.cjs.js')).toBeTruthy()
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/external-dep-2/index.cjs.js')).toBeTruthy()
  })

  test('respects priority: inline config is checked before external', async () => {
    const resolver = await getResolver(style, {
      server: {
        deps: {
          inline: ['my-dep'],
          external: ['my-dep'], // same dep in both
        },
      },
    }, {})

    // In the resolver logic, inline is checked first (line 197) before external (line 203)
    // So inline takes precedence
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/my-dep/index.js')).toBe(false)
  })

  test('converts wildcard patterns to regex correctly', async () => {
    const resolver = await getResolver(style, {}, {
      noExternal: ['@scope/*/sub', 'prefix-*-suffix'],
    })

    // Test wildcard expansion
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@scope/package/sub/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@scope/another/sub/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/prefix-middle-suffix/index.js')).toBe(false)

    // Should not match incorrect patterns
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@scope/package/other/index.cjs.js')).toBeTruthy()
  })

  test('handles query parameters like ?vue, ?raw, ?url', async () => {
    const resolver = await getResolver(style, {}, {})

    // Files with Vite query parameters should be inlined (matched by defaultInline pattern)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/Component.vue?vue&type=script')).toBeUndefined()
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/data.txt?raw')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/image.png?url')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/style.css?inline')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/worker.js?init')).toBe(false)

    // Files without query parameters should follow normal externalization rules
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/index.cjs.js')).toBeTruthy()
  })

  test('handles custom deps.moduleDirectories', async () => {
    const resolver = await getResolver(style, {
      deps: {
        moduleDirectories: ['/node_modules/', '/custom_modules/'],
      },
      server: {
        deps: {
          inline: ['inline-dep'],
        },
      },
    }, {})

    // Should inline deps in custom module directory
    expect(await resolver.shouldExternalize('/usr/a/project/custom_modules/inline-dep/index.js')).toBe(false)

    // Should also work with standard node_modules
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/inline-dep/index.js')).toBe(false)

    // Note: depsExternal pattern only matches /node_modules/, not custom directories
    // So .cjs.js files in custom directories won't be automatically externalized
    // Regular .js files in custom directories are inlined by default
    expect(await resolver.shouldExternalize('/usr/a/project/custom_modules/other-dep/index.js')).toBeUndefined()

    // But .cjs.js in node_modules IS externalized
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/other-dep/index.cjs.js')).toBeTruthy()
  })

  test('handles deps.moduleDirectories with ssr.resolve.noExternal', async () => {
    const resolver = await getResolver(style, {
      deps: {
        moduleDirectories: ['/node_modules/', '/vendor/'],
      },
    }, {
      noExternal: ['my-lib'],
    })

    // Should inline 'my-lib' from vendor directory
    expect(await resolver.shouldExternalize('/usr/a/project/vendor/my-lib/index.js')).toBe(false)

    // Should inline 'my-lib' from node_modules too
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/my-lib/index.js')).toBe(false)

    // Other packages: depsExternal pattern only matches /node_modules/
    // So regular .js files in /vendor/ are inlined by default
    expect(await resolver.shouldExternalize('/usr/a/project/vendor/other-lib/index.js')).toBeUndefined()
    // But .cjs.js in node_modules IS externalized
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/other-lib/index.cjs.js')).toBeTruthy()
  })

  test('handles deps.moduleDirectories with wildcard patterns', async () => {
    const resolver = await getResolver(style, {
      deps: {
        moduleDirectories: ['/node_modules/', '/packages/'],
      },
    }, {
      noExternal: ['@org/*'],
    })

    // Should match wildcard in custom module directory (packages)
    expect(await resolver.shouldExternalize('/usr/a/project/packages/@org/utils/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/packages/@org/runner/index.js')).toBe(false)

    // Should also match wildcard in standard node_modules
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@org/utils/index.js')).toBe(false)

    // Other scopes: depsExternal pattern only matches /node_modules/
    // So regular .js files in /packages/ are inlined by default
    expect(await resolver.shouldExternalize('/usr/a/project/packages/@other/utils/index.js')).toBeUndefined()
    // But .cjs.js in node_modules IS externalized
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@other/utils/index.cjs.js')).toBeTruthy()
  })

  test('combines query parameters with ssr.resolve.external', async () => {
    const resolver = await getResolver(style, {}, {
      external: ['some-lib'],
    })

    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/Component.vue?vue')).toBeTruthy()
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/data.txt?raw')).toBeTruthy()

    // Without query parameter, should be externalized
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/some-lib/index.cjs.js')).toBeTruthy()
  })

  test('handles multiple query parameters', async () => {
    const resolver = await getResolver(style, {}, {})

    // Multiple query parameters should still be inlined
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/lib/file.js?url&used')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/lib/style.css?inline&lang=scss')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/lib/Component.vue?vue&type=template&lang=pug')).toBeUndefined()
  })

  // Test that plugins can set noExternal/external in configEnvironment hook
  // This simulates frameworks like Astro that add their packages via configEnvironment
  test('collects noExternal/external from plugin configEnvironment', async () => {
    const plugin: Plugin = {
      name: 'test-plugin',
      configEnvironment(name) {
        if (name === 'ssr') {
          return {
            resolve: {
              noExternal: ['plugin-inline-dep', '@framework/*'],
              external: ['plugin-external-dep'],
            },
          }
        }
      },
    }

    // Also test merging with user config
    const resolver = await getResolver(style, {}, {
      noExternal: ['user-inline-dep'],
      external: ['user-external-dep'],
    }, [plugin])

    // user config noExternal: should be inlined
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/user-inline-dep/index.js')).toBe(false)

    // plugin noExternal: should be inlined
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/plugin-inline-dep/index.js')).toBe(false)

    // plugin noExternal with wildcard: should be inlined
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@framework/core/index.js')).toBe(false)
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@framework/utils/index.js')).toBe(false)

    // user config external: should be externalized
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/user-external-dep/index.js')).toBeTruthy()

    // plugin external: should be externalized
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/plugin-external-dep/index.js')).toBeTruthy()

    // other deps: default behavior
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/other-dep/index.cjs.js')).toBeTruthy()
    expect(await resolver.shouldExternalize('/usr/a/project/node_modules/@other/lib/index.cjs.js')).toBeTruthy()
  })
})

async function getResolver(
  style: 'environment' | 'deprecated',
  options: CliOptions,
  externalOptions: {
    external?: true | string[]
    noExternal?: true | string | RegExp | (string | RegExp)[]
  },
  plugins: Plugin[] = [],
) {
  const ctx = await createVitest('test', {
    watch: false,
  }, style === 'environment'
    ? {
        plugins,
        environments: {
          ssr: {
            resolve: externalOptions,
          },
        },
        test: options,
      }
    : {
        plugins,
        ssr: externalOptions,
        test: options,
      })
  onTestFinished(() => ctx.close())
  return ctx._resolver
}
