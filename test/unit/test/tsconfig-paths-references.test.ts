import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { collectReferencedPathMappings } from '../../../packages/vitest/src/node/plugins/tsconfigPathsReferences'

describe('collectReferencedPathMappings', () => {
  it('collects paths from referenced tsconfig files', () => {
    const fixtureRoot = resolve(import.meta.dirname, '../../e2e/fixtures/tsconfig-paths-split')
    const mappings = collectReferencedPathMappings(resolve(fixtureRoot, 'tsconfig.json'))

    expect(mappings).toHaveLength(1)
    expect('lib/helper'.match(mappings[0]!.pattern)).toBeTruthy()
    expect(mappings[0]!.paths[0]).toBe(resolve(fixtureRoot, 'src/lib/*'))
  })
})
