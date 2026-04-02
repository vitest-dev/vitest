import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h } from 'vue'
import { page, render } from '~/test'
import SmallTabs from './SmallTabs.vue'
import SmallTabsPane from './SmallTabsPane.vue'

function createSmallTabs(children: number) {
  return defineComponent({
    setup: () =>
      () =>
        h(
          SmallTabs,
          null,
          {
            default: () => Array.from({ length: children }, (_, i) => h(
              SmallTabsPane,
              { title: `title-${i}` },
              () => `content-${i}`,
            )),
          },
        ),
  })
}

describe('SmallTabs', () => {
  it('has accessible elements', async () => {
    const result = render(createSmallTabs(2))

    // a tablist with two elements inside
    const tablist = page.getByRole('tablist')
    const tabs = tablist.getByRole('tab')
    const firstTab = tabs.first()
    const secondTab = tabs.last()

    await expect.element(tablist).toBeInTheDocument()
    await expect.element(result.locator).toMatchAriaInlineSnapshot(`
      - tablist:
        - tab "title-0" [selected]
        - tab "title-1"
      - tabpanel "title-0": content-0
    `)
    expect(tabs.all()).toHaveLength(2)

    await expect.element(firstTab).toHaveAttribute('aria-selected', 'true')
    await expect.element(secondTab).toHaveAttribute('aria-selected', 'false')

    // two tab panels, with one hidden
    const panels = page.getByRole('tabpanel', { includeHidden: true })
    const firstPanel = panels.first()
    const secondPanel = panels.last()

    expect(panels.all()).toHaveLength(2)

    await expect.element(firstPanel).not.toHaveAttribute('hidden')
    await expect.element(secondPanel).toHaveAttribute('hidden')

    // panels should be labelled by their tab button
    await expect.element(firstPanel).toHaveAttribute(
      'aria-labelledby',
      firstTab.element().getAttribute('id'),
    )
    await expect.element(secondPanel).toHaveAttribute(
      'aria-labelledby',
      secondTab.element().getAttribute('id'),
    )

    await expect.element(firstTab).toHaveAttribute(
      'aria-controls',
      firstPanel.element().getAttribute('id'),
    )
    await expect.element(secondTab).toHaveAttribute(
      'aria-controls',
      secondPanel.element().getAttribute('id'),
    )
  })

  it('opens one panel at a time', async () => {
    const tabsLimit = 5

    const result = render(createSmallTabs(tabsLimit))

    const tabs = page.getByRole('tablist').getByRole('tab')
    const panels = page.getByRole('tabpanel', { includeHidden: true })

    for (let tabIndex = 0; tabIndex < tabsLimit; tabIndex += 1) {
      const activeTab = tabs.nth(tabIndex)
      const activePanel = panels.nth(tabIndex)

      await userEvent.click(activeTab)
      await expect.element(
        tabs.and(page.getByRole('tab', { selected: true })),
      ).toBe(activeTab.element())
      await expect.element(
        page.getByRole('tabpanel'),
      ).toBe(activePanel.element())
    }

    expect(result.container).toMatchAriaInlineSnapshot(`
      - tablist:
        - tab "title-0"
        - tab "title-1"
        - tab "title-2"
        - tab "title-3"
        - tab "title-4" [selected]
      - tabpanel "title-4": content-4
    `)
  })
})
