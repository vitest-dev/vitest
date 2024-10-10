import { expect, test } from 'vitest'

import { runVitest } from '../../test-utils'

test('should run suites and tests concurrently unless sequential specified when sequence.concurrent is true', async () => {
  const { stderr, stdout } = await runVitest({
    root: './fixtures/sequence-concurrent',
    include: ['sequence-concurrent-true-*.test.ts'],
    sequence: {
      concurrent: true,
    },
  })

  expect(stderr).toBe('')

  expect(stdout).toContain('✓ sequence-concurrent-true-sequential.test.ts > sequential suite > first test completes first')
  expect(stdout).toContain('✓ sequence-concurrent-true-sequential.test.ts > sequential suite > second test completes second')
  expect(stdout).toContain('✓ sequence-concurrent-true-sequential.test.ts > third test completes third')
  expect(stdout).toContain('✓ sequence-concurrent-true-sequential.test.ts > last test completes last')
  expect(stdout).toContain('✓ sequence-concurrent-true-concurrent.test.ts > concurrent suite > first test completes last')
  expect(stdout).toContain('✓ sequence-concurrent-true-concurrent.test.ts > concurrent suite > second test completes third')
  expect(stdout).toContain('✓ sequence-concurrent-true-concurrent.test.ts > third test completes second')
  expect(stdout).toContain('✓ sequence-concurrent-true-concurrent.test.ts > last test completes first')
  expect(stdout).toContain('Test Files  2 passed (2)')
})

test('should run suites and tests sequentially unless concurrent specified when sequence.concurrent is false', async () => {
  const { stderr, stdout } = await runVitest({
    root: './fixtures/sequence-concurrent',
    include: ['sequence-concurrent-false-*.test.ts'],
    sequence: {
      concurrent: false,
    },
  })

  expect(stderr).toBe('')

  expect(stdout).toContain('✓ sequence-concurrent-false-sequential.test.ts > sequential suite > first test completes first')
  expect(stdout).toContain('✓ sequence-concurrent-false-sequential.test.ts > sequential suite > second test completes second')
  expect(stdout).toContain('✓ sequence-concurrent-false-sequential.test.ts > third test completes third')
  expect(stdout).toContain('✓ sequence-concurrent-false-sequential.test.ts > last test completes last')
  expect(stdout).toContain('✓ sequence-concurrent-false-concurrent.test.ts > concurrent suite > first test completes last')
  expect(stdout).toContain('✓ sequence-concurrent-false-concurrent.test.ts > concurrent suite > second test completes third')
  expect(stdout).toContain('✓ sequence-concurrent-false-concurrent.test.ts > third test completes second')
  expect(stdout).toContain('✓ sequence-concurrent-false-concurrent.test.ts > last test completes first')
  expect(stdout).toContain('Test Files  2 passed (2)')
})
