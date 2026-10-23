import { relative, resolve } from 'pathe'
import { exec } from 'tinyexec'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../../test-utils'

const BASE_PATH = '../../fixtures/snapshot-review'
const FAILED_TESTS = 25

const fixture = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../fixtures/snapshot-review/**', { eager: true, query: '?raw' }) as Record<
      string,
      { default: string }
    >,
  ).map(([key, { default: content }]) => [relative(BASE_PATH, key), content]),
)

test('updates accepted snapshots', async ({ signal }) => {
  const { errorTree, fs, vitest } = await runInlineTests(fixture, {
    update: 'none',
    watch: true,
  })

  expect(errorTree({ project: true })).toMatchInlineSnapshot(`
    {
      "browser (chromium)": {
        "second.test.ts": {
          "escaping inline snapshots": [
            "Snapshot \`escaping inline snapshots 1\` mismatched",
          ],
          "raw HTML and accessibility snapshots": [
            "Snapshot \`raw HTML and accessibility snapshots 1\` mismatched",
            "Snapshot \`raw HTML and accessibility snapshots 2\` mismatched",
            "Snapshot \`raw HTML and accessibility snapshots 3\` mismatched",
            "Snapshot \`raw HTML and accessibility snapshots 4\` mismatched",
          ],
          "rejected and resolved promises": [
            "Snapshot \`rejected and resolved promises > rejection 1\` mismatched",
            "Snapshot \`rejected and resolved promises 1\` mismatched",
            "Snapshot \`rejected and resolved promises 2\` mismatched",
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
          "escaping inline snapshots": "passed",
          "raw HTML and accessibility snapshots": "passed",
          "rejected and resolved promises": "passed",
        },
      },
      "node": {
        "first.test.ts": {
          "concurrent updates use local expect: alpha": "passed",
          "concurrent updates use local expect: beta": "passed",
          "domain templates and custom snapshot composables": "passed",
          "mixed storage, property matchers, hints and counters": "passed",
          "raw formats and significant whitespace": "passed",
        },
      },
    }
  `)

  const diffs = await collectDiffs(fs, signal)

  await expect(diffs.join('\n')).toMatchFileSnapshot('./raw/snapshot-review-accepted.diff')
})

test('does not update rejected snapshots', async ({ signal }) => {
  const { vitest, errorTree, fs } = await runInlineTests(fixture, {
    update: 'none',
    watch: true,
  })
  const errors = errorTree({ project: true })

  vitest.write('i')

  for (let index = 1; index <= FAILED_TESTS; index += 1) {
    await vitest.waitForStdout(`Reviewing [${index}/${FAILED_TESTS}]`)

    vitest.write('r')
  }

  await vitest.waitForStdout('Waiting for file changes')

  expect(errorTree({ project: true })).toEqual(errors)

  const diffs = await collectDiffs(fs, signal)

  expect(diffs.filter(Boolean)).toHaveLength(0)
})

test('updates only one inline snapshot', async ({ signal }) => {
  const { vitest, fs } = await runInlineTests(fixture, {
    update: 'none',
    watch: true,
  })

  vitest.write('i')

  for (let index = 1; index <= FAILED_TESTS; index += 1) {
    await vitest.waitForStdout(`Reviewing [${index}/${FAILED_TESTS}]`)

    // first.test.ts:12 → "mixed storage, property matchers, hints and counters"
    if (index === 12) {
      vitest.write('a')
    } else {
      vitest.write('r')
    }
  }

  await vitest.waitForStdout('Tests failed. Watching for file changes')

  const diffs = await collectDiffs(fs, signal)

  expect(diffs.filter(Boolean).join('\n')).toMatchInlineSnapshot(`
    "--- <path>/first.test.ts	<timestamp>
    +++ <path>/first.test.ts	<timestamp>
    @@ -19,7 +19,7 @@
           ],
           "requestId": Any<String>,
           "status": "ready",
    -      "title": "Szapshot catalogue",
    +      "title": "Snapshot catalogue",
         }
       \`)
       await expect.soft(\`\${JSON.stringify(record('raw:json'), null, 2)}\\n\`).toMatchFileSnapshot('./raw/catalogue.json')
    "
  `)
})

const OLD_PATH = resolve(import.meta.dirname, BASE_PATH)

async function collectDiffs(
  fs: Awaited<ReturnType<typeof runInlineTests>>['fs'],
  signal: AbortSignal,
): Promise<string[]> {
  const NEW_PATH = fs.resolveFile('.')

  return Promise.all(
    Object.keys(fixture).map(async (file) => {
      const { stdout, stderr } = await exec(
        'diff',
        ['-uN', resolve(OLD_PATH, file), resolve(NEW_PATH, file)],
        { signal },
      )

      return (stdout + stderr)
        .replaceAll(OLD_PATH, '<path>')
        .replaceAll(NEW_PATH, '<path>')
        .replace(/(<path>.*?\s+).*?$/gm, '$1<timestamp>')
    }),
  )
}
