import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('locator error format aria', async () => {
  const result = await runBrowserTests({
    root: './fixtures/locator-error-format',
    browser: {
      locators: {
        errorFormat: 'aria',
      },
    },
  })

  const trees = result.errorTree({ project: true })
  for (const { browser } of instances) {
    const tree = trees[browser]
    expect(tree).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "not found": [
            "Cannot find element with locator: getByRole('button', { name: 'Save' })

      ARIA tree:
      - main:
        - heading "Settings" [level=1]
        - button "Cancel"",
          ],
        },
      }
    `)
  }
})

test('locator error format html', async () => {
  const result = await runBrowserTests({
    root: './fixtures/locator-error-format',
    browser: {
      locators: {
        errorFormat: 'html',
      },
    },
  })

  const trees = result.errorTree({ project: true })
  for (const { browser } of instances) {
    const tree = trees[browser]
    expect(tree).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "not found": [
            "Cannot find element with locator: getByRole('button', { name: 'Save' })

      <body>
        
          
        <main>
          
            
          <h1>
            Settings
          </h1>
          
            
          <button>
            Cancel
          </button>
          
          
        </main>
        
        
      </body>",
          ],
        },
      }
    `)
  }
})

test('locator error format all', async () => {
  const result = await runBrowserTests({
    root: './fixtures/locator-error-format',
    browser: {
      locators: {
        errorFormat: 'both',
      },
    },
  })

  const trees = result.errorTree({ project: true })
  for (const { browser } of instances) {
    const tree = trees[browser]
    expect(tree).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "not found": [
            "Cannot find element with locator: getByRole('button', { name: 'Save' })

      ARIA tree:
      - main:
        - heading "Settings" [level=1]
        - button "Cancel"

      HTML:
      <body>
        
          
        <main>
          
            
          <h1>
            Settings
          </h1>
          
            
          <button>
            Cancel
          </button>
          
          
        </main>
        
        
      </body>",
          ],
        },
      }
    `)
  }
})
