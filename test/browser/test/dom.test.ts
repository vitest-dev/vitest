import { beforeEach, describe, expect, test } from 'vitest'
import { page, server, userEvent } from '@vitest/browser/context'
import { createNode } from '#src/createNode'
import '../src/button.css'

beforeEach(() => {
  document.body.replaceChildren()
})

describe('dom related activity', () => {
  test('renders div', async () => {
    document.body.style.background = '#f3f3f3'
    const wrapper = document.createElement('div')
    wrapper.className = 'wrapper'
    document.body.appendChild(wrapper)
    const div = createNode()
    wrapper.appendChild(div)
    expect(div.textContent).toBe('Hello World!')
    const screenshotPath = await page.screenshot({
      element: wrapper,
    })
    expect(screenshotPath).toMatch(/__screenshots__\/dom.test.ts\/dom-related-activity-renders-div-1.png/)
  })

  test('hover works correctly', async () => {
    const target = document.createElement('div')
    target.style.width = '100px'
    target.style.height = '100px'

    let hovered = false
    target.addEventListener('mouseover', () => {
      hovered = true
    })
    target.addEventListener('mouseout', () => {
      hovered = false
    })

    document.body.appendChild(target)

    await userEvent.hover(target)

    expect(hovered).toBe(true)

    await userEvent.unhover(target)

    expect(hovered).toBe(false)
  })

  test('types into an input', async () => {
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Type here'
    const pressed: string[] = []
    input.addEventListener('keydown', (event) => {
      pressed.push(event.key)
    })
    document.body.appendChild(input)
    await userEvent.type(input, 'Hello World!')
    expect(input.value).toBe('Hello World!')

    await userEvent.type(input, '{a>3}4')
    expect(input.value).toBe('Hello World!aaa4')

    await userEvent.type(input, '{backspace}')
    expect(input.value).toBe('Hello World!aaa')

    // doesn't affect the input value
    await userEvent.type(input, '{/a}')
    expect(input.value).toBe('Hello World!aaa')

    expect(pressed).toEqual([
      'H',
      'e',
      'l',
      'l',
      'o',
      ' ',
      'W',
      'o',
      'r',
      'l',
      'd',
      '!',
      'a',
      'a',
      'a',
      '4',
      'Backspace',
    ])

    await userEvent.type(input, '{Shift}b{/Shift}')

    // this follow userEvent logic
    expect(input.value).toBe('Hello World!aaab')

    await userEvent.clear(input)

    expect(input.value).toBe('')
  })

  test('selectall works correctly', async () => {
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Type here'
    document.body.appendChild(input)
    await userEvent.type(input, 'Hello World!')
    await userEvent.type(input, '{selectall}')
    await userEvent.type(input, '{backspace}')
    expect(input.value).toBe('')
  })

  test('tab works correctly', async () => {
    const input1 = document.createElement('input')
    input1.type = 'text'
    const input2 = document.createElement('input')
    input2.type = 'text'
    document.body.appendChild(input1)
    document.body.appendChild(input2)

    input1.focus()
    await userEvent.tab()

    expect(document.activeElement).toBe(input2)

    await userEvent.tab({ shift: true })

    expect(document.activeElement).toBe(input1)
  })

  test('standalone keyboard works correctly', async () => {
    const pressed: string[] = []
    document.addEventListener('keydown', (event) => {
      pressed.push(event.key)
    })
    await userEvent.keyboard('Hello')
    expect(pressed).toEqual([
      'H',
      'e',
      'l',
      'l',
      'o',
    ])
  })

  test('standalone keyboard work correctly with focused input', async () => {
    const input = document.createElement('input')
    input.type = 'text'
    document.body.appendChild(input)
    input.focus()
    await userEvent.keyboard('Hello')
    expect(input.value).toBe('Hello')
  })

  test('drag and drop works', async () => {
    const source = document.createElement('div')
    source.textContent = 'Drag me'
    source.style.width = '100px'
    source.style.height = '100px'
    source.style.background = 'red'
    source.draggable = true

    let dragData = ''

    source.addEventListener('dragstart', () => {
      dragData = source.textContent
    })

    const target = document.createElement('div')
    target.style.width = '100px'
    target.style.height = '100px'
    target.style.background = 'blue'

    target.addEventListener('dragover', () => {
      target.textContent = dragData
    })

    document.body.appendChild(source)
    document.body.appendChild(target)

    expect(target.textContent).toBe('')

    await userEvent.dragAndDrop(source, target)

    expect(target.textContent).toBe('Drag me')
  })
})

describe.each([
  [
    'select',
    function createSelect() {
      const select = document.createElement('select')
      const option1 = document.createElement('option')
      option1.value = '1'
      option1.textContent = 'Option 1'
      const option2 = document.createElement('option')
      option2.value = '2'
      option2.textContent = 'Option 2'
      select.appendChild(option1)
      select.appendChild(option2)
      document.body.appendChild(select)

      return { select, options: [option1, option2] }
    },
  ],
  // TODO: support listbox
  // [
  //   'listbox',
  //   function createSelect() {
  //     const select = document.createElement('div')
  //     select.setAttribute('role', 'listbox')
  //     const option1 = document.createElement('div')
  //     option1.setAttribute('role', 'option')
  //     // option1.value = '1'
  //     option1.textContent = 'Option 1'
  //     const option2 = document.createElement('div')
  //     option2.setAttribute('role', 'option')
  //     // option2.value = '2'
  //     option2.textContent = 'Option 2'
  //     select.appendChild(option1)
  //     select.appendChild(option2)
  //     document.body.appendChild(select)

  //     return { select, options: [option1, option2] }
  //   },
  // ],
])('selectOptions in "%s" works correctly', (_, createSelect) => {
  test('can select a single primitive value', async () => {
    const { select } = createSelect()

    await userEvent.selectOptions(select, '2')

    expect(select.value).toBe('2')
  })

  test('can select a single primitive value by label', async () => {
    const { select } = createSelect()

    await userEvent.selectOptions(select, 'Option 2')

    expect(select.value).toBe('2')
  })

  test('can select a single element value', async () => {
    const { select, options } = createSelect()

    await userEvent.selectOptions(select, options[1])

    expect(select.value).toBe('2')
  })

  // webdriverio doesn't support selecting multiple values
  describe.skipIf(server.provider === 'webdriverio')('multiple values', () => {
    test('can select multiple values', async () => {
      const { select, options } = createSelect()
      select.multiple = true

      await userEvent.selectOptions(select, ['1', '2'])

      const selected = document.querySelectorAll('option:checked')

      expect(selected).toHaveLength(2)
      expect(selected[0]).toBe(options[0])
      expect(selected[1]).toBe(options[1])
    })

    test('can select multiple values by label', async () => {
      const { select, options } = createSelect()
      select.multiple = true

      await userEvent.selectOptions(select, ['Option 1', 'Option 2'])

      const selected = document.querySelectorAll('option:checked')

      expect(selected).toHaveLength(2)
      expect(selected[0]).toBe(options[0])
      expect(selected[1]).toBe(options[1])
    })

    test('can select multiple element values', async () => {
      const { select, options } = createSelect()
      select.multiple = true

      await userEvent.selectOptions(select, options)

      const selected = document.querySelectorAll('option:checked')

      expect(selected).toHaveLength(2)
      expect(selected[0]).toBe(options[0])
      expect(selected[1]).toBe(options[1])
    })
  })
})
