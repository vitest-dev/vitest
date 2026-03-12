import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { editFile } from '../../test-utils'
import { instances, runBrowserTests } from './utils'

const dir = join(import.meta.dirname, '../fixtures/aria-snapshot')

test.for(instances.map(i => i.browser))('aria snapshot %s', async (browser) => {
  const testFile = join(dir, 'basic.test.ts')
  const snapshotFile = join(dir, '__snapshots__/basic.test.ts.snap')

  // clean slate — remove file snapshots and clear inline snapshots
  fs.rmSync(join(dir, '__snapshots__'), { recursive: true, force: true })
  editFile(testFile, s =>
    s.replace(/toMatchAriaInlineSnapshot\(`[^`]*`\)/g, 'toMatchAriaInlineSnapshot()'))

  // run with update: new — creates snapshots from scratch
  let result = await runBrowserTests({
    root: './fixtures/aria-snapshot',
    project: [browser],
    update: 'new',
  })
  if (browser === 'webkit') {
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "expect.element aria once": "skipped",
          "expect.element aria retry": "skipped",
          "poll aria once": "skipped",
          "toMatchAriaInlineSnapshot simple": "passed",
          "toMatchAriaSnapshot simple": "passed",
        },
      }
    `)
    expect(readFileSync(testFile, 'utf-8')).toMatchInlineSnapshot(`
      "import { expect, test, } from 'vitest'
      import { server, page } from 'vitest/browser'

      test('toMatchAriaSnapshot simple', () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
            <nav aria-label="Actions">
              <button>Save</button>
              <button>Cancel</button>
            </nav>
          </main>
        \`
        expect(document.body).toMatchAriaSnapshot()
      })

      test('toMatchAriaInlineSnapshot simple', () => {
        document.body.innerHTML = \`
          <button aria-label="User 42">Profile</button>
          <p>You have 7 notifications</p>
        \`
        expect(document.body).toMatchAriaInlineSnapshot(\`
          - button "User 42": Profile
          - paragraph: You have 7 notifications
        \`)
      })

      // NOTE: webkit async stack traces is poor. should be fixed on next playwright/webkit release.
      test.skipIf(server.browser === 'webkit')('poll aria once', async () => {
        await expect.poll(async () => {
          document.body.innerHTML = \`<p>poll once</p>\`
          return document.body
        }).toMatchAriaInlineSnapshot()
      })

      test.skipIf(server.browser === 'webkit')('expect.element aria once', async () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
            <nav data-testid="nav">
              <button>Save</button>
              <button>Cancel</button>
            </nav>
          </main>
        \`
        await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnapshot()
      })

      test.skipIf(server.browser === 'webkit')('expect.element aria retry', async () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
          </main>
        \`
        setTimeout(() => {
          document.body.innerHTML = \`
            <main>
              <h1>Dashboard</h1>
              <nav data-testid="nav">
                <button>Save</button>
                <button>Cancel</button>
              </nav>
            </main>
          \`
        }, 100)
        await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnapshot()
      })
      "
    `)
  }
  else {
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "expect.element aria once": "passed",
          "expect.element aria retry": "passed",
          "poll aria once": "passed",
          "toMatchAriaInlineSnapshot simple": "passed",
          "toMatchAriaSnapshot simple": "passed",
        },
      }
    `)
    expect(readFileSync(testFile, 'utf-8')).toMatchInlineSnapshot(`
      "import { expect, test, } from 'vitest'
      import { server, page } from 'vitest/browser'

      test('toMatchAriaSnapshot simple', () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
            <nav aria-label="Actions">
              <button>Save</button>
              <button>Cancel</button>
            </nav>
          </main>
        \`
        expect(document.body).toMatchAriaSnapshot()
      })

      test('toMatchAriaInlineSnapshot simple', () => {
        document.body.innerHTML = \`
          <button aria-label="User 42">Profile</button>
          <p>You have 7 notifications</p>
        \`
        expect(document.body).toMatchAriaInlineSnapshot(\`
          - button "User 42": Profile
          - paragraph: You have 7 notifications
        \`)
      })

      // NOTE: webkit async stack traces is poor. should be fixed on next playwright/webkit release.
      test.skipIf(server.browser === 'webkit')('poll aria once', async () => {
        await expect.poll(async () => {
          document.body.innerHTML = \`<p>poll once</p>\`
          return document.body
        }).toMatchAriaInlineSnapshot(\`- paragraph: poll once\`)
      })

      test.skipIf(server.browser === 'webkit')('expect.element aria once', async () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
            <nav data-testid="nav">
              <button>Save</button>
              <button>Cancel</button>
            </nav>
          </main>
        \`
        await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnapshot(\`
          - button: Save
          - button: Cancel
        \`)
      })

      test.skipIf(server.browser === 'webkit')('expect.element aria retry', async () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
          </main>
        \`
        setTimeout(() => {
          document.body.innerHTML = \`
            <main>
              <h1>Dashboard</h1>
              <nav data-testid="nav">
                <button>Save</button>
                <button>Cancel</button>
              </nav>
            </main>
          \`
        }, 100)
        await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnapshot(\`
          - button: Save
          - button: Cancel
        \`)
      })
      "
    `)
  }

  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`toMatchAriaSnapshot simple 1\`] = \`
    - main:
      - heading [level=1]: Dashboard
      - navigation "Actions":
        - button: Save
        - button: Cancel
    \`;
    "
  `)

  // run with update: none — all should pass
  const result2 = await runBrowserTests({
    root: './fixtures/aria-snapshot',
    project: [browser],
    update: 'none',
  })
  expect(result2.stderr).toEqual(result.stderr)
  expect(result2.errorTree()).toEqual(result.errorTree())

  // edit snapshots to add regex patterns, run with none — should still pass
  // file snapshot: "Actions" -> /Actions/
  editFile(snapshotFile, s => s.replace('"Actions"', '/A\\\\w+/'))
  // inline snapshot: "User 42" -> /User \d+/
  editFile(testFile, s => s.replace('- button "User 42"', '- button /User \\\\d+/'))

  const result3 = await runBrowserTests({
    root: './fixtures/aria-snapshot',
    project: [browser],
    update: 'none',
  })
  expect(result3.stderr).toEqual(result.stderr)
  expect(result3.errorTree()).toEqual(result.errorTree())

  // edit test HTML to break a literal match, run with none — should fail
  editFile(testFile, s => s.replace(`aria-label="Actions"`, `aria-label="EDITED"`))
  editFile(testFile, s => s.replace('<p>You have 7 notifications</p>', '<p>You have EDITED</p>'))

  result = await runBrowserTests({
    root: './fixtures/aria-snapshot',
    project: [browser],
    update: 'none',
  })
  if (browser === 'webkit') {
    expect(result.errorTree({ stackTrace: true })).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "expect.element aria once": "skipped",
          "expect.element aria retry": "skipped",
          "poll aria once": "skipped",
          "toMatchAriaInlineSnapshot simple": [
            "Snapshot \`toMatchAriaInlineSnapshot simple 1\` mismatched
          at basic.test.ts:22:50",
          ],
          "toMatchAriaSnapshot simple": [
            "Snapshot \`toMatchAriaSnapshot simple 1\` mismatched
          at basic.test.ts:14:44",
          ],
        },
      }
    `)
  }
  else {
    expect(result.errorTree({ stackTrace: true })).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "expect.element aria once": "passed",
          "expect.element aria retry": "passed",
          "poll aria once": "passed",
          "toMatchAriaInlineSnapshot simple": [
            "Snapshot \`toMatchAriaInlineSnapshot simple 1\` mismatched
          at basic.test.ts:22:24",
          ],
          "toMatchAriaSnapshot simple": [
            "Snapshot \`toMatchAriaSnapshot simple 1\` mismatched
          at basic.test.ts:14:24",
          ],
        },
      }
    `)
  }

  // run with update: all — should pass, preserve regex, update mismatched literal
  result = await runBrowserTests({
    root: './fixtures/aria-snapshot',
    project: [browser],
    update: 'all',
  })
  if (browser === 'webkit') {
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "expect.element aria once": "skipped",
          "expect.element aria retry": "skipped",
          "poll aria once": "skipped",
          "toMatchAriaInlineSnapshot simple": "passed",
          "toMatchAriaSnapshot simple": "passed",
        },
      }
    `)
    expect(readFileSync(testFile, 'utf-8')).toMatchInlineSnapshot(`
      "import { expect, test, } from 'vitest'
      import { server, page } from 'vitest/browser'

      test('toMatchAriaSnapshot simple', () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
            <nav aria-label="EDITED">
              <button>Save</button>
              <button>Cancel</button>
            </nav>
          </main>
        \`
        expect(document.body).toMatchAriaSnapshot()
      })

      test('toMatchAriaInlineSnapshot simple', () => {
        document.body.innerHTML = \`
          <button aria-label="User 42">Profile</button>
          <p>You have EDITED</p>
        \`
        expect(document.body).toMatchAriaInlineSnapshot(\`
          - button /User \\\\d+/: Profile
          - paragraph: You have EDITED
        \`)
      })

      // NOTE: webkit async stack traces is poor. should be fixed on next playwright/webkit release.
      test.skipIf(server.browser === 'webkit')('poll aria once', async () => {
        await expect.poll(async () => {
          document.body.innerHTML = \`<p>poll once</p>\`
          return document.body
        }).toMatchAriaInlineSnapshot()
      })

      test.skipIf(server.browser === 'webkit')('expect.element aria once', async () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
            <nav data-testid="nav">
              <button>Save</button>
              <button>Cancel</button>
            </nav>
          </main>
        \`
        await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnapshot()
      })

      test.skipIf(server.browser === 'webkit')('expect.element aria retry', async () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
          </main>
        \`
        setTimeout(() => {
          document.body.innerHTML = \`
            <main>
              <h1>Dashboard</h1>
              <nav data-testid="nav">
                <button>Save</button>
                <button>Cancel</button>
              </nav>
            </main>
          \`
        }, 100)
        await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnapshot()
      })
      "
    `)
  }
  else {
    expect(result.stderr).toMatchInlineSnapshot(`""`)
    expect(result.errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "expect.element aria once": "passed",
          "expect.element aria retry": "passed",
          "poll aria once": "passed",
          "toMatchAriaInlineSnapshot simple": "passed",
          "toMatchAriaSnapshot simple": "passed",
        },
      }
    `)
    expect(readFileSync(testFile, 'utf-8')).toMatchInlineSnapshot(`
      "import { expect, test, } from 'vitest'
      import { server, page } from 'vitest/browser'

      test('toMatchAriaSnapshot simple', () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
            <nav aria-label="EDITED">
              <button>Save</button>
              <button>Cancel</button>
            </nav>
          </main>
        \`
        expect(document.body).toMatchAriaSnapshot()
      })

      test('toMatchAriaInlineSnapshot simple', () => {
        document.body.innerHTML = \`
          <button aria-label="User 42">Profile</button>
          <p>You have EDITED</p>
        \`
        expect(document.body).toMatchAriaInlineSnapshot(\`
          - button /User \\\\d+/: Profile
          - paragraph: You have EDITED
        \`)
      })

      // NOTE: webkit async stack traces is poor. should be fixed on next playwright/webkit release.
      test.skipIf(server.browser === 'webkit')('poll aria once', async () => {
        await expect.poll(async () => {
          document.body.innerHTML = \`<p>poll once</p>\`
          return document.body
        }).toMatchAriaInlineSnapshot(\`- paragraph: poll once\`)
      })

      test.skipIf(server.browser === 'webkit')('expect.element aria once', async () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
            <nav data-testid="nav">
              <button>Save</button>
              <button>Cancel</button>
            </nav>
          </main>
        \`
        await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnapshot(\`
          - button: Save
          - button: Cancel
        \`)
      })

      test.skipIf(server.browser === 'webkit')('expect.element aria retry', async () => {
        document.body.innerHTML = \`
          <main>
            <h1>Dashboard</h1>
          </main>
        \`
        setTimeout(() => {
          document.body.innerHTML = \`
            <main>
              <h1>Dashboard</h1>
              <nav data-testid="nav">
                <button>Save</button>
                <button>Cancel</button>
              </nav>
            </main>
          \`
        }, 100)
        await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnapshot(\`
          - button: Save
          - button: Cancel
        \`)
      })
      "
    `)
  }
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`toMatchAriaSnapshot simple 1\`] = \`
    - main:
      - heading [level=1]: Dashboard
      - navigation "EDITED":
        - button: Save
        - button: Cancel
    \`;
    "
  `)
})
