import { vi } from 'vitest'
import actualCreate from 'zustand'

// when creating a store, we get its initial state, create a reset function and add it in the set
const create = vi.fn((createState) => {
  const store = actualCreate(createState)
  return store
})

export default create
