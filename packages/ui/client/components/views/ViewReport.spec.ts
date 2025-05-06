import type { File } from 'vitest'
import { faker } from '@faker-js/faker'
import { beforeEach, describe, expect, it } from 'vitest'
import { config } from '~/composables/client'
import { render, screen, within } from '~/test'
import ViewReport from './ViewReport.vue'

config.value.root = ''

const taskErrorTestId = 'task-error'
const viewReportTestId = 'view-report'
const stackRowTestId = 'stack'

function makeTextStack() {
  return {
    line: faker.number.int({ min: 0, max: 120 }),
    column: faker.number.int({ min: 0, max: 5000 }),
    // Absolute file paths
    file: faker.system.filePath(),
    method: faker.hacker.verb(),
  }
}

// 5 Stacks
const textStacks = Array.from({ length: 5 }, makeTextStack)

const diff = `
  \x1B[32m- Expected\x1B[39m
  \x1B[31m+ Received\x1B[39m
  
  \x1B[2m  Object {\x1B[22m
  \x1B[2m    "a": 1,\x1B[22m
  \x1B[32m-   "b": 2,\x1B[39m
  \x1B[31m+   "b": 3,\x1B[39m
  \x1B[2m  }\x1B[22m
`

const error = {
  name: 'Do some test',
  stacks: textStacks,
  message: 'Error: Transform failed with 1 error:',
  diff,
}

const fileWithTextStacks: File = {
  id: 'f-1',
  name: 'test/plain-stack-trace.ts',
  type: 'suite',
  mode: 'run',
  filepath: 'test/plain-stack-trace.ts',
  meta: {},
  result: {
    state: 'fail',
    errors: [error],
  },
  tasks: [],
  projectName: '',
  file: null!,
}
fileWithTextStacks.file = fileWithTextStacks

describe('ViewReport', () => {
  describe('File where stacks are in text', () => {
    beforeEach(() => {
      render(ViewReport, {
        props: {
          file: fileWithTextStacks,
        },
        attrs: {
          'data-testid': viewReportTestId,
        },
      })
    })

    it('renders all of the stacks', () => {
      const stacks = error.stacks
      const stacksElements = screen.queryAllByTestId(stackRowTestId)
      expect(stacksElements).toHaveLength(stacks.length)

      stacksElements.forEach((stack, idx) => {
        const { column, line, file: fileName } = stacks[idx]
        expect(stack.textContent).toContain(`${line}:${column}`)
        expect(stack.textContent).toContain(`- ${fileName}`)
      })
    })

    it('renders the error message', () => {
      const report = screen.getByTestId(viewReportTestId)
      expect(report.textContent).toContain(error.message)
      expect(report.textContent).toContain(error.name)
    })
  })

  it('test html stack trace without html message', () => {
    const file: File = {
      id: 'f-1',
      name: 'test/plain-stack-trace.ts',
      type: 'suite',
      mode: 'run',
      filepath: 'test/plain-stack-trace.ts',
      meta: {},
      result: {
        state: 'fail',
        errors: [
          {
            name: 'Do some test',
            stack: '\x1B[33mtest/plain-stack-trace.ts\x1B[0m',
            message: 'Error: Transform failed with 1 error:',
            diff,
          },
        ],
      },
      tasks: [],
      projectName: '',
      file: null!,
    }
    file.file = file
    const container = render(ViewReport, {
      props: { file },
    })
    const taskError = container.getByTestId(taskErrorTestId)
    const preElements = taskError.querySelectorAll('pre')
    expect(preElements).toHaveLength(1)

    expect(preElements[0].textContent, 'error has the correct plain text').toBe(
      'Do some test: Error: Transform failed with 1 error:test/plain-stack-trace.ts',
    )
    expect(
      preElements[0].children,
      'the pre container has the correct children',
    ).toHaveLength(2)

    const [bold, stack] = preElements[0].children
    expect(bold.tagName, 'error contains <b> element').toBe('B')
    expect(bold.textContent, 'the <b> error element is correct').toBe(
      'Do some test',
    )

    expect(
      stack.children,
      'the stack children elements is correct',
    ).toHaveLength(0)
    expect(stack.innerHTML, 'stack has the correct message').toBe(
      'test/plain-stack-trace.ts',
    )
    expect(
      stack.getAttribute('style'),
      'the stack has the correct text color',
    ).toBe('color:#A50')
  })

  it('test html stack trace and message', () => {
    const file: File = {
      id: 'f-1',
      name: 'test/plain-stack-trace.ts',
      type: 'suite',
      mode: 'run',
      filepath: 'test/plain-stack-trace.ts',
      meta: {},
      result: {
        state: 'fail',
        errors: [
          {
            name: 'Do some test',
            stack: '\x1B[33mtest/plain-stack-trace.ts\x1B[0m',
            message: '\x1B[44mError: Transform failed with 1 error:\x1B[0m',
            diff,
          },
        ],
      },
      tasks: [],
      projectName: '',
      file: null!,
    }
    file.file = file
    const container = render(ViewReport, {
      props: { file },
    })
    const taskError = container.getByTestId(taskErrorTestId)
    const preElements = taskError.querySelectorAll('pre')
    expect(preElements).toHaveLength(1)

    expect(preElements[0].textContent, 'error has the correct plain text').toBe(
      'Do some test: Error: Transform failed with 1 error:test/plain-stack-trace.ts',
    )
    expect(
      preElements[0].children,
      'the pre container has the correct children',
    ).toHaveLength(3)

    const [bold, error, stack] = preElements[0].children
    expect(bold.tagName, 'error contains <b> element').toBe('B')
    expect(bold.textContent, 'the <b> error element is correct').toBe(
      'Do some test',
    )

    expect(error.innerHTML, 'the error has the correct message').toBe(
      'Error: Transform failed with 1 error:',
    )
    expect(
      error.getAttribute('style'),
      'the error has the correct background color',
    ).toBe('background-color:#00A')

    expect(
      stack.children,
      'the stack children elements is correct',
    ).toHaveLength(0)
    expect(stack.innerHTML, 'stack has the correct message').toBe(
      'test/plain-stack-trace.ts',
    )
    expect(
      stack.getAttribute('style'),
      'the stack has the correct text color',
    ).toBe('color:#A50')
  })

  it('test diff display', () => {
    const component = render(ViewReport, {
      props: {
        file: fileWithTextStacks,
      },
    })

    const diffElement = within(component.getByTestId('diff'))

    expect(diffElement.getByText(/Expected/)).toBeTruthy()
    expect(diffElement.getByText(/Received/)).toBeTruthy()
    expect(diffElement.queryByText(/\\x1B/)).toBeFalsy()
  })
})
