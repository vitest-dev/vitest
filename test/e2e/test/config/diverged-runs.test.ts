import type { TestCase, TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

// the inline snapshots have the seeds of the run seed 0
function runSeededTests(...[structure, config, ...rest]: Parameters<typeof runInlineTests>) {
  return runInlineTests(structure, { seed: 0, ...config }, ...rest)
}

function findTest(modules: TestModule[], name: string): TestCase {
  const testCase = modules
    .flatMap((module) => [...module.children.allTests()])
    .find((testCase) => testCase.fullName === name)
  if (!testCase) {
    throw new Error(`The test "${name}" was not found.`)
  }
  return testCase
}

// The lines of the seed details, without the replay command. The empty first and last lines put
// the quotes of an inline snapshot on their own lines.
function seedLines(stderr: string): string {
  const lines = stderr
    .split('\n')
    .filter((line) => /^ FAIL |^ +(Failed|Reproduced) {2}|^ {13}\S/.test(line))
  return lines.length ? `\n${lines.join('\n')}\n` : ''
}

const balancerTests = /* js */ `
import { expect, test, vi } from 'vitest'

const regions = ['us', 'eu']
// the balancer keeps its position from one run to the next
let next = 0

function route(random) {
  const region = regions[next++ % regions.length]
  if (region === 'us') {
    return { region, delay: random.int(0, 100) }
  }
  // the eu client creates its request id with Math.random
  return { region, id: Math.random().toString(36).slice(2) }
}

test('routes the request to the eu region', ({ random }) => {
  vi.useFakeRandom()
  console.log('run', next)
  expect(route(random).region).toBe('eu')
})
`

test('a replay that does not fail again runs 1 more time, and the report shows the first random call that is different', async () => {
  const { stderr, stdout, results } = await runSeededTests({
    'balancer.test.js': balancerTests,
  })
  const testCase = findTest(results, 'routes the request to the eu region')
  expect(testCase.result().state).toBe('failed')
  // the third run is not an attempt, and its logs are not reported
  expect(testCase.attempts().map(({ state }) => state)).toEqual(['failed', 'passed'])
  expect(stdout.match(/^run \d$/gm)).toEqual(['run 0', 'run 1'])
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  balancer.test.js > routes the request to the eu region
     Reproduced  no, the 2nd run passed, so the test depends on more than its seed
                 the 1st and 2nd runs made other random calls on context.random and the fakes of vi.useFakeRandom()
                 the 2nd and 3rd runs differ at random call 1:
                 2nd run: Math.random() → 0.9971224539990146 (balancer.test.js:14:29)
                 3rd run: random.int(0, 100) → 97 (balancer.test.js:11:36)
    "
  `)
})

test('the report says if 1 run of the seed made more random calls than the other', async () => {
  const { stderr } = await runSeededTests({
    'upload.test.js': /* js */ `
      import { expect, test } from 'vitest'

      // the client keeps its chunk size from one upload to the next
      let chunks = 0

      function upload(random) {
        chunks++
        return Array.from({ length: chunks }, () => random.int(1, 9))
      }

      test('splits the file into 2 chunks', ({ random }) => {
        expect(upload(random)).toHaveLength(2)
      })
    `,
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  upload.test.js > splits the file into 2 chunks
     Reproduced  no, the 2nd run passed, so the test depends on more than its seed
                 the 1st and 2nd runs made other random calls on context.random
                 the 2nd and 3rd runs made the same first 2 random calls (2 and 3 in total)
    "
  `)
})

test('a block of seeds shows the first seed whose replay did not fail again', async () => {
  const { stderr } = await runSeededTests({
    'balancer.test.js': balancerTests.replace(
      `test('routes the request to the eu region',`,
      `test('routes the request to the eu region', { repeats: 2 },`,
    ),
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  balancer.test.js > routes the request to the eu region
         Failed  2 of 3 runs
     Reproduced  no for 2 of 2 seeds (1b3cf6921e0d8da9, a281a34023aed313), so the test depends on more than its seeds
                 1b3cf6921e0d8da9: the 1st and 2nd runs made other random calls on context.random and the fakes of vi.useFakeRandom()
                 the 2nd and 3rd runs differ at random call 1:
                 2nd run: Math.random() → 0.9971224539990146 (balancer.test.js:14:29)
                 3rd run: random.int(0, 100) → 97 (balancer.test.js:11:36)
    "
  `)
})

test('a seed does not run 1 more time if a run of it failed with a timeout', async () => {
  const { stderr, stdout } = await runSeededTests(
    {
      'queue.test.js': /* js */ `
        import { afterAll, expect, test } from 'vitest'

        // the worker keeps its connection from one run to the next
        let connected = false
        // a hidden run does not show its logs
        let runs = 0
        afterAll(() => console.log('runs', runs))

        test('the queue gives the next job', { repeats: 1, timeout: 100 }, async ({ random }) => {
          runs++
          const job = random.int(1, 1000)
          if (connected) {
            // the queue waits for a connection that never ends
            await new Promise(() => {})
          }
          connected = true
          expect(job).toBeLessThan(0)
        })
      `,
    },
    { shrink: false },
  )
  // each repeat and its replay, without a third run
  expect(stdout.match(/^runs \d+$/gm)).toEqual(['runs 4'])
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  queue.test.js > the queue gives the next job
         Failed  1 of 2 runs
     Reproduced  no, the 2nd run failed with another error, so the test depends on more than its seed
                 TestTimeoutError: Test timed out in 100ms.
     FAIL  queue.test.js > the queue gives the next job
         Failed  1 of 2 runs
    "
  `)
})

test('a failure that fails again in the same way does not run 1 more time', async () => {
  const { stderr, stdout } = await runSeededTests(
    {
      'cart.test.js': /* js */ `
        import { expect, test } from 'vitest'

        test('the total is below the limit', { repeats: 1 }, ({ random }) => {
          console.log('run')
          expect(random.int(1, 1000)).toBeLessThan(0)
        })
      `,
    },
    { shrink: false },
  )
  // each repeat and its replay
  expect(stdout.match(/^run$/gm)).toEqual(['run', 'run', 'run', 'run'])
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  cart.test.js > the total is below the limit
         Failed  2 of 2 runs
    "
  `)
})

test('a replay that read the same random values as the failed run does not run 1 more time', async () => {
  const { stderr, stdout } = await runSeededTests({
    'profile.test.js': /* js */ `
      import { afterAll, expect, test } from 'vitest'

      // the cache is empty only in the first run
      let cached = false
      // a hidden run does not show its logs
      let runs = 0
      afterAll(() => console.log('runs', runs))

      test('the profile comes from the cache', ({ random }) => {
        runs++
        const userId = random.int(1, 1000)
        const fromCache = cached
        cached = true
        expect({ userId, fromCache }).toEqual({ userId, fromCache: true })
      })
    `,
  })
  // the failed run and its replay, without a third run
  expect(stdout.match(/^runs \d+$/gm)).toEqual(['runs 2'])
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  profile.test.js > the profile comes from the cache
     Reproduced  no, the 2nd run passed, so the test depends on more than its seed
                 the 1st and 2nd runs read the same random values
    "
  `)
})

test('the report names the forks that read other values in the failed run', async () => {
  const { stderr } = await runSeededTests({
    'profile.test.js': /* js */ `
      import { expect, test } from 'vitest'

      // the cache is empty only in the first run
      let cached = false

      test('the profile comes from the cache', ({ random }) => {
        const network = random.fork('network')
        // without the cache, the request goes to a random replica
        const source = cached ? 'cache' : network.pick(['eu', 'us', 'ap'])
        cached = true
        expect(source).toBe('cache')
      })
    `,
  })
  expect(seedLines(stderr)).toMatchInlineSnapshot(`
    "
     FAIL  profile.test.js > the profile comes from the cache
     Reproduced  no, the 2nd run passed, so the test depends on more than its seed
                 the 1st and 2nd runs made other random calls on context.random.fork('network')
                 the 2nd and 3rd runs made no random calls
    "
  `)
})
