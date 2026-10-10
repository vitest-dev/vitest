import { vi } from 'vitest'

vi.mock('./src/setup-automock')
vi.mock('./src/setup-factory', () => ({ source: () => 'factory' }))
