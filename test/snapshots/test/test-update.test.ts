import { expect, test } from 'vitest'

const entries = import.meta.glob('../test-update/*inline*', { eager: true, query: 'raw' })
for (const [file, mod] of Object.entries(entries)) {
  test(file.split('/').at(-1)!, () => {
    expect((mod as any).default).toMatchSnapshot()
  })
}
