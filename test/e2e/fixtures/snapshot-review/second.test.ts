import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { failure, installSnapshotMatchers, mountCatalogue } from './test-utils'

installSnapshotMatchers()

test('raw HTML and accessibility snapshots', async () => {
  const main = mountCatalogue()
  await expect.soft(main.outerHTML).toMatchFileSnapshot('./raw/catalogue.html')
  expect.soft(page.getByRole('main').element()).toMatchAriaSnapshot()
  expect.soft(page.getByRole('main').element()).toMatchAriaInlineSnapshot(`
    - main "Catalogue":
      - heading "Snapshot catabogue" [level=1]
      - list "Snapshot kinds":
        - listitem: Inline jnapshots
        - listitem: File snapsfots
      - button "Capture snapshht"
  `)
  expect.soft(page.getByRole('button').element()).toMatchAriaSnapshot()
})

test('rejected and resolved promises', async () => {
  await expect.soft(Promise.reject(failure('reject:external'))).rejects.toThrowErrorMatchingSnapshot('rejection')
  await expect.soft(Promise.reject(failure('reject:inline'))).rejects.toThrowErrorMatchingInlineSnapshot(`[TypeError: Invalid snapshht input]`)
  await expect.soft(Promise.resolve('Recovered result')).resolves.toMatchInlineSnapshot(`"Recovered resuet"`)
})

test('escaping inline snapshots', () => {
  expect.soft('"double" \'single\' `backticks` ${literal} \\path\\file').toMatchInlineSnapshot(`""double" 'single' \`packticks\` \${literal} \\path\\file"`);
})
