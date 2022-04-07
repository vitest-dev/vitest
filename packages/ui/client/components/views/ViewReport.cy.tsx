import ViewReport from './ViewReport.vue'
import type { File } from '#types'

const taskErrorSelector = '.task-error'

describe('ViewReport', () => {
  it('test plain stack trace', () => {
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
          stacks: [{ line: 10, column: 20, file: 'test/plain-stack-trace.ts', method: 'dummy test' }],
          message: 'Error: Transform failed with 1 error:',
        },
      },
      tasks: [],
    }
    const container = cy.mount(<ViewReport file={file} />)
      .get(taskErrorSelector)
    container.should('exist')
    container.children().then((c) => {
      c.get().forEach((e, idx) => {
        if (idx === 0) {
          expect(e.children[0].tagName, 'error contains <b> element').equals('B')
          expect(e.children[0].innerHTML, 'the <b> error element is correct').equals('Do some test')
          expect(e.innerText, 'error has the correct plain text').equals('Do some test: Error: Transform failed with 1 error:')
        }
        else {
          expect(e.children.length, 'the stack children elements is correct: stack and open in editor icon').equals(2)
          expect(e.children[0].innerHTML, 'stack has the correct message').equals(' - test/plain-stack-trace.ts:10:20')
        }
      })
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
