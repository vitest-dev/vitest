import type { DomainMatchResult, DomainSnapshotAdapter } from '@vitest/snapshot'

// Key-value domain adapter: each snapshot is multiple lines of `key=value`.
// Values can be literal strings or `/regex/` patterns in the stored snapshot.
// On match, each line is checked independently — regex lines use RegExp.test().
// On partial match, `mergedExpected` preserves regex for matched lines
// and substitutes literal rendered values for unmatched lines.

type KVCaptured = Record<string, string>
type KVExpected = Record<string, string | RegExp>

function renderKV(obj: Record<string, unknown>) {
  return `\n${Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n')}\n`
}

export const kvAdapter: DomainSnapshotAdapter<KVCaptured, KVExpected> = {
  name: 'kv',

  capture(received: unknown): KVCaptured {
    if (received && typeof received === 'object') {
      return Object.fromEntries(Object.entries(received).map(([k, v]) => [k, String(v)]))
    }
    throw new TypeError('kv adapter expects a plain object')
  },

  render(captured: KVCaptured): string {
    return renderKV(captured)
  },

  parseExpected(input: string): KVExpected {
    if (!input.trim()) {
      return {}
    }
    const entries = input.trim().split('\n').map((line) => {
      const eq = line.indexOf('=')
      if (eq === -1) {
        throw new Error(`Invalid KV Format: '${line}'`)
      }
      const key = line.slice(0, eq)
      const raw = line.slice(eq + 1)
      const value = (raw.startsWith('/') && raw.endsWith('/') && raw.length > 1)
        ? new RegExp(raw.slice(1, -1))
        : raw
      return [key, value]
    })
    return Object.fromEntries(entries)
  },

  match(captured: KVCaptured, expected: KVExpected): DomainMatchResult {
    const resolvedLines: string[] = []
    let pass = true

    for (const [key, actualValue] of Object.entries(captured)) {
      const expectedValue = expected[key]

      // non asserted keys are skipped (works as subset match)
      if (typeof expectedValue === 'undefined') {
        continue;
      }

      // preserve matched pattern for normalized error diff and partial update
      if (expectedValue instanceof RegExp && expectedValue.test(actualValue)) {
        resolvedLines.push(`${key}=/${expectedValue.source}/`)
        continue
      }

      resolvedLines.push(`${key}=${actualValue}`)
      pass &&= actualValue === expectedValue
    }

    return {
      pass,
      message: pass ? undefined : 'KV entries do not match',
      resolved: `\n${resolvedLines.join('\n')}\n`,
      expected: `\n${renderKV(expected)}\n`,
    }
  },
}
