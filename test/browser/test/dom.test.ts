import { beforeEach, describe, expect, test } from 'vitest'
import { page, userEvent } from '@vitest/browser/context'
import { createNode } from '#src/createNode'
import '../src/button.css'

describe('dom related activity', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

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
})
