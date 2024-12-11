import { test } from 'vitest'

await new Promise(r => setTimeout(r, 500))

test('works')
