import type { afterAll, beforeAll, ExpectStatic, expectTypeOf as ExpectTypeOfFn, SuiteAPI, TestAPI } from 'vitest'
import type { ViteUserConfig } from 'vitest/config'
import type { TestSpecification, TestUserConfig } from 'vitest/node'
import type { TestFsStructure } from '../../test-utils'
import { beforeEach, expect, test } from 'vitest'
import { rolldownVersion } from 'vitest/node'
import { runInlineTests, stripIndent } from '../../test-utils'

// "it" and "mergeTests" are used inside subtests, we can't "import" them because vitest will inject __vite_ssr_import__
declare const it: TestAPI
declare const mergeTests: typeof import('vitest')['mergeTests']

if (rolldownVersion) {
  beforeEach(({ skip }) => {
    // TODO: remove skip when we only test against rolldown
    // oxc has a different output of inlined functions in "runInlineTests"
    skip()
  })
}

// Invalid mergeTests() input validation is covered by Core unit tests.

test('mergeTests with single arg passes through without validation', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.ts': `
      import { test, mergeTests } from 'vitest'
      const t = test.extend({ a: 1 })
      const result = mergeTests(t)
      result('single arg works', ({ a }) => {})
    `,
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
})

// Circular dependency detection occurs during fixture resolution at runtime
// and is verified in the 'detects circular dependencies at runtime' test below.

// Fixture setup and teardown sequence

test('mergeTests merges async fixtures with setup and teardown', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend<{ db: string }>({
      db: async ({}, use) => {
        log('db setup')
        await use('db-connection')
        log('db teardown')
      },
    })
    const t2 = it.extend<{ server: string }>({
      server: async ({}, use) => {
        log('server setup')
        await use('server-instance')
        log('server teardown')
      },
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('uses both async fixtures', ({ db, server }) => {
        expect(db).toBe('db-connection')
        expect(server).toBe('server-instance')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | db setup | uses both async fixtures
    >> fixture | server setup | uses both async fixtures
    >> fixture | server teardown | uses both async fixtures
    >> fixture | db teardown | uses both async fixtures"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > uses both async fixtures <time>"`)
})

// Scoped fixture behavior in merged tests

test('mergeTests merges file-scoped fixtures (init once, teardown once)', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend<{ fileFix: string }>({
      fileFix: [
        async ({}, use) => {
          log('fileFix setup')
          await use('file-value')
          log('fileFix teardown')
        },
        { scope: 'file' },
      ],
    })
    const t2 = it.extend<{ testFix: string }>({
      testFix: async ({}, use) => {
        log('testFix setup')
        await use('test-value')
        log('testFix teardown')
      },
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('test1', ({ fileFix, testFix }) => {
        expect(fileFix).toBe('file-value')
        expect(testFix).toBe('test-value')
      })
      extendedTest('test2', ({ fileFix, testFix }) => {
        expect(fileFix).toBe('file-value')
        expect(testFix).toBe('test-value')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | fileFix setup | test1
    >> fixture | testFix setup | test1
    >> fixture | testFix teardown | test1
    >> fixture | testFix setup | test2
    >> fixture | testFix teardown | test2
    >> fixture | fileFix teardown | test2"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > test1 <time>
     ✓ basic.test.ts > test2 <time>"
  `)
})

test('mergeTests merges worker-scoped fixtures', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend<{ workerFix: string }>({
      workerFix: [
        async ({}, use) => {
          log('workerFix setup')
          await use('worker-value')
          log('workerFix teardown')
        },
        { scope: 'worker' },
      ],
    })
    const t2 = it.extend<{ localFix: string }>({
      localFix: async ({}, use) => {
        log('localFix setup')
        await use('local-value')
        log('localFix teardown')
      },
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('uses worker and local', ({ workerFix, localFix }) => {
        expect(workerFix).toBe('worker-value')
        expect(localFix).toBe('local-value')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | workerFix setup | uses worker and local
    >> fixture | localFix setup | uses worker and local
    >> fixture | localFix teardown | uses worker and local
    >> fixture | workerFix teardown | uses worker and local"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > uses worker and local <time>"`)
})

// Scope conflicts are verified in Core unit tests.

test('mergeTests throws when a file-scoped fixture depends on a dependency that becomes test-scoped after merge', async () => {
  const { stderr } = await runMergeFixtureTests(() => {
    // Ensures scope conflicts are detected even when the conflicting fixtures
    // originate from different merged test instances.
    const t1 = it.extend<{ base: string; derived: string }>({
      base: [async ({}, use: any) => use('file-base'), { scope: 'file' }] as any,
      derived: [async ({ base }: any, use: any) => use(`derived-${base}`), { scope: 'file' }] as any,
    })
    // base is overridden with mismatching scope in t2
    const t2 = it.extend<{ base: string }>({
      base: [async ({}, use: any) => use('test-base'), { scope: 'test' }] as any,
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest('should fail', () => {})
    },
  })

  expect(stderr).toMatch(/Fixture "base" defined with conflicting scopes: "file" vs "test"/)
})

// Ensure static values correctly override function fixtures without leaking metadata
test('mergeTests same fixture name with incompatible types still follows last-wins semantics', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ foo: string }>({
      foo: async ({}, use) => use('str'),
    })
    const t2 = it.extend<{ foo: number }>({
      foo: 123,
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect, expectTypeOf }) => {
      extendedTest('last wins regardless of shape', ({ foo }) => {
        // t2's static `123` wins over t1's async function fixture.
        // No stale `deps` or `value` should leak from t1's TestFixtureItem.
        expect(foo).toBe(123)
        expectTypeOf(foo).toEqualTypeOf<number>()
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > last wins regardless of shape <time>"`)
})

// .override() semantics on merged tests

test('mergeTests override works on merged test with nested describe', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ a: number }>({ a: 1 })
    const t2 = it.extend<{ b: number }>({ b: 2 })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect, describe }: any) => {
      extendedTest.override({ a: 10 })

      extendedTest('override applied', ({ a, b }: any) => {
        expect(a).toBe(10)
        expect(b).toBe(2)
      })

      describe('nested', () => {
        extendedTest.override({ b: 20 })
        extendedTest('nested override', ({ a, b }: any) => {
          expect(a).toBe(10)
          expect(b).toBe(20)
        })
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > override applied <time>
     ✓ basic.test.ts > nested > nested override <time>"
  `)
})

// Lifecycle ordering verification

test('mergeTests init and teardown execute per test', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend<{ a: string }>({
      a: async ({}, use) => {
        log('a setup')
        await use('a')
        log('a teardown')
      },
    })
    const t2 = it.extend<{ b: string }>({
      b: async ({}, use) => {
        log('b setup')
        await use('b')
        log('b teardown')
      },
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest }: any) => {
      extendedTest('test1', ({ a: _a, b: _b }: any) => {})
      extendedTest('test2', ({ a: _a, b: _b }: any) => {})
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | a setup | test1
    >> fixture | b setup | test1
    >> fixture | b teardown | test1
    >> fixture | a teardown | test1
    >> fixture | a setup | test2
    >> fixture | b setup | test2
    >> fixture | b teardown | test2
    >> fixture | a teardown | test2"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > test1 <time>
     ✓ basic.test.ts > test2 <time>"
  `)
})

// Structural merge correctness is validated in the Core test suite.

// Linear chain resolution is verified in the 'complex linear chain' test below.

test('mergeTests fixture from t2 can depend on fixture provided by t1', async () => {
  // Fixtures originating from different merge inputs should be able
  // to depend on each other after merging.
  const { stderr, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend<{ baseUrl: string }>({
      baseUrl: async ({}, use) => {
        log('baseUrl setup')
        await use('http://localhost:3000')
      },
    })
    const t2 = t1.extend<{ fullUrl: string }>({
      fullUrl: async ({ baseUrl }, use) => {
        await use(`${baseUrl}/api`)
      },
    })
    const t3 = it.extend<{ token: string }>({ token: 'secret' })
    return mergeTests(t2, t3)
  }, {
    'basic.test.ts': ({ extendedTest, expect }: any) => {
      extendedTest('cross-merge dep resolves', ({ baseUrl, fullUrl, token }: any) => {
        expect(baseUrl).toBe('http://localhost:3000')
        expect(fullUrl).toBe('http://localhost:3000/api')
        expect(token).toBe('secret')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > cross-merge dep resolves <time>"`)
})

test('mergeTests same-named fixture: dependent fixture uses the winning override', async () => {
  // If t1 defines `base` and `derived`, and t2 overrides `base`,
  // `derived` must resolve against the overridden fixture implementation.
  // Answer: the overriding fixture wins, so `derived` should see t2's `base`.
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ base: string; derived: string }>({
      base: async ({}, use) => use('t1-base'),
      derived: async ({ base }, use) => use(`derived-from-${base}`),
    })
    const t2 = it.extend<{ base: string }>({
      base: async ({}, use) => use('t2-base'),
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }: any) => {
      extendedTest('derived sees t2 base', ({ base, derived }: any) => {
        expect(base).toBe('t2-base')
        // Vitest resolves derived using the live map, seeing the override from t2
        expect(derived).toBe('derived-from-t2-base')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > derived sees t2 base <time>"`)
})

// Structural dependency graph stress tests

// Dependents must resolve the winning fixture implementation dynamically
// rather than keeping a stale reference to the overridden fixture.
test('mergeTests both-side dependents remap to the winning base override', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ base: string; a: string }>({
      base: async ({}, use) => use('base-v1'),
      a: async ({ base }, use) => use(`a-from-${base}`),
    })
    const t2 = it.extend<{ base: string; b: string }>({
      base: async ({}, use) => use('base-v2'),
      b: async ({ base }, use) => use(`b-from-${base}`),
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }: any) => {
      extendedTest('both sides see base-v2', ({ a, b }: any) => {
        // Dependents must resolve the surrogate base via live lookup
        expect(a).toBe('a-from-base-v2')
        expect(b).toBe('b-from-base-v2')
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > both sides see base-v2 <time>"`)
})

test('mergeTests ensures shared dependency executes only once (diamond deduplication)', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const base = it.extend<{ base: string }>({
      base: async ({}, use) => {
        log('base-init')
        await use('base')
        log('base-teardown')
      },
    })
    const t1 = base.extend({ a: async ({ base }, use) => use(`a-${base}`) })
    const t2 = base.extend({ b: async ({ base }, use) => use(`b-${base}`) })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('diamond check', ({ a, b }) => {
        expect(a).toBe('a-base')
        expect(b).toBe('b-base')
      })
    },
  })
  expect(stderr).toBe('')
  // Ensure base-init appears exactly once
  const initCount = (fixtures.match(/base-init/g) || []).length
  expect(initCount).toBe(1)
  expect(tests).toContain('✓ basic.test.ts > diamond check')
})

test('mergeTests ensures losing dependency branch does not execute (override pruning)', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend({
      shared: async ({ depA }: any, use: any) => use(`t1-${depA}`),
      depA: async ({}, use: any) => {
        log('depA-exec')
        await use('A')
      },
    })
    const t2 = it.extend({
      shared: async ({ depB }: any, use: any) => use(`t2-${depB}`),
      depB: async ({}, use: any) => {
        log('depB-exec')
        await use('B')
      },
    })
    // t2 wins, so depA should NOT execute
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('pruning check', ({ shared }: any) => {
        expect(shared).toBe('t2-B')
      })
    },
  })
  expect(stderr).toBe('')
  expect(fixtures).not.toContain('depA-exec')
  expect(fixtures).toContain('depB-exec')
  expect(tests).toContain('✓ basic.test.ts > pruning check')
})

test('mergeTests ensures teardown runs for siblings after setup failure', async () => {
  const { fixtures, stdout } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend({
      a: async ({}, use) => {
        log('a-setup')
        await use('a')
        log('a-teardown')
      },
    })
    const t2 = it.extend({
      b: async ({}, _use) => {
        log('b-setup-fail')
        throw new Error('b-failed')
      },
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect: _expect }) => {
      extendedTest('cleanup check', ({ a: _a, b: _b }: any) => {
        // This test should fail because of 'b' setup failure
      })
    },
  })
  // a-setup should have run, and then a-teardown should run after b fails
  expect(fixtures).toContain('a-setup')
  expect(fixtures).toContain('a-teardown')
  // Full stdout check for failure mark
  expect(stdout).toContain('× basic.test.ts > cleanup check')
})

test('mergeTests deduplicates same-named worker fixtures across merges', async () => {
  const { fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend({
      worker: [async ({}, use: any) => {
        log('worker-init-t1')
        await use('worker')
      }, { scope: 'worker' }] as any,
    })
    const t2 = it.extend({
      worker: [async ({}, use: any) => {
        log('worker-init-t2')
        await use('worker')
      }, { scope: 'worker' }] as any,
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('worker check', ({ worker }) => {
        expect(worker).toBe('worker')
      })
    },
  })
  // t2 should win, and it should run exactly once
  expect(fixtures).toContain('worker-init-t2')
  expect(fixtures).not.toContain('worker-init-t1')
  const initCount = (fixtures.match(/worker-init-t2/g) || []).length
  expect(initCount).toBe(1)
  expect(tests).toContain('✓ basic.test.ts > worker check')
})

// A diamond dependency graph is valid and must not be mistaken for a cycle.
// This verifies that the dependency tracking stack is cleared correctly.
test('mergeTests diamond dependency does not falsely trigger cycle detection', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const base = it.extend<{ base: string }>({
      base: async ({}, use) => use('base-val'),
    })
    const t1 = base.extend<{ a: string }>({
      a: async ({ base }, use) => use(`a-from-${base}`),
    })
    const t2 = t1.extend<{ b: string; derived: string }>({
      b: async ({ base }, use) => use(`b-from-${base}`),
      derived: async ({ a, b }, use) => use(`${a}+${b}`),
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }: any) => {
      extendedTest('diamond resolves without cycle error', ({ derived }: any) => {
        // base is reachable via two separate paths; depSet.clear() prevents false cycle detection
        expect(derived).toBe('a-from-base-val+b-from-base-val')
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > diamond resolves without cycle error <time>"`)
})

// File-scoped fixtures should be cached by identity to avoid redundant init during self-merge
test('mergeTests self-merge file-scoped fixture initialises exactly once per file', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t = it.extend<{ fileFix: string }>({
      fileFix: [
        async ({}, use) => {
          log('fileFix init')
          await use('file-val')
          log('fileFix teardown')
        },
        { scope: 'file' },
      ],
    })
    return mergeTests(t, t)
  }, {
    'basic.test.ts': ({ extendedTest, expect }: any) => {
      extendedTest('test1', ({ fileFix }: any) => expect(fileFix).toBe('file-val'))
      extendedTest('test2', ({ fileFix }: any) => expect(fileFix).toBe('file-val'))
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  // File-scoped fixtures are cached by identity. Self-merging the same test
  // must not cause duplicate initialization.
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | fileFix init | test1
    >> fixture | fileFix teardown | test2"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > test1 <time>
     ✓ basic.test.ts > test2 <time>"
  `)
})

// Multi-level inheritance chain resolution
test('mergeTests three-way merge resolves full dep chain in order', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend<{ base: string }>({
      base: async ({}, use) => {
        log('base setup')
        await use('base-val')
        log('base teardown')
      },
    })
    const t2 = t1.extend<{ mid: string }>({
      mid: async ({ base }, use) => {
        log('mid setup')
        await use(`mid(${base})`)
        log('mid teardown')
      },
    })
    const t3 = t2.extend<{ top: string }>({
      top: async ({ mid }, use) => {
        log('top setup')
        await use(`top(${mid})`)
        log('top teardown')
      },
    })
    // verify mergeTests handles deep chains from different TestFixtures instances
    return mergeTests(t1, mergeTests(t2, t3))
  }, {
    'basic.test.ts': ({ extendedTest, expect }: any) => {
      extendedTest('full chain resolves', ({ base, mid, top }: any) => {
        expect(base).toBe('base-val')
        expect(mid).toBe('mid(base-val)')
        expect(top).toBe('top(mid(base-val))')
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | base setup | full chain resolves
    >> fixture | mid setup | full chain resolves
    >> fixture | top setup | full chain resolves
    >> fixture | top teardown | full chain resolves
    >> fixture | mid teardown | full chain resolves
    >> fixture | base teardown | full chain resolves"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > full chain resolves <time>"`)
})

// --- Variadic merge (3+ tests) ---

test('mergeTests variadic — later test overrides same-named fixture', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ shared: string }>({ shared: 'first' })
    const t2 = it.extend<{ shared: string }>({ shared: 'second' })
    const t3 = it.extend<{ shared: string }>({ shared: 'third' })
    return mergeTests(t1, t2, t3)
  }, {
    'basic.test.ts': ({ extendedTest, expect }: any) => {
      extendedTest('last wins', ({ shared }: any) => {
        expect(shared).toBe('third')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > last wins <time>"`)
})

// --- Injected fixtures ---

test('mergeTests injected fixtures use fallback when no provider', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ injectedVal: string }>({
      injectedVal: ['fallback', { injected: true }],
    })
    const t2 = it.extend<{ b: number }>({ b: 42 })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('injected uses fallback', ({ injectedVal, b }) => {
        expect(injectedVal).toBe('fallback')
        expect(b).toBe(42)
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > injected uses fallback <time>"`)
})

test('mergeTests override works on injected fixture', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ injVal: string }>({
      injVal: ['default', { injected: true }],
    })
    const t2 = it.extend<{ other: number }>({ other: 5 })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest.override({ injVal: 'overridden' })
      extendedTest('override injected', ({ injVal, other }) => {
        expect(injVal).toBe('overridden')
        expect(other).toBe(5)
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > override injected <time>"`)
})

// --- Self merge / idempotency ---

test('mergeTests(t, t) works without duplication', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t = it.extend<{ a: number }>({ a: 42 })
    return mergeTests(t, t)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('self merge resolves correctly', ({ a }) => {
        expect(a).toBe(42)
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > self merge resolves correctly <time>"`)
})

test('mergeTests(t, t) with async fixture does not double setup/teardown', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t = it.extend<{ val: string }>({
      val: async ({}, use) => {
        log('val setup')
        await use('hello')
        log('val teardown')
      },
    })
    return mergeTests(t, t)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('no double setup', ({ val }) => {
        expect(val).toBe('hello')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | val setup | no double setup
    >> fixture | val teardown | no double setup"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > no double setup <time>"`)
})

// --- Deep inheritance / extend graph ---

test('mergeTests base → child → grandchild merged with sibling from same base', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const base = it.extend<{ base: string }>({ base: 'base-val' })
    const child = base.extend<{ child: string }>({ child: 'child-val' })
    const grandchild = child.extend<{ grandchild: string }>({ grandchild: 'grandchild-val' })
    const sibling = base.extend<{ sibling: string }>({ sibling: 'sibling-val' })
    return mergeTests(grandchild, sibling)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('all levels resolve', ({ base, child, grandchild, sibling }) => {
        expect(base).toBe('base-val')
        expect(child).toBe('child-val')
        expect(grandchild).toBe('grandchild-val')
        expect(sibling).toBe('sibling-val')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > all levels resolve <time>"`)
})

test('mergeTests merge already-merged tests', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ a: number }>({ a: 1 })
    const t2 = it.extend<{ b: number }>({ b: 2 })
    const merged1 = mergeTests(t1, t2)
    const t3 = it.extend<{ c: number }>({ c: 3 })
    const t4 = it.extend<{ d: number }>({ d: 4 })
    const merged2 = mergeTests(t3, t4)
    return mergeTests(merged1, merged2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('double merge resolves all', ({ a, b, c, d }) => {
        expect(a).toBe(1)
        expect(b).toBe(2)
        expect(c).toBe(3)
        expect(d).toBe(4)
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > double merge resolves all <time>"`)
})

// Mixed fixture type support

test('mergeTests merges file-scoped + async + static + injected in one', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const tFile = it.extend<{ fileFix: string }>({
      fileFix: [
        async ({}, use) => {
          log('fileFix setup')
          await use('file-value')
          log('fileFix teardown')
        },
        { scope: 'file' },
      ],
    })
    const tAsync = it.extend<{ asyncFix: string }>({
      asyncFix: async ({}, use) => {
        log('asyncFix setup')
        await use('async-value')
        log('asyncFix teardown')
      },
    })
    const tStatic = it.extend<{ staticFix: number }>({ staticFix: 99 })
    const tInjected = it.extend<{ injFix: string }>({
      injFix: ['inj-fallback', { injected: true }],
    })
    return mergeTests(tFile, tAsync, tStatic, tInjected)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('all mixed types resolve', ({ fileFix, asyncFix, staticFix, injFix }) => {
        expect(fileFix).toBe('file-value')
        expect(asyncFix).toBe('async-value')
        expect(staticFix).toBe(99)
        expect(injFix).toBe('inj-fallback')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | fileFix setup | all mixed types resolve
    >> fixture | asyncFix setup | all mixed types resolve
    >> fixture | asyncFix teardown | all mixed types resolve
    >> fixture | fileFix teardown | all mixed types resolve"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > all mixed types resolve <time>"`)
})

test('mergeTests fixtures work with beforeAll/afterAll hooks', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend<{ db: string }>({
      db: async ({}, use) => {
        log('db setup')
        await use('db-conn')
        log('db teardown')
      },
    })
    const t2 = it.extend<{ cache: string }>({
      cache: async ({}, use) => {
        log('cache setup')
        await use('cache-conn')
        log('cache teardown')
      },
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect, beforeAll, afterAll }) => {
      beforeAll(() => {
        console.log('>> fixture | hook beforeAll')
      })

      afterAll(() => {
        console.log('>> fixture | hook afterAll')
      })

      extendedTest('fixtures work alongside hooks', ({ db, cache }) => {
        expect(db).toBe('db-conn')
        expect(cache).toBe('cache-conn')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | hook beforeAll
    >> fixture | db setup | fixtures work alongside hooks
    >> fixture | cache setup | fixtures work alongside hooks
    >> fixture | cache teardown | fixtures work alongside hooks
    >> fixture | db teardown | fixtures work alongside hooks
    >> fixture | hook afterAll"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > fixtures work alongside hooks <time>"`)
})

// Cross-file isolation

test('mergeTests fixtures work across multiple test files', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend<{ shared: string }>({
      shared: async ({}, use) => {
        log('shared setup')
        await use('shared-val')
        log('shared teardown')
      },
    })
    const t2 = it.extend<{ extra: number }>({ extra: 42 })
    return mergeTests(t1, t2)
  }, {
    '1-basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('file 1 uses merged fixtures', ({ shared, extra }) => {
        expect(shared).toBe('shared-val')
        expect(extra).toBe(42)
      })
    },
    '2-basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('file 2 uses merged fixtures', ({ shared, extra }) => {
        expect(shared).toBe('shared-val')
        expect(extra).toBe(42)
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | shared setup | file 1 uses merged fixtures
    >> fixture | shared teardown | file 1 uses merged fixtures
    >> fixture | shared setup | file 2 uses merged fixtures
    >> fixture | shared teardown | file 2 uses merged fixtures"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ 1-basic.test.ts > file 1 uses merged fixtures <time>
     ✓ 2-basic.test.ts > file 2 uses merged fixtures <time>"
  `)
})

test('mergeTests file-scoped fixture inits once per file across multiple files', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend<{ fileFix: string }>({
      fileFix: [
        async ({}, use) => {
          log('fileFix setup')
          await use('file-val')
          log('fileFix teardown')
        },
        { scope: 'file' },
      ],
    })
    const t2 = it.extend<{ local: number }>({ local: 1 })
    return mergeTests(t1, t2)
  }, {
    '1-basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('test1', ({ fileFix }) => {
        expect(fileFix).toBe('file-val')
      })
      extendedTest('test2', ({ fileFix }) => {
        expect(fileFix).toBe('file-val')
      })
    },
    '2-basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('test3', ({ fileFix }) => {
        expect(fileFix).toBe('file-val')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | fileFix setup | test1
    >> fixture | fileFix teardown | test2
    >> fixture | fileFix setup | test3
    >> fixture | fileFix teardown | test3"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ 1-basic.test.ts > test1 <time>
     ✓ 1-basic.test.ts > test2 <time>
     ✓ 2-basic.test.ts > test3 <time>"
  `)
})

// Cross-merge dependency resolution is already verified in 'fixture from t2 can depend on t1 fixture' above.

test('mergeTests throws on conflicting scopes in CLI', async () => {
  const { stderr } = await runMergeFixtureTests(() => {
    const t1 = it.extend({ a: [() => 'a', { scope: 'file' }] as any })
    const t2 = it.extend({ a: [() => 'a', { scope: 'test' }] as any })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest('fail', () => {})
    },
  })
  expect(stderr).toContain('Fixture "a" defined with conflicting scopes: "file" vs "test"')
})

test('mergeTests handles union of auto-fixtures in integration', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend({
      auto1: [async ({}, use: any) => {
        log('auto1 setup')
        await use('a1')
        log('auto1 teardown')
      }, { auto: true }] as any,
    })
    const t2 = it.extend({
      auto2: [async ({}, use: any) => {
        log('auto2 setup')
        await use('a2')
        log('auto2 teardown')
      }, { auto: true }] as any,
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest('trigger auto fixtures', () => {
        // No need to request them
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | auto1 setup | trigger auto fixtures
    >> fixture | auto2 setup | trigger auto fixtures
    >> fixture | auto2 teardown | trigger auto fixtures
    >> fixture | auto1 teardown | trigger auto fixtures"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > trigger auto fixtures <time>"`)
})

test('mergeTests handles same fixture names with different dependencies', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ shared: string; dep1: string }>({
      shared: async ({ dep1 }, use: any) => use(`t1-${dep1}`),
      dep1: 'dep1-t1',
    })
    const t2 = it.extend<{ shared: string; dep2: string }>({
      shared: async ({ dep2 }, use: any) => use(`t2-${dep2}`),
      dep2: 'dep2-t2',
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('t2 wins and uses its own dep', ({ shared, dep2 }: any) => {
        expect(shared).toBe('t2-dep2-t2')
        expect(dep2).toBe('dep2-t2')
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > t2 wins and uses its own dep <time>"`)
})

test('mergeTests resolves complex linear chain split across merge boundary', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const base = it.extend({ base: 'base' })
    const t1 = base.extend({
      middle: async ({ base }: any, use: any) => use(`${base}-mid`),
    })
    const t2 = base.extend({
      leaf: async ({ middle }: any, use: any) => use(`${middle}-leaf`),
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('linear chain works', ({ leaf }: any) => {
        expect(leaf).toBe('base-mid-leaf')
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > linear chain works <time>"`)
})

// Type conflicts and intersections are metadata-level validations, moved to Core suite.

test('mergeTests detects scope inheritance conflicts created by merge', async () => {
  const { stderr } = await runMergeFixtureTests(() => {
    const t1 = it.extend({
      a: [async ({}, use: any) => use('a'), { scope: 'test' }] as any,
    })
    const t2 = it.extend({
      b: [async ({ a }: any, use: any) => use(`b-${a}`), { scope: 'file' }] as any,
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest('fail', () => {})
    },
  })
  expect(stderr).toContain('The file "b" fixture cannot depend on a test fixture "a"')
})

// Preserving complex type intersections is a metadata-level validation, moved to Core suite.

test('mergeTests detects circular dependencies at runtime', async () => {
  const { stderr, stdout } = await runMergeFixtureTests(() => {
    const t1 = it.extend({
      a: async ({ b }: any, use: any) => use(`a-${b}`),
    })
    const t2 = it.extend({
      b: async ({ a }: any, use: any) => use(`b-${a}`),
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest('circular', ({ a, b }: any) => {
        console.log(a, b)
      })
    },
  })
  // Circular dependencies are detected when resolving
  const output = stdout + stderr
  expect(output).toContain('Circular fixture dependency detected')
})

test.fails('mergeTests does not allow overriding built-in fixtures', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend({ task: 'custom' } as any)
    const t2 = it.extend({ signal: 'custom' } as any)
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('built-ins are preserved', ({ task, signal }: any) => {
        expect(task.type).toBe('test')
        expect(signal instanceof AbortSignal).toBe(true)
      })
    },
  })
  expect(stderr).toBe('')
  expect(tests).toContain('✓ basic.test.ts > built-ins are preserved')
})

test('mergeTests supports overrides on nested merges', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend({ a: 1 })
    const t2 = it.extend({ b: 2 })
    const t3 = it.extend({ c: 3 })

    const nested = mergeTests(t1, mergeTests(t2, t3))
    nested.override({ a: 10, b: 20 })

    return nested
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('nested overrides work', ({ a, b, c }: any) => {
        expect(a).toBe(10)
        expect(b).toBe(20)
        expect(c).toBe(3)
      })
    },
  })
  expect(stderr).toBe('')
  expect(tests).toContain('✓ basic.test.ts > nested overrides work')
})

// Merging from different contexts is a metadata structural guarantee, moved to Core suite.

test('mergeTests preserves override chains correctly', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const base = it.extend({ value: 'original' })
    base.override({ value: 'overridden' })

    const extended = base.extend({ extra: 'extra' })
    const t2 = it.extend({ another: 'another' })
    return mergeTests(extended, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('overrides are preserved', ({ value, extra, another }: any) => {
        expect(value).toBe('overridden')
        expect(extra).toBe('extra')
        expect(another).toBe('another')
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > overrides are preserved <time>"`)
})

// Ensures large merges remain stable and fixture metadata does not degrade
// with many merged test instances.
test('mergeTests scales correctly with 50+ test instances in CLI', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const count = 50
    const tests = Array.from({ length: count }).map((_, i) => {
      return it.extend({
        [`f${i}`]: async ({}: any, use: any) => use(`val${i}`),
      })
    })
    return (mergeTests as any)(...tests)
  }, {
    'basic.test.ts': ({ extendedTest, expect }: any) => {
      extendedTest('verify all 50 fixtures', ({ f0, f49 }: any) => {
        expect(f0).toBe('val0')
        expect(f49).toBe('val49')
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > verify all 50 fixtures <time>"`)
})

test('mergeTests runtime isolation after failed merge attempt', async () => {
  // First, a failed merge (metadata conflict)
  // Since we are in the CLI test's worker, we can't easily fail the "outer" merge
  // but we can simulate it by merging conflicting items inside runMergeFixtureTests.
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const tValid = it.extend({ a: 1 })
    const tConflicting1 = it.extend({ f: [() => 1, { scope: 'file' }] as any })
    const tConflicting2 = it.extend({ f: [() => 2, { scope: 'test' }] as any })

    try {
      mergeTests(tConflicting1, tConflicting2)
    }
    catch {}

    const tOther = it.extend({ b: 2 })
    return mergeTests(tValid, tOther)
  }, {
    'basic.test.ts': ({ extendedTest, expect }: any) => {
      extendedTest('is isolated', ({ a, b }: any) => {
        expect(a).toBe(1)
        expect(b).toBe(2)
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > is isolated <time>"`)
})

// Isolated test runner for fixture lifecycle verification

async function runMergeFixtureTests<T extends Record<string, any>>(
  extendedTest: (context: { log: (...args: any[]) => void; expectTypeOf: typeof ExpectTypeOfFn }) => TestAPI<T>,
  fs: Record<string, ((context: {
    extendedTest: TestAPI<T>
    expect: ExpectStatic
    expectTypeOf: typeof ExpectTypeOfFn
    describe: SuiteAPI
    beforeAll: typeof beforeAll
    afterAll: typeof afterAll
  }) => unknown) | ViteUserConfig>,
  config?: TestUserConfig,
) {
  if (typeof fs['vitest.config.js'] === 'object') {
    const vitestConfig = fs['vitest.config.js'] as ViteUserConfig
    if (vitestConfig.test) {
      vitestConfig.test.globals = true
    }
  }
  const { stderr, stdout, fs: FS } = await runInlineTests({
    'test.js': `
import { mergeTests } from 'vitest'
export const describe = globalThis.describe
export const expect = globalThis.expect
export const expectTypeOf = globalThis.expectTypeOf
export const extendedTest = (${stripIndent(extendedTest.toString())})({ log: (...args) => console.log('>> fixture |', ...args, '| ' + expect.getState().currentTestName), expectTypeOf })
export const beforeAll = globalThis.beforeAll
export const afterAll = globalThis.afterAll
    `,
    'vitest.config.js': { test: { globals: true } },
    ...Object.entries(fs).reduce((acc, [key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value)) {
        acc[key] = value
      }
      if (typeof value === 'function') {
        acc[key] = [value, { imports: { './test.js': ['extendedTest', 'expect', 'expectTypeOf', 'describe', 'beforeAll', 'afterAll'] } }]
      }
      return acc
    }, {} as TestFsStructure),
  }, { ...config, sequence: { sequencer: StableTestFileOrderSorter } })

  return {
    stderr,
    stdout,
    fixtures: getFixtureLogs(stdout),
    tests: getSuccessTests(stdout),
    fs: FS,
  }
}

function getSuccessTests(stdout: string) {
  return stdout
    .split('\n')
    .filter(f => f.startsWith(' ✓ '))
    .map(f => f.replace(/\d+ms/, '<time>'))
    .join('\n')
}

function getFixtureLogs(stdout: string) {
  return stdout
    .split('\n')
    .filter(f => f.startsWith('>> fixture |'))
    .join('\n')
}

class StableTestFileOrderSorter {
  sort(files: TestSpecification[]) {
    return files.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  }

  shard(files: TestSpecification[]) {
    return files
  }
}
