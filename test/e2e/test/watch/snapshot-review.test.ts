import { relative, resolve } from 'pathe'
import { exec } from 'tinyexec'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../../test-utils'

const BASE_PATH = '../../fixtures/snapshot-review'
const FAILED_TESTS = 47

const fixture = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../fixtures/snapshot-review/**', { eager: true, query: '?raw' }) as Record<
      string,
      { default: string }
    >,
  ).map(([key, { default: content }]) => [relative(BASE_PATH, key), content]),
)

test('updates accepted snapshots', async ({ signal }) => {
  const { vitest, errorTree, fs } = await runInlineTests(fixture, {
    update: 'none',
    watch: true,
  })

  expect(errorTree({ project: true })).toMatchInlineSnapshot(`
    {
      "browser (chromium)": {
        "second.test.ts": {
          "DOM, raw HTML and accessibility snapshots": [
            "Snapshot \`DOM, raw HTML and accessibility snapshots > DOM element 1\` mismatched",
            "Snapshot \`DOM, raw HTML and accessibility snapshots 1\` mismatched",
            "Snapshot \`DOM, raw HTML and accessibility snapshots 2\` mismatched",
            "Snapshot \`DOM, raw HTML and accessibility snapshots 3\` mismatched",
            "Snapshot \`DOM, raw HTML and accessibility snapshots 4\` mismatched",
            "Snapshot \`DOM, raw HTML and accessibility snapshots 5\` mismatched",
          ],
          "built-in values and circular references": [
            "Snapshot \`built-in values and circular references > builtins 1\` mismatched",
            "Snapshot \`built-in values and circular references 1\` mismatched",
            "Snapshot \`built-in values and circular references > cycle 1\` mismatched",
            "Snapshot \`built-in values and circular references 2\` mismatched",
          ],
          "escaping, Unicode and several inline snapshots on one source line": [
            "Snapshot \`escaping, Unicode and several inline snapshots on one source line 1\` mismatched",
            "Snapshot \`escaping, Unicode and several inline snapshots on one source line 2\` mismatched",
            "Snapshot \`escaping, Unicode and several inline snapshots on one source line 3\` mismatched",
            "Snapshot \`escaping, Unicode and several inline snapshots on one source line > escaped external companion 1\` mismatched",
          ],
          "rejected and resolved promises": [
            "Snapshot \`rejected and resolved promises > rejection 1\` mismatched",
            "Snapshot \`rejected and resolved promises 1\` mismatched",
            "Snapshot \`rejected and resolved promises 2\` mismatched",
          ],
          "runtime and configured serializers compose in nested values": [
            "Snapshot \`runtime and configured serializers compose in nested values 1\` mismatched",
            "Snapshot \`runtime and configured serializers compose in nested values > nested serializers 1\` mismatched",
            "Snapshot \`runtime and configured serializers compose in nested values 2\` mismatched",
          ],
        },
      },
      "node": {
        "first.test.ts": {
          "concurrent updates use local expect: alpha": [
            "Snapshot \`concurrent updates use local expect: alpha 1\` mismatched",
            "Snapshot \`concurrent updates use local expect: alpha 2\` mismatched",
          ],
          "concurrent updates use local expect: beta": [
            "Snapshot \`concurrent updates use local expect: beta 1\` mismatched",
            "Snapshot \`concurrent updates use local expect: beta 2\` mismatched",
          ],
          "configured serialization and unprocessed raw JSON": [
            "Snapshot \`configured serialization and unprocessed raw JSON > packet 1\` mismatched",
            "Snapshot \`configured serialization and unprocessed raw JSON 1\` mismatched",
            "Snapshot \`configured serialization and unprocessed raw JSON 2\` mismatched",
          ],
          "domain templates and custom snapshot composables": [
            "Snapshot \`domain templates and custom snapshot composables 1\` mismatched",
            "Snapshot \`domain templates and custom snapshot composables 2\` mismatched",
            "Snapshot \`domain templates and custom snapshot composables 4\` mismatched",
            "Snapshot \`domain templates and custom snapshot composables 5\` mismatched",
            "Snapshot \`domain templates and custom snapshot composables 6\` mismatched",
          ],
          "mixed storage, property matchers, hints and counters": [
            "Snapshot \`mixed storage, property matchers, hints and counters 1\` mismatched",
            "Snapshot \`mixed storage, property matchers, hints and counters 2\` mismatched",
            "Snapshot \`mixed storage, property matchers, hints and counters > masked metadata 1\` mismatched",
            "Snapshot \`mixed storage, property matchers, hints and counters 3\` mismatched",
            "Snapshot \`mixed storage, property matchers, hints and counters 4\` mismatched",
          ],
          "raw formats and significant whitespace": [
            "Snapshot \`raw formats and significant whitespace 1\` mismatched",
            "Snapshot \`raw formats and significant whitespace 2\` mismatched",
            "Snapshot \`raw formats and significant whitespace 3\` mismatched",
            "Snapshot \`raw formats and significant whitespace 4\` mismatched",
            "Snapshot \`raw formats and significant whitespace 5\` mismatched",
          ],
          "thrown errors, strings, causes and aggregate errors": [
            "Snapshot \`thrown errors, strings, causes and aggregate errors > validation 1\` mismatched",
            "Snapshot \`thrown errors, strings, causes and aggregate errors 1\` mismatched",
            "Snapshot \`thrown errors, strings, causes and aggregate errors 2\` mismatched",
            "Snapshot \`thrown errors, strings, causes and aggregate errors > caused error 1\` mismatched",
            "Snapshot \`thrown errors, strings, causes and aggregate errors 3\` mismatched",
          ],
        },
      },
    }
  `)

  vitest.write('i')

  for (let index = 1; index <= FAILED_TESTS; index += 1) {
    await vitest.waitForStdout(`Reviewing [${index}/${FAILED_TESTS}]`)

    expect.soft(vitest.stdout).toMatchSnapshot(`review-${index}-${FAILED_TESTS}`)

    vitest.write('a')
  }

  await vitest.waitForStdout('interactive review done')
  await vitest.waitForStdout('Waiting for file changes')

  expect(errorTree({ project: true })).toMatchInlineSnapshot(`
    {
      "browser (chromium)": {
        "second.test.ts": {
          "DOM, raw HTML and accessibility snapshots": "passed",
          "built-in values and circular references": "passed",
          "escaping, Unicode and several inline snapshots on one source line": "passed",
          "rejected and resolved promises": "passed",
          "runtime and configured serializers compose in nested values": "passed",
        },
      },
      "node": {
        "first.test.ts": {
          "concurrent updates use local expect: alpha": "passed",
          "concurrent updates use local expect: beta": "passed",
          "configured serialization and unprocessed raw JSON": "passed",
          "domain templates and custom snapshot composables": "passed",
          "mixed storage, property matchers, hints and counters": "passed",
          "raw formats and significant whitespace": "passed",
          "thrown errors, strings, causes and aggregate errors": "passed",
        },
      },
    }
  `)

  const paths = {
    old: resolve(import.meta.dirname, BASE_PATH),
    new: fs.resolveFile('.'),
  }
  const diffs = await Promise.all(
    Object.keys(fixture).map(async (file) => {
      const { stdout: diff } = await exec(
        'diff',
        ['-ruN', resolve(paths.old, file), resolve(paths.new, file)],
        { signal },
      )

      return diff
        .replaceAll(paths.old, '<path>')
        .replaceAll(paths.new, '<path>')
        .replace(/(<path>.*?\s+).*?$/gm, '$1<timestamp>')
    }),
  )

  await expect(diffs.join('\n')).toMatchFileSnapshot('./raw/snapshot-review.diff')
})

test('does not update accepted snapshots', async () => {
  const { vitest, errorTree } = await runInlineTests(fixture, {
    update: 'none',
    watch: true,
  })

  const errors = errorTree({ project: true })

  vitest.write('i')

  for (let index = 1; index <= FAILED_TESTS; index += 1) {
    await vitest.waitForStdout(`Reviewing [${index}/${FAILED_TESTS}]`)

    vitest.write('r')
  }

  await vitest.waitForStdout('Waiting for file changes...')

  expect(errorTree({ project: true })).toEqual(errors)
})
