import Filter from 'ansi-to-html'
import ViewConsoleOutputEntry from './ViewConsoleOutputEntry.vue'

const htmlSelector = '[data-type=html]'

describe('ViewConsoleOutputEntry', () => {
  it('test html entry', () => {
    const now = new Date().toISOString()
    const content = new Filter().toHtml(`\x1B[33m${now}\x1B[0m`)
    const container = cy.mount(
      <ViewConsoleOutputEntry
        task-name="test/html"
        type="stderr"
        time={Date.now()}
        content={content}
      />,
    ).get(htmlSelector)
    container.should('exist')
    container.children('span').then((c) => {
      expect(c, 'the message has the correct message').to.have.text(now)
      expect(c, 'the message has the correct text color').to.have.attr('style', 'color:#A50')
    })
  })
})
