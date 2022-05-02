import { it } from 'vitest'

const isDev = process.env.NODE_ENV === 'development'

if (!isDev) {
  it('prod only tests', () => {
    /* ... */
  })
}

// Now in Vitest v0.10.1
it.skipIf(isDev)('prod only tests', () => {
  /* ... */
})

it.runIf(isDev)('dev only tests', () => {
  /* ... */
})

