import type { VisualRegressionArtifact } from '@vitest/runner'
import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { page, render } from '~/test'
import VisualRegression from './VisualRegression.vue'

const diff = {
  name: 'diff',
  path: '/__diff.png',
  width: 500,
  height: 200,
} as const

const reference = {
  name: 'reference',
  path: '/__reference.png',
  width: 500,
  height: 200,
} as const

const actual = {
  name: 'actual',
  path: '/__actual.png',
  width: 500,
  height: 200,
} as const

describe('VisualRegression', () => {
  it('renders content with no attachments', async () => {
    const messageContent = faker.lorem.words(5)

    const result = render(VisualRegression, {
      props: {
        regression: {
          type: 'internal:toMatchScreenshot',
          kind: 'visual-regression',
          message: messageContent,
          attachments: [],
        } satisfies VisualRegressionArtifact,
      },
    })

    const article = page.getByRole('article')

    await expect.element(article).toBeInTheDocument()
    await expect.element(article.getByRole('heading'))
      .toHaveTextContent('Visual Regression')
    await expect.element(article.getByRole('paragraph'))
      .toHaveTextContent(messageContent)
    await expect.element(article.getByRole('tablist')).toHaveTextContent('')

    expect(result.container).toMatchAriaInlineSnapshot(`
      - article:
        - heading "Visual Regression" [level=1]
        - paragraph: /.*/
        - tablist
    `)
  })

  it('renders diff tab', async () => {
    const result = render(VisualRegression, {
      props: {
        regression: {
          type: 'internal:toMatchScreenshot',
          kind: 'visual-regression',
          message: faker.lorem.words(5),
          attachments: [diff],
        } satisfies VisualRegressionArtifact,
      },
    })

    await expect.element(page.getByRole('tablist').getByRole('tab'))
      .toHaveTextContent('Diff')
    await expect.element(page.getByRole('tabpanel').getByRole('img'))
      .toBeInTheDocument()
    expect(result.container).toMatchAriaInlineSnapshot(`
      - article:
        - heading "Visual Regression" [level=1]
        - paragraph: /.*/
        - tablist:
          - tab "Diff" [selected]
        - tabpanel "Diff":
          - link:
            - /url: /.*/
            - img
    `)
  })

  it('renders reference tab', async () => {
    render(VisualRegression, {
      props: {
        regression: {
          type: 'internal:toMatchScreenshot',
          kind: 'visual-regression',
          message: faker.lorem.words(5),
          attachments: [reference],
        } satisfies VisualRegressionArtifact,
      },
    })

    await expect.element(page.getByRole('tablist').getByRole('tab'))
      .toHaveTextContent('Reference')
    await expect.element(page.getByRole('tabpanel').getByRole('img'))
      .toBeInTheDocument()
  })

  it('renders actual tab', async () => {
    render(VisualRegression, {
      props: {
        regression: {
          type: 'internal:toMatchScreenshot',
          kind: 'visual-regression',
          message: faker.lorem.words(5),
          attachments: [actual],
        } satisfies VisualRegressionArtifact,
      },
    })

    await expect.element(page.getByRole('tablist').getByRole('tab'))
      .toHaveTextContent('Actual')
    await expect.element(page.getByRole('tabpanel').getByRole('img'))
      .toBeInTheDocument()
  })

  it('renders reference, actual, and slider tabs', async () => {
    const result = render(VisualRegression, {
      props: {
        regression: {
          type: 'internal:toMatchScreenshot',
          kind: 'visual-regression',
          message: faker.lorem.words(5),
          attachments: [reference, actual],
        } satisfies VisualRegressionArtifact,
      },
    })

    const tablist = page.getByRole('tablist')
    const tabs = tablist.getByRole('tab')

    await expect.element(tablist).toBeInTheDocument()
    expect(result.container).toMatchAriaInlineSnapshot(`
      - article:
        - heading "Visual Regression" [level=1]
        - paragraph: /.*/
        - tablist:
          - tab "Reference" [selected]
          - tab "Actual"
          - tab "Slider"
        - tabpanel "Reference":
          - link:
            - /url: /.*/
            - img
    `)

    expect(tabs.all()).toHaveLength(3)
    await expect.element(tabs.nth(0)).toHaveTextContent('Reference')
    await expect.element(tabs.nth(1)).toHaveTextContent('Actual')
    await expect.element(tabs.nth(2)).toHaveTextContent('Slider')

    await userEvent.click(tabs.nth(2))

    await expect.element(tablist.getByRole('tab', { selected: true })).toHaveTextContent('Slider')
    expect(result.container).toMatchAriaInlineSnapshot(`
      - article:
        - heading "Visual Regression" [level=1]
        - paragraph: /.*/
        - tablist:
          - tab "Reference"
          - tab "Actual"
          - tab "Slider" [selected]
        - tabpanel "Slider":
          - slider "Adjust slider to compare reference and actual images": "50"
          - status: Showing 50% reference, 50% actual
    `)
  })

  it('renders diff, reference, actual, and slider tabs', async () => {
    const result = render(VisualRegression, {
      props: {
        regression: {
          type: 'internal:toMatchScreenshot',
          kind: 'visual-regression',
          message: faker.lorem.words(5),
          attachments: [diff, reference, actual],
        } satisfies VisualRegressionArtifact,
      },
    })

    const tablist = page.getByRole('tablist')
    const tabs = tablist.getByRole('tab')

    await expect.element(tablist).toBeInTheDocument()

    expect(tabs.all()).toHaveLength(4)
    await expect.element(tabs.nth(0)).toHaveTextContent('Diff')
    await expect.element(tabs.nth(1)).toHaveTextContent('Reference')
    await expect.element(tabs.nth(2)).toHaveTextContent('Actual')
    await expect.element(tabs.nth(3)).toHaveTextContent('Slider')
    expect(result.container).toMatchAriaInlineSnapshot(`
      - article:
        - heading "Visual Regression" [level=1]
        - paragraph: /.*/
        - tablist:
          - tab "Diff" [selected]
          - tab "Reference"
          - tab "Actual"
          - tab "Slider"
        - tabpanel "Diff":
          - link:
            - /url: /.*/
            - img
    `)
  })
})
