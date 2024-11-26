import { describe, expect, test } from 'vitest'

function objectToCSS(selector: string, obj: Record<string, string>) {
  const body = Object.entries(obj)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')
  return `${selector} {\n${body}\n}`
}

describe('snapshots', () => {
  const files = import.meta.glob('./fixtures/snapshots/**/input.json', { as: 'raw' })

  for (const [path, file] of Object.entries(files)) {
    test(path, async () => {
      const entries = JSON.parse(await file()) as any[]
      await expect(entries.map(i => objectToCSS(i[0], i[1])).join('\n'))
        .toMatchFileSnapshot(path.replace('input.json', 'output.css'))
    })
  }
})

test('handle empty file', async () => {
  await expect('').toMatchFileSnapshot('./fixtures/snapshot-empty.txt')
})
