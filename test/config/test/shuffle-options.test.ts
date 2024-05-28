import type { InlineConfig } from 'vitest'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

function run(sequence: InlineConfig['sequence']) {
  return runVitest({
    sequence,
    include: [],
  })
}

class CustomSequencer {
  sort() {
    return []
  }

  shard() {
    return []
  }
}

test.each([
  false,
  { files: false, tests: false },
  { files: false, tests: true },
],
)('should use BaseSequencer if shuffle is %o', async (shuffle) => {
  const { ctx } = await run({ shuffle })
  expect(ctx?.config.sequence.sequencer.name).toBe('BaseSequencer')
})

test.each([
  true,
  { files: true, tests: false },
  { files: true, tests: true },
])('should use RandomSequencer if shuffle is %o', async (shuffle) => {
  const { ctx } = await run({ shuffle })
  expect(ctx?.config.sequence.sequencer.name).toBe('RandomSequencer')
})

test.each([
  false,
  true,
  { files: true, tests: false },
  { files: true, tests: true },
])('should always use CustomSequencer if passed', async (shuffle) => {
  const { ctx } = await run({ shuffle, sequencer: CustomSequencer })
  expect(ctx?.config.sequence.sequencer.name).toBe('CustomSequencer')
})
