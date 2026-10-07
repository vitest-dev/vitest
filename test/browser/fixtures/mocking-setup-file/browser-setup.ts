import { vi } from 'vitest'

vi.mock('./source', () => ({ answer: () => 'mocked' }))
