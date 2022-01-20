import TestFilesEntry from './TestFilesEntry.vue'

const entrySelector = '[data-testid=test-files-entry]'
const numFilesSelector = '[data-testid=num-files]'
const timingSelector = '[data-testid=run-time]'

describe('TestFilesEntry', () => {
  it('renders the headers', () => {
    cy.mount(<TestFilesEntry/>)
      .get(entrySelector)
      .should('contain.text', 'Files')
      .and('contain.text', 'Time')

      // Empty state
      .get(timingSelector)
      .should('have.text', '0ms')
      .get(numFilesSelector)
      .should('have.text', '0')
  })
})
