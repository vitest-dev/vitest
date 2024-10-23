import Filter from 'ansi-to-html'
import { describe, expect, it } from 'vitest'
import { render } from '~/test'
import ViewConsoleOutputEntry from './ViewConsoleOutputEntry.vue'

describe('ViewConsoleOutputEntry', () => {
  it('test html entry', () => {
    const now = new Date().toISOString()
    const content = new Filter().toHtml(`\x1B[33m${now}\x1B[0m`)
    const { container } = render(ViewConsoleOutputEntry, {
      props: {
        taskName: 'test/html',
        type: 'stderr',
        time: Date.now(),
        content,
      },
    })

    const spans = container.querySelectorAll('span')
    expect(spans).toHaveLength(1)
    const span = spans[0]

    expect(span.textContent, 'the message has the correct message').toBe(now)
    expect(
      span.getAttribute('style'),
      'the message has the correct text color',
    ).toBe('color:#A50')
  })
})
