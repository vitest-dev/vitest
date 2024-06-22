import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('virtual files should be excluded', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/test/virtual-files-fixture.test.ts'],
    coverage: { reporter: 'json' },
    config: 'fixtures/configs/vitest.config.virtual-files.ts',
  })

  expect(stdout).toContain('virtual-files-fixture.test.ts')
  expect(stdout).toContain('verify virtual files work')

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files.length).toBeGreaterThan(0)

  for (const file of files) {
    expect(file).not.toContain('virtual:')

    // Vitest in node
    expect(file).not.toContain('__x00__')
    expect(file).not.toContain('\0')

    // Vitest browser
    expect(file).not.toContain('\x00')
  }
})
