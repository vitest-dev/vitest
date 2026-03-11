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

// poll() throws on first call, then returns stable value
test('poll retries until value available', async () => {
  let i = 0
  await expect.poll(() => {
    i++
    if (i === 1) {
      throw new Error('not ready yet')
    }
    return { name: 'alice', age: '30' }
  }).toMatchDomainSnapshot('kv')
})

// poll() returns the final value immediately
test('stable value', async () => {
  await expect.poll(() => {
    return { name: 'bob', score: '999', status: 'active' }
  }).toMatchDomainSnapshot('kv')
})

// poll() returns changing values that eventually settle.
// Used to test retry-on-compare: snapshot is pre-seeded with the final value,
// and poll() goes through intermediate states before matching.
test('settling value', async () => {
  let i = 0
  await expect.poll(() => {
    i++
    if (i === 1) {
      return { city: 'loading', pop: '0' }
    }
    return { city: 'tokyo', pop: '14000000' }
  }).toMatchDomainSnapshot('kv')
})
