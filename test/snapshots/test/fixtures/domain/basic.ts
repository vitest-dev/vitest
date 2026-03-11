import type { DomainMatchResult, DomainSnapshotAdapter } from '@vitest/snapshot'

// Key-value domain adapter: each snapshot is multiple lines of `key=value`.
// Values can be literal strings or `/regex/` patterns in the stored snapshot.
// On match, each line is checked independently — regex lines use RegExp.test().
// On partial match, `mergedExpected` preserves regex for matched lines
// and substitutes literal rendered values for unmatched lines.

interface KVCaptured {
  entries: { key: string; value: string }[]
}

interface KVExpected {
  entries: { key: string; value: string | RegExp }[]
}

export const kvAdapter: DomainSnapshotAdapter<KVCaptured, KVExpected> = {
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
          // regex matched — both sides show pattern form (cancels in diff)
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
