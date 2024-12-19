import { register as requireRegister } from 'tsx/cjs/api'; import { register as esmRegister } from 'tsx/esm/api'

esmRegister(); requireRegister()

// import { vi } from 'vitest'

// vi.mock('../src/global-mock', () => ({ mocked: true }))
