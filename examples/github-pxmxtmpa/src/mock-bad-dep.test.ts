import { expect, test, vi } from 'vitest'
// @ts-ignore
// import * as badDep from 'bad-dep'

// import "./fofofo"
// import "barara"
import "bad-dep"

// vi.mock('bad-dep', () => ({ hi: 'yo' }))

test('repro', () => {
  // expect(badDep.hi).toBe('yo')
})
