import type { Renderer } from 'ansivision'
import { runVitest, StableTestFileOrderSorter } from '#test-utils'
import { renderString } from 'ansivision'
import { normalize } from 'pathe'
import { expect, test } from 'vitest'

test('states of running tests are reported', async () => {
  const { stdout } = await runVitest({
    root: 'fixtures/reporters/summary',
    reporters: [['default', { summary: true, summaryOptions: { threshold: 0 }, isTTY: true }]],
    config: false,
    fileParallelism: false,
    sequence: { sequencer: StableTestFileOrderSorter },
  }, undefined, { preserveAnsi: true, tty: true })

  const frames = await renderString(stdout).then(trimFrames)

  expect(frames).toMatchInlineSnapshot(`
    "
     RUN  v[...] <process-cwd>/fixtures/reporters/summary


     ❯ first.test.ts [queued]

     Test Files 0 passed (2)
          Tests 0 passed (0)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary


     ❯ first.test.ts 0/3

     Test Files 0 passed (2)
          Tests 0 passed (3)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary


     ❯ first.test.ts 1/3

     Test Files 0 passed (2)
          Tests 1 passed (3)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary


     ❯ first.test.ts 2/3

     Test Files 0 passed (2)
          Tests 2 passed (3)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary


     ❯ first.test.ts 3/3

     Test Files 0 passed (2)
          Tests 3 passed (3)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary

     ✓ first.test.ts (3 tests) <time>


     Test Files 1 passed (2)
          Tests 3 passed (3)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary

     ✓ first.test.ts (3 tests) <time>

     ❯ second.test.ts [queued]

     Test Files 1 passed (2)
          Tests 3 passed (3)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary

     ✓ first.test.ts (3 tests) <time>

     ❯ second.test.ts 0/3

     Test Files 1 passed (2)
          Tests 3 passed (6)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary

     ✓ first.test.ts (3 tests) <time>

     ❯ second.test.ts 1/3

     Test Files 1 passed (2)
          Tests 4 passed (6)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary

     ✓ first.test.ts (3 tests) <time>

     ❯ second.test.ts 2/3

     Test Files 1 passed (2)
          Tests 5 passed (6)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary

     ✓ first.test.ts (3 tests) <time>

     ❯ second.test.ts 3/3

     Test Files 1 passed (2)
          Tests 6 passed (6)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary

     ✓ first.test.ts (3 tests) <time>
     ✓ second.test.ts (3 tests) <time>


     Test Files 2 passed (2)
          Tests 6 passed (6)
       Start at <time>
       Duration <time>

    -------------------------------------------------------

     RUN  v[...] <process-cwd>/fixtures/reporters/summary

     ✓ first.test.ts (3 tests) <time>
     ✓ second.test.ts (3 tests) <time>

     Test Files  2 passed (2)
          Tests  6 passed (6)
       Start at  <time>
       Duration  <time> (transform <time>, setup <time>, import <time>, tests <time>, environment <time>)

    "
  `)
})

function trimFrames(frames: Renderer) {
  return Array.from(frames)
  // Make each frame stable
    .map(trimReporterOutput)

  // Filter possible duplicate frames. Maybe just duration changed (that we stabilized to <time>, so frame is duplicate)
    .filter((item, index, all) => all.indexOf(item) === index)

  // Separate frames with divider
    .join(`\n${'-'.repeat(55)}\n`)
}

function trimReporterOutput(report: string) {
  return report
    .replace(/\d+ms/g, '<time>')
    .replace(/\d+\.\d+s/g, '<time>')
    .replace(normalize(process.cwd()), '<process-cwd>')
    .replace(/RUN {2}v([\w\-.]+) /, 'RUN  v[...] ')
    .replace(/(Start at {1,2})\d+:\d+:\d+/, '$1<time>')
    .split('\n')
    .join('\n')
}
