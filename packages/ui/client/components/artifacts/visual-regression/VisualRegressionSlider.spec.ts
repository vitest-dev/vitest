import { describe, expect, it } from 'vitest'
import { locators, userEvent } from 'vitest/browser'
import { page, render } from '~/test'
import VisualRegressionSlider from './VisualRegressionSlider.vue'

locators.extend({
  // @ts-expect-error this gets used only in the first block which tests elements removed from the accessibility tree
  getByCSS(selector: string) {
    return selector
  },
})

const reference = {
  path: '/__reference.png',
  width: 500,
  height: 200,
}

const actual = {
  path: '/__actual.png',
  width: 500,
  height: 200,
}

const containerLabel = 'Image comparison slider showing reference and actual screenshots'
const inputLabel = 'Adjust slider to compare reference and actual images'

describe('VisualRegressionSlider', () => {
  it('renders both images with correct URLs', async () => {
    render(VisualRegressionSlider, {
      props: {
        reference,
        actual,
      },
    })

    // !!! images are hidden/removed from the accessibility tree, so we fall back to CSS selectors

    // both image tags should be rendered and contain the path
    // @ts-expect-error extended only for this block
    const images = page.getByCSS('img')
    const referenceImage = images.first()
    const actualImage = images.last()

    expect(images.all()).toHaveLength(2)

    await expect.element(referenceImage).toHaveProperty(
      'src',
      expect.stringContaining(encodeURIComponent(reference.path)),
    )
    await expect.element(actualImage).toHaveProperty(
      'src',
      expect.stringContaining(encodeURIComponent(actual.path)),
    )

    // images should be wrapped in (hidden) containers with role presentation
    // @ts-expect-error extended only for this block
    const referenceContainer = page.getByCSS('div:has(> img)').first()
    // @ts-expect-error extended only for this block
    const actualContainer = page.getByCSS('div:has(> img)').last()

    await expect.element(referenceContainer).toHaveAttribute('aria-hidden', 'true')
    await expect.element(referenceContainer).toHaveAttribute('role', 'presentation')

    await expect.element(actualContainer).toHaveAttribute('aria-hidden', 'true')
    await expect.element(actualContainer).toHaveAttribute('role', 'presentation')
  })

  it('has accessible descriptions', async () => {
    render(VisualRegressionSlider, {
      props: {
        reference,
        actual,
      },
    })

    const container = page.getByLabelText(containerLabel)
    const input = page.getByLabelText(inputLabel)
    const status = page.getByRole(
      'status',
      { hasText: 'Showing 50% reference, 50% actual' },
    )

    // container with accessible label should exist and contain input and status
    await expect.element(container).toBeInTheDocument()
    await expect.element(container).toContainElement(input)
    await expect.element(container).toContainElement(status)
    // split is an implementation detail, but in absence of VRT it's a best-effort approach to check it's working
    await expect.element(container).toHaveStyle('--split: 50%')

    // input with label should be an input and have an id
    await expect.element(input).toBeInstanceOf(HTMLInputElement)
    await expect.element(input).toHaveAttribute('id')

    // status element should exist and be connected to the input
    await expect.element(status).toBeInTheDocument()
    await expect.element(status).toHaveAttribute(
      'for',
      input.element().getAttribute('id'),
    )
  })

  it('has slider boundaries', async () => {
    render(VisualRegressionSlider, {
      props: {
        reference,
        actual,
      },
    })

    const input = page.getByLabelText(inputLabel)

    await expect.element(input).toHaveAttribute('min', '0')
    await expect.element(input).toHaveAttribute('max', '100')
    await expect.element(input).toHaveAttribute('step', '0.1')
  })

  it('updates split percentage on slider movement', async () => {
    render(VisualRegressionSlider, {
      props: {
        reference,
        actual,
      },
    })

    const container = page.getByLabelText(containerLabel)
    const input = page.getByLabelText(inputLabel)
    const status = page.getByRole('status')

    // initial state should be 50
    await expect.element(input).toHaveValue('50')
    await expect.element(container).toHaveStyle('--split: 50%')

    // keyboard interaction
    await userEvent.click(status)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight>10/}')
    await userEvent.click(status)

    await expect.element(input).toHaveValue('51')
    await expect.element(container).toHaveStyle('--split: 51%')
    await expect.element(status).toHaveTextContent('Showing 51% reference, 49% actual')

    // mouse interaction
    await userEvent.click(
      input,
      {
        position: {
          x: 1,
          y: input.element().getBoundingClientRect().height / 2,
        },
      },
    )
    await userEvent.click(status)

    await expect.element(input).toHaveValue('0')
    await expect.element(status).toHaveTextContent('Showing 0% reference, 100% actual')
    await expect.element(container).toHaveStyle('--split: 0%')
  })
})
