import { expect, test } from 'vitest'

test('pattern', () => {
  const size = 10
  const g = '🟩'
  const r = '🟥'

  function pattern() {
    return Array.from({ length: size })
      .map((_, y) =>
        Array.from({ length: size }).map((__, x) => {
          return (x * y) % 3 ? g : r
        }),
      )
      .map((i) => i.join(' '))
      .join('\n')
  }

  expect(`\n${pattern()}`).toMatchInlineSnapshot(`
"
🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥
🟥 🟩 🟩 🟥 🟩 🟩 🟥 🟩 🟩 🟥
🟥 🟩 🟩 🟥 🟩 🟩 🟥 🟩 🟩 🟥
🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥
🟥 🟩 🟩 🟥 🟩 🟩 🟥 🟩 🟩 🟥
🟥 🟩 🟩 🟥 🟩 🟩 🟥 🟩 🟩 🟥
🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥
🟥 🟩 🟩 🟥 🟩 🟩 🟥 🟩 🟩 🟥
🟥 🟩 🟩 🟥 🟩 🟩 🟥 🟩 🟩 🟥
🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥 🟥"`)
})
