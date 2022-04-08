import faker from '@faker-js/faker'
import ViewReport from './ViewReport.vue'
import type { File } from '#types'

const taskErrorSelector = '.task-error'
const viewReportSelector = '[data-testid=view-report]'
const stackRowSelector = '[data-testid=stack]'

const makeTextStack = () => ({
  line: faker.datatype.number(120),
  column: faker.datatype.number(5000),

  // Absolute file paths
  file: faker.system.filePath(),
  method: faker.hacker.verb(),
})

// 5 Stacks
const textStacks = Array.from(new Array(5)).map(makeTextStack)

const fileWithTextStacks = {
  id: 'f-1',
  name: 'test/plain-stack-trace.ts',
  type: 'suite',
  mode: 'run',
  filepath: 'test/plain-stack-trace.ts',
  result: {
    state: 'fail',
    error: {
      name: 'Do some test',
      stacks: textStacks,
      message: 'Error: Transform failed with 1 error:',
    },
  },
  tasks: [],
}

describe('ViewReport', () => {
  describe('File where stacks are in text', () => {
    beforeEach(() => {
      cy.mount(<ViewReport file={fileWithTextStacks as File} data-testid="view-report"/>)
    })

    it('renders all of the stacks', () => {
      const stacks = fileWithTextStacks.result.error.stacks
      cy.get(stackRowSelector).should('have.length', stacks.length)
        .get(stackRowSelector)
        .each(($stack, idx) => {
          const { column, line, file: fileName } = stacks[idx]
          expect($stack).to.contain.text(`${line}:${column}`)
          expect($stack).to.contain.text(`- ${fileName}`)
        })
    })

    it('renders the error message', () => {
      cy.get(viewReportSelector)
        .should('contain.text', fileWithTextStacks.result.error.message)
        .and('contain.text', fileWithTextStacks.result.error.name)
    })
  })

  it('test html stack trace without html message', () => {
    const file: File = {
      id: 'f-1',
      name: 'test/plain-stack-trace.ts',
      type: 'suite',
      mode: 'run',
      filepath: 'test/plain-stack-trace.ts',
      result: {
        state: 'fail',
        error: {
          name: 'Do some test',
          stack: '\x1B[33mtest/plain-stack-trace.ts\x1B[0m',
          message: 'Error: Transform failed with 1 error:',
        },
      },
      tasks: [],
    }
    const container = cy.mount(<ViewReport file={file} />)
      .get(taskErrorSelector)
    container.should('exist')
    container.children('pre').then((c) => {
      expect(c.text(), 'error has the correct plain text').equals('Do some test: Error: Transform failed with 1 error:test/plain-stack-trace.ts')
      const children = c.children().get()
      expect(children.length, 'the pre container has the correct children').equals(2)
      children.forEach((e, idx) => {
        if (idx === 0) {
          expect(e.tagName, 'error contains <b> element').equals('B')
          expect(e.innerHTML, 'the <b> error element is correct').equals('Do some test')
        }
        else {
          expect(e.children.length, 'the stack children elements is correct').equals(0)
          expect(e.innerHTML, 'stack has the correct message').equals('test/plain-stack-trace.ts')
          expect(e, 'the stack has the correct text color').to.have.attr('style', 'color:#A50')
        }
      })
    })
  })
  it('test html stack trace and message', () => {
    const file: File = {
      id: 'f-1',
      name: 'test/plain-stack-trace.ts',
      type: 'suite',
      mode: 'run',
      filepath: 'test/plain-stack-trace.ts',
      result: {
        state: 'fail',
        error: {
          name: 'Do some test',
          stack: '\x1B[33mtest/plain-stack-trace.ts\x1B[0m',
          message: '\x1B[44mError: Transform failed with 1 error:\x1B[0m',
        },
      },
      tasks: [],
    }
    const container = cy.mount(<ViewReport file={file} />)
      .get(taskErrorSelector)
    container.should('exist')
    container.children('pre').then((c) => {
      expect(c.text(), 'error has the correct plain text').equals('Do some test: Error: Transform failed with 1 error:test/plain-stack-trace.ts')
      const children = c.children().get()
      expect(children.length, 'the pre container has the correct children').equals(3)
      children.forEach((e, idx) => {
        switch (idx) {
          case 0:
            expect(e.tagName, 'error contains <b> element').equals('B')
            expect(e.innerHTML, 'the <b> error element is correct').equals('Do some test')
            break
          case 1:
            expect(e.innerHTML, 'the error has the correct message').equals('Error: Transform failed with 1 error:')
            expect(e, 'the error has the correct background color').to.have.attr('style', 'background-color:#00A')
            break
          case 2:
            expect(e.children.length, 'the stack children elements is correct').equals(0)
            expect(e.innerHTML, 'stack has the correct message').equals('test/plain-stack-trace.ts')
            expect(e, 'the stack has the correct text color').to.have.attr('style', 'color:#A50')
        }
      })
    })
  })
})
