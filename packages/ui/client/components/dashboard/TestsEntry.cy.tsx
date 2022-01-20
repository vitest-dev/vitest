import TestsEntry from './TestsEntry.vue'

const passEntrySelector = '[data-testid=pass-entry]'
const failEntrySelector = '[data-testid=fail-entry]'
const totalEntrySelector = '[data-testid=total-entry]'
const todoEntrySelector = '[data-testid=todo-entry]'
const skippedEntrySelector = '[data-testid=skipped-entry]'

describe('TestsEntry', () => {
  it('renders the headers for pass, fail, and total', () => {
    cy.mount(<TestsEntry/>)
      .get(passEntrySelector)
      .should('contain.text', 'Pass')
      .and('contain.text', '0')
      .get(failEntrySelector)
      .and('contain.text', 'Fail')
      .and('contain.text', '0')
      .get(totalEntrySelector)
      .and('contain.text', 'Total')
      .and('contain.text', '0')
  })

  it('does not render skipped and todo unless there are tests matched', () => {
    cy.mount(<TestsEntry/>)
      .get(skippedEntrySelector)
      .should('not.exist')
      .get(todoEntrySelector)
      .should('not.exist')
  })
})
