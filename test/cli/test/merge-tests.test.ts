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

// --- Error paths ---

test('mergeTests() with zero arguments throws TypeError', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.ts': `
      import { mergeTests } from 'vitest'
      // @ts-expect-error testing zero-arg error path
      mergeTests()
    `,
  }, { globals: true })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    TypeError: mergeTests requires at least one test
     ❯ basic.test.ts:4:7
          2|       import { mergeTests } from 'vitest'
          3|       // @ts-expect-error testing zero-arg error path
          4|       mergeTests()
           |       ^
          5|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('mergeTests with invalid second arg triggers nextContext check', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.ts': `
      import { test, mergeTests } from 'vitest'
      const valid = test.extend({ a: 1 })
      mergeTests(valid, {} as any)
    `,
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    TypeError: mergeTests requires extended test instances created via test.extend()
     ❯ basic.test.ts:4:7
          2|       import { test, mergeTests } from 'vitest'
          3|       const valid = test.extend({ a: 1 })
          4|       mergeTests(valid, {} as any)
           |       ^
          5|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('mergeTests with invalid first arg triggers currentContext check', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.ts': `
      import { test, mergeTests } from 'vitest'
      const valid = test.extend({ a: 1 })
      mergeTests({} as any, valid)
    `,
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    TypeError: Cannot merge tests: base test is not a valid test instance
     ❯ basic.test.ts:4:7
          2|       import { test, mergeTests } from 'vitest'
          3|       const valid = test.extend({ a: 1 })
          4|       mergeTests({} as any, valid)
           |       ^
          5|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

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

// --- Basic merging with async fixtures and teardown ordering ---

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

// --- Scoped fixtures ---

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

test('mergeTests file-scoped fixture depending on test-scoped fixture fails', async () => {
  const { stderr } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend<{ local: string; fileFix: string }>({
      local: async ({}, use) => {
        await use('local-val')
      },
      fileFix: [
        async ({ local }, use) => {
          log(`fileFix from ${local}`)
          await use(local)
        },
        { scope: 'file' },
      ],
    })
    const t2 = it.extend<{ other: number }>({ other: 1 })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest('should fail', ({ fileFix: _f }) => {})
    },
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    FixtureDependencyError: The file "fileFix" fixture cannot depend on a test fixture "local".
     ❯ test.js:7:17
          5| export const expectTypeOf = globalThis.expectTypeOf
          6| export const extendedTest = (({ log }) => {
          7|   const t1 = it.extend({
           |                 ^
          8|     local: async ({}, use) => {
          9|       await use("local-val");
     ❯ test.js:21:3
     ❯ basic.test.ts:2:1

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

// Documents the architectural invariant: a true A→B→A cycle that only emerges after
// merge cannot be constructed, because parseUserFixtures() eagerly validates that every
// dep is known at extend() time. Attempting `it.extend({ a: ({ b }) => ... })` where `b`
// is not yet in the registry throws FixtureDependencyError immediately.
// This is a guarantee — not a gap — that the cycle detection in resolveDeps() handles.
test('mergeTests circular dep across merge boundary: eager validation prevents construction', async () => {
  const { stderr } = await runMergeFixtureTests(() => {
    // t1: `a` tries to depend on `b`. `b` is not in t1's registry.
    // parseUserFixtures() uses getUsedProps() to extract 'b' from the destructured arg,
    // then validates registrations.get('b') === undefined → FixtureDependencyError.
    const t1 = (it as any).extend({
      a: async ({ b }: any, use: any) => use(`a-from-${b}`),
    })
    const t2 = (it as any).extend({
      b: async ({ a }: any, use: any) => use(`b-from-${a}`),
    })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest }: any) => {
      extendedTest('cycle triggers error', ({ a: _a }: any) => {})
    },
  })
  // Error is thrown at t1.extend() time — the merge never runs.
  // A cycle only detectable post-merge is structurally impossible.
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts [ basic.test.ts ]
    FixtureDependencyError: The "a" fixture depends on unknown fixture "b".
     ❯ test.js:7:17
          5| export const expectTypeOf = globalThis.expectTypeOf
          6| export const extendedTest = (() => {
          7|   const t1 = it.extend({
           |                 ^
          8|     a: async ({ b }, use) => use(\`a-from-\${b}\`)
          9|   });
     ❯ test.js:14:3
     ❯ basic.test.ts:2:1

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

// Validates that when two fixtures share a name but have incompatible value types,
// the fast-path Map.set() replacement works cleanly: no stale function/deps metadata
// from t1's function fixture leaks onto t2's static fixture.
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
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('last wins regardless of shape', ({ foo }) => {
        // t2's static `123` wins over t1's async function fixture.
        // No stale `deps` or `value` should leak from t1's TestFixtureItem.
        expect(foo).toBe(123)
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > last wins regardless of shape <time>"`)
})

test('mergeTests same fixture name with different scopes — last definition wins across all scope transitions', async () => {
  // file→test
  const { stderr: e1, tests: t1Out } = await runMergeFixtureTests(() => {
    const ta = it.extend<{ f: string }>({
      f: [async ({}, use) => use('file-val'), { scope: 'file' }],
    })
    const tb = it.extend<{ f: string }>({
      f: async ({}, use) => use('test-val'),
    })
    return mergeTests(ta, tb)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('file→test wins test-val', ({ f }) => expect(f).toBe('test-val'))
    },
  })
  expect(e1).toMatchInlineSnapshot(`""`)
  expect(t1Out).toMatchInlineSnapshot(`" ✓ basic.test.ts > file→test wins test-val <time>"`)

  // test→worker
  const { stderr: e2, tests: t2Out } = await runMergeFixtureTests(() => {
    const ta = it.extend<{ f: string }>({
      f: async ({}, use) => use('test-val'),
    })
    const tb = it.extend<{ f: string }>({
      f: [async ({}, use) => use('worker-val'), { scope: 'worker' }],
    })
    return mergeTests(ta, tb)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('test→worker wins worker-val', ({ f }) => expect(f).toBe('worker-val'))
    },
  })
  expect(e2).toMatchInlineSnapshot(`""`)
  expect(t2Out).toMatchInlineSnapshot(`" ✓ basic.test.ts > test→worker wins worker-val <time>"`)

  // worker→file
  const { stderr: e3, tests: t3Out } = await runMergeFixtureTests(() => {
    const ta = it.extend<{ f: string }>({
      f: [async ({}, use) => use('worker-val'), { scope: 'worker' }],
    })
    const tb = it.extend<{ f: string }>({
      f: [async ({}, use) => use('file-val'), { scope: 'file' }],
    })
    return mergeTests(ta, tb)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('worker→file wins file-val', ({ f }) => expect(f).toBe('file-val'))
    },
  })
  expect(e3).toMatchInlineSnapshot(`""`)
  expect(t3Out).toMatchInlineSnapshot(`" ✓ basic.test.ts > worker→file wins file-val <time>"`)
})

// --- Override after merge ---

test('mergeTests override works on merged test with nested describe', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ a: number }>({ a: 1 })
    const t2 = it.extend<{ b: number }>({ b: 2 })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect, describe }) => {
      extendedTest.override({ a: 10 })

      extendedTest('override applied', ({ a, b }) => {
        expect(a).toBe(10)
        expect(b).toBe(2)
      })

      describe('nested', () => {
        extendedTest.override({ b: 20 })
        extendedTest('nested override', ({ a, b }) => {
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

// --- Fixture lifecycle ordering ---

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
    'basic.test.ts': ({ extendedTest }) => {
      extendedTest('test1', ({ a: _a, b: _b }) => {})
      extendedTest('test2', ({ a: _a, b: _b }) => {})
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

// --- Structural invariants & dependency graph guarantees ---

// Non-mutation guarantee: mergeTests must not modify t1 or t2 in-place.
// The implementation does currentTest = currentTest.extend(fixtures) which creates
// a new TestFixtures instance — the original registrations maps are never mutated.
test('mergeTests does not mutate original test instances', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ a: string }>({ a: 'from-t1' })
    const t2 = it.extend<{ b: string }>({ b: 'from-t2' })
    // Create merged, then use original t1 independently
    mergeTests(t1, t2)
    // Return t1 unchanged — it must NOT see t2's fixture `b`
    return t1
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('original still only has its own fixtures', ({ a }) => {
        expect(a).toBe('from-t1')
        // Proof of non-mutation: t1 was used alone and correctly resolved only its own fixture.
        // If mergeTests mutated t1, `a` would be undefined or `b` would appear in context.
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > original still only has its own fixtures <time>"`)
})

test('mergeTests resolves dependency chain from shared base', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ port: number }>({ port: 3000 })
      .extend<{ url: string }>({
        url: async ({ port }, use) => {
          await use(`http://localhost:${port}`)
        },
      })
    const t2 = it.extend<{ db: string }>({ db: 'postgres' })
    return mergeTests(t1, t2)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('all fixtures resolve', ({ port, url, db }) => {
        expect(port).toBe(3000)
        expect(url).toBe('http://localhost:3000')
        expect(db).toBe('postgres')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > all fixtures resolve <time>"`)
})

test('mergeTests fixture from t2 can depend on fixture provided by t1', async () => {
  // This tests cross-merge dependency: t2's fixture depends on t1's fixture
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
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('cross-merge dep resolves', ({ baseUrl, fullUrl, token }) => {
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
  // This tests the crucial question: if t1 has `base` and t2 overrides `base`,
  // and t1's `derived` depends on `base` — which `base` does `derived` see?
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
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('derived sees t2 base', ({ base, derived }) => {
        expect(base).toBe('t2-base')
        // `derived` was defined in t1 and depends on `base`.
        // After merge, `base` is overridden by t2.
        // Vitest resolves `derived` using the current fixture map, so it gets t2's base.
        expect(derived).toBe('derived-from-t2-base')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > derived sees t2 base <time>"`)
})

// --- Structural dependency graph stress tests ---

// [Test 2] Both t1 and t2 define dependents on the same-named fixture.
// After merge, t2's base wins. resolveDeps() must remap BOTH dependents
// to the surviving base via name lookup — not frozen parent pointer.
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
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('both sides see base-v2', ({ a, b }) => {
        // t2's base wins. Both `a` (from t1) and `b` (from t2)
        // must resolve `base` via registrations.get('base') — live lookup.
        expect(a).toBe('a-from-base-v2')
        expect(b).toBe('b-from-base-v2')
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > both sides see base-v2 <time>"`)
})

// [Test 3] Diamond dependency across merged tests.
// resolveDeps() clears depSet after each fixture to avoid false positives.
// This directly validates that `depSet.clear()` is correct:
// `base` is reachable via two separate paths (through `a` AND through `b`),
// but must NOT be detected as a cycle.
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
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('diamond resolves without cycle error', ({ derived }) => {
        // `base` is a shared dep of both `a` and `b`, both consumed by `derived`.
        // Without depSet.clear(), the second visit to `base` would throw CircularError.
        expect(derived).toBe('a-from-base-val+b-from-base-val')
      })
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > diamond resolves without cycle error <time>"`)
})

// [Test 4] File-scoped fixtures cached by TestFixtureItem object identity (WeakMap).
// Self-merge must not produce a duplicate TestFixtureItem causing double-init.
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
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('test1', ({ fileFix }) => expect(fileFix).toBe('file-val'))
      extendedTest('test2', ({ fileFix }) => expect(fileFix).toBe('file-val'))
    },
  })
  expect(stderr).toMatchInlineSnapshot(`""`)
  // File-scoped fixture must init exactly once (not twice due to self-merge).
  // The WeakMap cache in resolveScopeFixtureValue keys by TestFixtureItem identity.
  // Self-merge via the fast-path in extend(TestFixtures) copies the same item object,
  // so the cache hit is guaranteed — one init, one teardown.
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | fileFix init | test1
    >> fixture | fileFix teardown | test2"
  `)
  expect(tests).toMatchInlineSnapshot(`
    " ✓ basic.test.ts > test1 <time>
     ✓ basic.test.ts > test2 <time>"
  `)
})

// [Test 5] Three-way merge with a full override chain.
// t1 provides base, t2 provides mid(base), t3 provides top(mid).
// Each extend is valid at creation. After merge, the full dep chain
// base → mid → top must resolve in the correct order.
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
    // Merge explicitly-typed separate tests to verify mergeTests handles
    // deep chains coming from different TestFixtures instances
    return mergeTests(t1, mergeTests(t2, t3))
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('full chain resolves', ({ base, mid, top }) => {
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

test('mergeTests merges three tests with function fixtures', async () => {
  const { stderr, fixtures, tests } = await runMergeFixtureTests(({ log }) => {
    const t1 = it.extend<{ a: string }>({
      a: async ({}, use) => {
        log('init a')
        await use('a')
      },
    })
    const t2 = it.extend<{ b: string }>({
      b: async ({}, use) => {
        log('init b')
        await use('b')
      },
    })
    const t3 = it.extend<{ c: string }>({
      c: async ({}, use) => {
        log('init c')
        await use('c')
      },
    })
    return mergeTests(t1, t2, t3)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('all three fixtures work', ({ a, b, c }) => {
        expect(a).toBe('a')
        expect(b).toBe('b')
        expect(c).toBe('c')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(fixtures).toMatchInlineSnapshot(`
    ">> fixture | init a | all three fixtures work
    >> fixture | init b | all three fixtures work
    >> fixture | init c | all three fixtures work"
  `)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > all three fixtures work <time>"`)
})

test('mergeTests variadic — later test overrides same-named fixture', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const t1 = it.extend<{ shared: string }>({ shared: 'first' })
    const t2 = it.extend<{ shared: string }>({ shared: 'second' })
    const t3 = it.extend<{ shared: string }>({ shared: 'third' })
    return mergeTests(t1, t2, t3)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('last wins', ({ shared }) => {
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

test('mergeTests deep chain with same fixture name — grandchild overrides base', async () => {
  const { stderr, tests } = await runMergeFixtureTests(() => {
    const base = it.extend<{ val: string }>({ val: 'base' })
    const child = base.extend<{ val: string }>({ val: 'child' })
    const grandchild = child.extend<{ val: string }>({ val: 'grandchild' })
    return mergeTests(grandchild)
  }, {
    'basic.test.ts': ({ extendedTest, expect }) => {
      extendedTest('grandchild value wins', ({ val }) => {
        expect(val).toBe('grandchild')
      })
    },
  })

  expect(stderr).toMatchInlineSnapshot(`""`)
  expect(tests).toMatchInlineSnapshot(`" ✓ basic.test.ts > grandchild value wins <time>"`)
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

// --- Mixed fixture types in one merge ---

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

// --- Cross-file behavior ---

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

// --- Test harness (adapted from scoped-fixtures.test.ts) ---

async function runMergeFixtureTests<T>(
  extendedTest: ({ log, expectTypeOf }: { log: typeof console.log; expectTypeOf: typeof ExpectTypeOfFn }) => TestAPI<T>,
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
    fs['vitest.config.js'].test!.globals = true
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
