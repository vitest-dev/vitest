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

// the lines of the seed details, without the replay command
function seedLines(stderr: string): string[] {
  return stderr
    .split('\n')
    .filter((line) => /^ FAIL |^ +(Failed|Seeds?|Reproduced|Diverged) {2}|^ {13}\S/.test(line))
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
    [
      " FAIL  balancer.test.js > routes the request to the eu region",
      "       Seed  1b3cf6921e0d8da9",
      " Reproduced  1 of 2 runs: the test depends on more than its seed",
      "   Diverged  2 more runs of the seed differ at random call 1:",
      "             Math.random() → 0.9971224539990146 (balancer.test.js:14:29)",
      "             random.int(0, 100) → 97 (balancer.test.js:11:36)",
    ]
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
    [
      " FAIL  upload.test.js > splits the file into 2 chunks",
      "       Seed  2891e480c3e5e32e",
      " Reproduced  1 of 2 runs: the test depends on more than its seed",
      "   Diverged  no, 2 more runs of the seed made the same first 2 random calls (2 and 3 in total)",
    ]
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
    [
      " FAIL  balancer.test.js > routes the request to the eu region",
      "     Failed  initial run, 2nd repeat",
      "      Seeds  1b3cf6921e0d8da9, a281a34023aed313",
      " Reproduced  0 of 2 seeds, not 1b3cf6921e0d8da9, a281a34023aed313: the test depends on more than its seeds",
      "   Diverged  1b3cf6921e0d8da9: 2 more runs of the seed differ at random call 1:",
      "             Math.random() → 0.9971224539990146 (balancer.test.js:14:29)",
      "             random.int(0, 100) → 97 (balancer.test.js:11:36)",
    ]
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
    [
      " FAIL  queue.test.js > the queue gives the next job",
      "     Failed  initial run",
      "       Seed  e54a9d912c2d9c3b",
      " Reproduced  1 of 2 runs: the test depends on more than its seed",
      " FAIL  queue.test.js > the queue gives the next job",
      "     Failed  replay of initial run, 1st repeat",
      "      Seeds  4b60040302d874db, e54a9d912c2d9c3b",
      " Reproduced  1 of 2 seeds, not e54a9d912c2d9c3b: the test depends on more than its seeds",
    ]
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
    [
      " FAIL  cart.test.js > the total is below the limit",
      "     Failed  initial run, 1st repeat",
      "      Seeds  e2bb469776110278 (this error), 85826e6e8df87a0e",
      " Reproduced  2 of 2 seeds",
    ]
  `)
})
