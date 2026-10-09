import { vi } from 'vitest'

vi.mock('./guarded', () => ({ answer: () => 'mocked' }))
