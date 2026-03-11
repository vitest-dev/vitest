import type { DomainMatchResult, DomainSnapshotAdapter } from '@vitest/snapshot'
import { expect, test } from 'vitest'

interface KVCaptured {
  entries: { key: string; value: string }[]
}

interface KVExpected {
  entries: { key: string; value: string | RegExp }[]
}

const kvAdapter: DomainSnapshotAdapter<KVCaptured, KVExpected> = {
  name: 'kv',

  capture(received) {
    if (typeof received !== 'object' || received === null) {
      throw new TypeError('kv adapter expects a plain object')
    }
    const entries = Object.entries(received as Record<string, string>)
      .map(([key, value]) => ({ key, value: String(value) }))
    return { entries }
  },

  render(captured) {
    return `\n${captured.entries.map(e => `${e.key}=${e.value}`).join('\n')}\n`
  },

  parseExpected(input) {
    const entries = input.trim().split('\n').map((line) => {
      const eq = line.indexOf('=')
      const key = line.slice(0, eq)
      const raw = line.slice(eq + 1)
      const value = (raw.startsWith('/') && raw.endsWith('/') && raw.length > 1)
        ? new RegExp(raw.slice(1, -1))
        : raw
      return { key, value }
    })
    return { entries }
  },

  match(captured, expected): DomainMatchResult {
    const mergedLines: string[] = []
    const actualLines: string[] = []
    const expectedLines: string[] = []
    let allPass = true

    for (let i = 0; i < captured.entries.length; i++) {
      const cap = captured.entries[i]
      const exp = expected.entries[i]

      if (!exp) {
        mergedLines.push(`${cap.key}=${cap.value}`)
        actualLines.push(`${cap.key}=${cap.value}`)
        expectedLines.push(`${cap.key}=`)
        allPass = false
        continue
      }

      if (exp.value instanceof RegExp) {
        const patternStr = `${exp.key}=/${exp.value.source}/`
        if (exp.value.test(cap.value)) {
          mergedLines.push(patternStr)
          actualLines.push(patternStr)
          expectedLines.push(patternStr)
        }
        else {
          mergedLines.push(`${cap.key}=${cap.value}`)
          actualLines.push(`${cap.key}=${cap.value}`)
          expectedLines.push(patternStr)
          allPass = false
        }
      }
      else {
        if (cap.value === exp.value) {
          mergedLines.push(`${exp.key}=${exp.value}`)
          actualLines.push(`${exp.key}=${exp.value}`)
          expectedLines.push(`${exp.key}=${exp.value}`)
        }
        else {
          mergedLines.push(`${cap.key}=${cap.value}`)
          actualLines.push(`${cap.key}=${cap.value}`)
          expectedLines.push(`${exp.key}=${exp.value}`)
          allPass = false
        }
      }
    }

    return {
      pass: allPass,
      message: allPass ? undefined : 'KV entries do not match',
      mergedExpected: `\n${mergedLines.join('\n')}\n`,
      actual: `\n${actualLines.join('\n')}\n`,
      expected: `\n${expectedLines.join('\n')}\n`,
    }
  },
}

expect.addSnapshotDomain(kvAdapter)

// Test plan:
//
// 1. poll() throws then succeeds — retries poll until value available, creates snapshot
//    - verify trial count to confirm retry happened
//    - note: outer expect.poll loop calls poll() once before our matcher sees it,
//      so trial count includes that extra call
//
// 2. stable value — poll() returns immediately, snapshot created/matched
//
// 3. settling value (retry-on-compare) — poll() returns intermediate values first,
//    snapshot is pre-seeded (via integration test) with the final value,
//    retry loop keeps probing until poll() returns matching value
//
// 4. timeout on compare — poll() never returns matching value,
//    should fail with snapshot mismatch (showing last captured value),
//    not a generic timeout error
//
// 5. poll() always throws — never produces a value within timeout,
//    should propagate the last error
//
// 6. multiple poll+snapshot in same test — two expect.poll().toMatchDomainSnapshot()
//    calls in one test, verifies key counter works correctly (probe peek invariant)
//
// 7. non-poll alongside poll — regular expect(value).toMatchDomainSnapshot('kv')
//    in the same file, verifies no interference
//
// 8. pattern-preserving update with poll — hand-edit regex into snapshot,
//    run with --update, verify mergedExpected preserves matched patterns
//    (tested via integration test editFile + runVitest)

test('stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++;
    // --- STABLE TEST POLL ---
    return { name: 'a', age: '23' }
  }, { timeout: 100 }).toMatchDomainSnapshot('kv')
  expect(trial).toBe(1)
})

test('throw then stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 1) {
      throw new Error(`Fail at ${trial}`)
    }
    return { name: 'b', age: '23' }
  }).toMatchDomainSnapshot('kv')
  expect(trial).toBe(2)
})

test('unstable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    return { name: 'c', __UNSTABLE_TRIAL__: trial }
  }).toMatchDomainSnapshot('kv')
})

// #6: multiple poll+snapshot in same test — verifies probe peek counter invariant
test('multiple poll snapshots', async () => {
  await expect.poll(() => {
    return { x: '1' }
  }, { timeout: 100 }).toMatchDomainSnapshot('kv')

  await expect.poll(() => {
    return { y: '2' }
  }, { timeout: 100 }).toMatchDomainSnapshot('kv')
})

// #7: non-poll alongside poll — verifies no interference
test('non-poll alongside poll', async () => {
  expect({ static: 'value' }).toMatchDomainSnapshot('kv')

  await expect.poll(() => {
    return { polled: 'value' }
  }, { timeout: 100 }).toMatchDomainSnapshot('kv')

  expect({ another: 'static' }).toMatchDomainSnapshot('kv')
})
