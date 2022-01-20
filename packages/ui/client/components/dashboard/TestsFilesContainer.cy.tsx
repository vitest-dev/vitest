import TestsFilesContainer from './TestsFilesContainer.vue'

const entrySelector = '[data-testid=test-files-entry]'

describe('TestsFilesContainer', () => {
  it('renders the TestEntry', () => {
    cy.mount(<TestsFilesContainer/>)
      .get(entrySelector)
      .should('be.visible')
  })
})
