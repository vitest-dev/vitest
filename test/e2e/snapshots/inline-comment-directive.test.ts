import fs from 'node:fs'
import { join } from 'pathe'
import { expect, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

// Regression for the greedy comment-skip in the inline-snapshot updater
// regexes (packages/snapshot/src/port/inlineSnapshot.ts). With multiple
// `toMatchInlineSnapshot(/* … */)` calls carrying block-comment directives
// in one file, the greedy `\/\*[\s\S]*\*\/` matched from the FIRST `/*` to
// the LAST `*/`, so every earlier call's write coalesced onto the last
// call's location. On update only the last snapshot was written, mangled
// (`/* HTML */`"alpha"``"beta"``"gamma"`), and the earlier calls were left
// empty — silently. The fix makes the comment-skip lazy (`[\s\S]*?`).

test('multiple block-comment directives each get written on update', async () => {
  const root = join(import.meta.dirname, 'fixtures/inline-multiple-calls')
  const testFile = join(root, 'comment-directive.test.ts')

  // reset: clear each snapshot to the empty `(/* HTML */)` form that triggers
  // the bug, keeping its directive
  editFile(testFile, s =>
    s.replace(/toMatchInlineSnapshot\(\/\* HTML \*\/`[^`]*`\)/g, 'toMatchInlineSnapshot(/* HTML */)'))

  const vitest = await runVitest({ root, include: [testFile], update: true })
  expect(vitest.stderr).toBe('')

  // Each call gets its own snapshot, on its own line. Pre-fix, only the last
  // (`gamma`) landed — and mangled — while `alpha`/`beta` stayed empty.
  const content = fs.readFileSync(testFile, 'utf-8')
  expect(content).toContain('toMatchInlineSnapshot(/* HTML */`"alpha"`)')
  expect(content).toContain('toMatchInlineSnapshot(/* HTML */`"beta"`)')
  expect(content).toContain('toMatchInlineSnapshot(/* HTML */`"gamma"`)')
})
