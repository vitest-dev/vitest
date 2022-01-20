import faker from '@faker-js/faker'
import ViewEditor from './ViewEditor.vue'

const viewEditorSelector = '[data-testid=code-mirror]'

// TODO: stub out the rpc call in order to fully test this component
describe('ViewEditor', () => {
  it('renders codemirror with line numbers', () => {
    const file = {
      filepath: faker.system.filePath(),
      collectDuration: faker.time.recent(),
      tasks: [],
    }
    cy.mount(<ViewEditor h="200px" file={file}/>)
      .get(viewEditorSelector)
      .type(`// ${faker.git.commitSha()}{enter}`, { delay: 0 })
      .get(viewEditorSelector)
      .should('contain.text', '1')
      .and('contain.text', '2')
  })
})
