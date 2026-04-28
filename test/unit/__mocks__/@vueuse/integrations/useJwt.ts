import { vi } from 'vitest'
import { ref } from 'vue'

export const useJwt = vi.fn(() => ({
  payload: ref({
    sub: 'login',
    given_name: 'firstName',
    family_name: 'lastName',
    name: 'completeName',
    email: 'email',
  }),
}))
