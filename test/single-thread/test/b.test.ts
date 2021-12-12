import { it } from 'vitest'
import { timeout } from './timeout'

it('timeout', () => new Promise(resolve => setTimeout(resolve, timeout)))
