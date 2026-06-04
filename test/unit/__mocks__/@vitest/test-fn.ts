import actualCreate from '@vitest/test-fn'
import { vi } from 'vitest'

// when creating a store, we get its initial state, create a reset function and add it in the set
export default vi.fn((createState) => {
  return actualCreate(createState)
})
