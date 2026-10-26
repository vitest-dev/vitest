import { vi } from 'vitest'

vi.mock('./src/shared', () => ({ shared: () => 'setup mock' }))
