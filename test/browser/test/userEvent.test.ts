import { beforeEach, describe, expect, test, vi } from 'vitest'
import { userEvent as _uE, server } from '@vitest/browser/context'
import '../src/button.css'

beforeEach(() => {
  // clear body
  document.body.replaceChildren()
})

const userEvent = _uE.setup()

describe('userEvent.click', () => {
  test('correctly clicks a button', async () => {
    const button = document.createElement('button')
    button.style.height = '100px'
    button.style.width = '200px'
    button.textContent = 'Click me'
    document.body.appendChild(button)
    const onClick = vi.fn()
    const dblClick = vi.fn()
    button.addEventListener('click', onClick)

    await userEvent.click(button)

    expect(onClick).toHaveBeenCalled()
    expect(dblClick).not.toHaveBeenCalled()
  })

  test('correctly doesn\'t click on a disabled button', async () => {
    const button = document.createElement('button')
    button.textContent = 'Click me'
    button.disabled = true
    document.body.appendChild(button)
    const onClick = vi.fn()
    button.addEventListener('click', onClick)

    await userEvent.click(button, {
      // playwright requires force: true to click on a disabled button
      force: true,
    })

    expect(onClick).not.toHaveBeenCalled()
  })

  test('click inside shadow dom', async () => {
    const shadowRoot = createShadowRoot()
    const button = document.createElement('button')
    button.textContent = 'Click me'
    shadowRoot.appendChild(button)

    const onClick = vi.fn()
    button.addEventListener('click', onClick)

    await userEvent.click(button)

    expect(onClick).toHaveBeenCalled()
  })

  test('clicks inside svg', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', '50')
    circle.setAttribute('cy', '50')
    circle.setAttribute('r', '40')
    svg.appendChild(circle)
    document.body.appendChild(svg)

    const onClick = vi.fn()
    circle.addEventListener('click', onClick)

    await userEvent.click(circle)

    expect(onClick).toHaveBeenCalled()
  })

  test('clicks a button with complex HTML ID', async () => {
    const container = document.createElement('div')
    // This is similar to unique IDs generated by React's useId()
    container.id = ':r3:'
    const button = document.createElement('button')
    // Use uppercase and special characters
    button.id = 'A:Button'
    button.textContent = 'Click me'
    container.appendChild(button)
    document.body.appendChild(container)

    const onClick = vi.fn()
    const dblClick = vi.fn()
    button.addEventListener('click', onClick)

    await userEvent.click(button)

    expect(onClick).toHaveBeenCalled()
    expect(dblClick).not.toHaveBeenCalled()
  })

  test.runIf(server.provider === 'playwright')('clicks with x/y coords', async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 300
    canvas.style.backgroundColor = 'pink'

    const spy = vi.fn()

    // draw a blue square in the middle of the rectangle
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d')
    // If the user clicks on the blue square, it should turn red, and vice versa
    const onClick = (event: PointerEvent) => {
      const x = event.offsetX
      const y = event.offsetY
      if (x > 150 && x < 250 && y > 100 && y < 200) {
        if (!ctx) {
          throw new Error('Canvas is not defined')
        }
        if (ctx.fillStyle === '#ff0000') {
          ctx.fillStyle = 'blue'
        }
        else {
          ctx.fillStyle = 'red'
        }

        ctx.fillRect(150, 100, 100, 100)
      }

      spy({ x, y })
    }

    canvas.addEventListener('click', onClick)
    document.body.appendChild(canvas)

    await userEvent.click(document.body, {
      position: {
        x: 200,
        y: 150,
      },
    })

    expect(spy).toHaveBeenCalledWith({
      x: 200,
      y: 150,
    })
  })
})

describe('userEvent.dblClick', () => {
  test('correctly clicks a button', async () => {
    const button = document.createElement('button')
    button.textContent = 'Click me'
    document.body.appendChild(button)
    const onClick = vi.fn()
    const dblClick = vi.fn()
    button.addEventListener('click', onClick)
    button.addEventListener('dblclick', dblClick)

    await userEvent.dblClick(button)

    expect(onClick).toHaveBeenCalledTimes(2)
    expect(dblClick).toHaveBeenCalledTimes(1)
  })

  test('correctly doesn\'t click on a disabled button', async () => {
    const button = document.createElement('button')
    button.textContent = 'Click me'
    button.disabled = true
    document.body.appendChild(button)
    const onClick = vi.fn()
    const dblClick = vi.fn()
    button.addEventListener('click', onClick)
    button.addEventListener('dblclick', dblClick)

    await userEvent.dblClick(button, {
      // playwright requires force: true to click on a disabled button
      force: true,
    })

    expect(onClick).not.toHaveBeenCalled()
    expect(dblClick).not.toHaveBeenCalled()
  })
})

describe('userEvent.tripleClick', () => {
  test('correctly clicks a button', async () => {
    const button = document.createElement('button')
    button.textContent = 'Click me'
    document.body.appendChild(button)
    const onClick = vi.fn()
    const dblClick = vi.fn()
    const tripleClick = vi.fn()
    button.addEventListener('click', onClick)
    button.addEventListener('dblclick', dblClick)
    button.addEventListener('click', tripleClick)

    await userEvent.tripleClick(button)

    expect(onClick).toHaveBeenCalledTimes(3)
    expect(dblClick).toHaveBeenCalledTimes(1)
    expect(tripleClick).toHaveBeenCalledTimes(3)
    expect(tripleClick.mock.calls.length).toBe(3)
    expect(tripleClick.mock.calls
      .map(c => c[0] as MouseEvent)
      .filter(c => c.detail === 3)).toHaveLength(1)
  })

  test('correctly doesn\'t click on a disabled button', async () => {
    const button = document.createElement('button')
    button.textContent = 'Click me'
    button.disabled = true
    document.body.appendChild(button)
    const onClick = vi.fn()
    const dblClick = vi.fn()
    const tripleClick = vi.fn()
    button.addEventListener('click', onClick)
    button.addEventListener('dblclick', dblClick)
    button.addEventListener('click', tripleClick)

    await userEvent.tripleClick(button, {
      // playwright requires force: true to click on a disabled button
      force: true,
    })

    expect(onClick).not.toHaveBeenCalled()
    expect(dblClick).not.toHaveBeenCalled()
    expect(tripleClick).not.toHaveBeenCalled()
  })
})

describe('userEvent.hover, userEvent.unhover', () => {
  test('hover, unhover works correctly', async () => {
    const target = document.createElement('div')
    target.style.width = '100px'
    target.style.height = '100px'

    let mouseEntered = false
    let pointerEntered = false

    target.addEventListener('mouseover', () => {
      mouseEntered = true
    })
    target.addEventListener('pointerenter', () => {
      pointerEntered = true
    })
    target.addEventListener('pointerleave', () => {
      pointerEntered = false
    })
    target.addEventListener('mouseout', () => {
      mouseEntered = false
    })

    document.body.appendChild(target)

    await userEvent.hover(target)

    expect(pointerEntered).toBe(true)
    expect(mouseEntered).toBe(true)

    await userEvent.unhover(target)

    expect(pointerEntered).toBe(false)
    expect(mouseEntered).toBe(false)
  })

  test.runIf(server.provider === 'playwright')('hover, unhover correctly pass options', async () => {
    interface ModifiersDetected { shift: boolean; control: boolean }
    type ModifierKeys = 'Shift' | 'Control' | 'Alt' | 'ControlOrMeta' | 'Meta'

    const hoverOptions = { modifiers: ['Shift'] as ModifierKeys[] }
    const unhoverOptions = { modifiers: ['Control'] as ModifierKeys[] }

    const target = document.createElement('div')
    target.style.width = '100px'
    target.style.height = '100px'

    let modifiersDetected: ModifiersDetected = {
      shift: false,
      control: false,
    }

    target.addEventListener('mouseover', (e) => {
      modifiersDetected.shift = e.shiftKey
      modifiersDetected.control = e.ctrlKey
    })

    target.addEventListener('mouseout', (e) => {
      modifiersDetected.shift = e.shiftKey
      modifiersDetected.control = e.ctrlKey
    })

    document.body.appendChild(target)

    await userEvent.hover(target, hoverOptions)

    expect(modifiersDetected.shift).toEqual(hoverOptions.modifiers.includes('Shift'))
    expect(modifiersDetected.control).toEqual(hoverOptions.modifiers.includes('Control'))
    modifiersDetected = { shift: false, control: false }

    await userEvent.unhover(target, unhoverOptions)

    expect(modifiersDetected.shift).toEqual(unhoverOptions.modifiers.includes('Shift'))
    expect(modifiersDetected.control).toEqual(unhoverOptions.modifiers.includes('Control'))
  })

  test('hover works with shadow root', async () => {
    const shadowRoot = createShadowRoot()
    const target = document.createElement('div')
    target.style.width = '100px'
    target.style.height = '100px'

    let mouseEntered = false
    let pointerEntered = false
    target.addEventListener('mouseover', () => {
      mouseEntered = true
    })
    target.addEventListener('pointerenter', () => {
      pointerEntered = true
    })
    target.addEventListener('pointerleave', () => {
      pointerEntered = false
    })
    target.addEventListener('mouseout', () => {
      mouseEntered = false
    })

    shadowRoot.appendChild(target)

    await userEvent.hover(target)

    expect(pointerEntered).toBe(true)
    expect(mouseEntered).toBe(true)

    await userEvent.unhover(target)

    expect(pointerEntered).toBe(false)
    expect(mouseEntered).toBe(false)
  })

  test('hover works with svg', async () => {
    const target = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', '50')
    circle.setAttribute('cy', '50')
    circle.setAttribute('r', '40')
    target.appendChild(circle)
    document.body.appendChild(target)
    target.style.width = '100px'
    target.style.height = '100px'

    let mouseEntered = false
    let pointerEntered = false
    target.addEventListener('mouseover', () => {
      mouseEntered = true
    })
    target.addEventListener('pointerenter', () => {
      pointerEntered = true
    })
    target.addEventListener('pointerleave', () => {
      pointerEntered = false
    })
    target.addEventListener('mouseout', () => {
      mouseEntered = false
    })

    document.body.appendChild(target)

    await userEvent.hover(target)

    expect(pointerEntered).toBe(true)
    expect(mouseEntered).toBe(true)

    await userEvent.unhover(target)

    expect(pointerEntered).toBe(false)
    expect(mouseEntered).toBe(false)
  })
})

const inputLike = [
  () => {
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Type here'
    return input
  },
  () => {
    const input = document.createElement('textarea')
    input.placeholder = 'Type here'
    return input
  },
  () => {
    const contentEditable = document.createElement('div')
    contentEditable.contentEditable = 'true'
    return contentEditable
  },
]

describe.each(inputLike)('userEvent.type', (getElement) => {
  test('types into an input', async () => {
    const { input, keydown, keyup, value } = createTextInput()

    await userEvent.type(input, 'Hello World!')
    expect(value()).toBe('Hello World!')
    expect(keydown).toEqual([
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
    ])
    expect(keyup).toEqual([
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
    ])
    keydown.length = 0
    keyup.length = 0

    await userEvent.type(input, '{a>3}4')
    expect(value()).toBe('Hello World!aaa4')

    await userEvent.type(input, '{backspace}')
    expect(value()).toBe('Hello World!aaa')

    // doesn't affect the input value
    await userEvent.type(input, '{/a}')
    expect(value()).toBe('Hello World!aaa')

    expect(keydown).toEqual([
      'a',
      'a',
      'a',
      '4',
      'Backspace',
    ])

    await userEvent.type(input, '{Shift}b{/Shift}')

    // this follow userEvent logic
    expect(value()).toBe('Hello World!aaab')

    await userEvent.clear(input)

    expect(value()).toBe('')
  })

  test('repeating without manual up works correctly', async () => {
    const { input, keydown, keyup, value } = createTextInput()

    const userEvent = _uE.setup()
    await userEvent.type(input, '{a>2}4')
    expect(value()).toBe('aa4')

    expect(keydown).toEqual([
      'a',
      'a',
      '4',
    ])
    // keyup is released at the end by userEvent
    expect(keyup).toEqual([
      '4',
      'a',
    ])
  })

  test('repeating with manual up works correctly', async () => {
    const { input, keydown, keyup, value } = createTextInput()

    const userEvent = _uE.setup()
    await userEvent.type(input, '{a>3/}4')
    expect(value()).toBe('aaa4')

    expect(keydown).toEqual([
      'a',
      'a',
      'a',
      '4',
    ])
    // keyup is released with "/" syntax
    expect(keyup).toEqual([
      'a',
      '4',
    ])
  })

  test('repeating with disabled up works correctly', async () => {
    const { input, keydown, keyup, value } = createTextInput()

    const userEvent = _uE.setup()
    await userEvent.type(input, '{a>3}4', {
      skipAutoClose: true,
    })
    expect(value()).toBe('aaa4')

    expect(keydown).toEqual([
      'a',
      'a',
      'a',
      '4',
    ])
    // keyup is not released at the end by userEvent
    expect(keyup).toEqual([
      '4',
    ])
  })

  test('types into a shadow root input', async () => {
    const shadowRoot = createShadowRoot()
    const { input, keydown, value } = createTextInput(shadowRoot)

    const userEvent = _uE.setup()
    await userEvent.type(input, 'Hello')
    expect(value()).toBe('Hello')
    expect(keydown).toEqual([
      'H',
      'e',
      'l',
      'l',
      'o',
    ])
  })

  // strangly enough, original userEvent doesn't support this,
  // but we can implement it
  test.skipIf(server.provider === 'preview')('selectall works correctly', async () => {
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Type here'
    document.body.appendChild(input)
    await userEvent.type(input, 'Hello World!')
    await userEvent.type(input, '{selectall}')
    await userEvent.type(input, '{backspace}')
    expect(input.value).toBe('')
  })

  function createTextInput(root: Node = document.body) {
    const input = getElement()
    const keydown: string[] = []
    const keyup: string[] = []
    input.addEventListener('keydown', (event: KeyboardEvent) => {
      keydown.push(event.key)
    })
    input.addEventListener('keyup', (event: KeyboardEvent) => {
      keyup.push(event.key)
    })
    root.appendChild(input)
    return {
      input,
      keydown,
      keyup,
      value() {
        if ('value' in input) {
          return input.value
        }
        return input.textContent
      },
    }
  }
})

describe('userEvent.tab', () => {
  test('tab correctly switches focus', async () => {
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
})

describe.each(inputLike)('userEvent.fill', async (getInput) => {
  test('correctly fills the input value', async () => {
    const input = getInput()
    document.body.appendChild(input)
    function value() {
      if ('value' in input) {
        return input.value
      }
      return input.textContent
    }

    await userEvent.fill(input, 'Hello World!')
    expect(value()).toBe('Hello World!')

    await userEvent.fill(input, 'Another Value')
    expect(value()).toBe('Another Value')
  })

  test('fill input in shadow root', async () => {
    const input = getInput()
    const shadowRoot = createShadowRoot()
    shadowRoot.appendChild(input)
    function value() {
      if ('value' in input) {
        return input.value
      }
      return input.textContent
    }

    await userEvent.fill(input, 'Hello')
    expect(value()).toBe('Hello')
  })
})

describe('userEvent.keyboard', async () => {
  test('standalone keyboard works correctly with a body in focus', async () => {
    const pressed: string[] = []
    document.addEventListener('keydown', (event) => {
      pressed.push(event.key)
    })
    expect(document.activeElement).toBe(document.body)
    await userEvent.keyboard('Hello')
    expect(pressed).toEqual([
      'H',
      'e',
      'l',
      'l',
      'o',
    ])
  })

  test('standalone keyboard works correctly with an active non-input', async () => {
    const documentKeydown: string[] = []
    const divKeydown: string[] = []
    const div = document.createElement('div')
    div.style.width = '100px'
    div.style.height = '100px'
    div.tabIndex = 0
    div.addEventListener('keydown', (event) => {
      divKeydown.push(event.key)
      event.stopPropagation()
      event.preventDefault()
    })
    document.body.appendChild(div)
    document.addEventListener('keydown', (event) => {
      documentKeydown.push(event.key)
    })
    expect(document.activeElement).toBe(document.body)
    div.focus()
    expect(document.activeElement).toBe(div)
    await userEvent.keyboard('Hello{backspace}')
    expect(documentKeydown).toEqual([])
    expect(divKeydown).toEqual([
      'H',
      'e',
      'l',
      'l',
      'o',
      'Backspace',
    ])
  })

  // looks like wdio doesn't support releasing Enter on its own
  test('should not auto release', async () => {
    const spyKeydown = vi.fn()
    const spyKeyup = vi.fn()
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.addEventListener('keydown', spyKeydown)
    button.addEventListener('keyup', spyKeyup)
    button.focus()
    await userEvent.keyboard('{Enter>}')
    expect(spyKeydown).toHaveBeenCalledOnce()
    expect(spyKeyup).not.toHaveBeenCalled()
    await userEvent.keyboard('{/Enter}')
    expect(spyKeyup).toHaveBeenCalled()
  })

  test('standalone keyboard works correctly with active input', async () => {
    const documentKeydown: string[] = []
    const inputKeydown: string[] = []
    const input = document.createElement('input')
    input.addEventListener('keydown', (event) => {
      inputKeydown.push(event.key)
      event.stopPropagation()
    })
    document.body.appendChild(input)
    document.addEventListener('keydown', (event) => {
      documentKeydown.push(event.key)
    })
    expect(document.activeElement).toBe(document.body)
    input.focus()
    expect(document.activeElement).toBe(input)

    await userEvent.keyboard('Hello{backspace}')

    expect(input.value).toBe('Hell')
    expect(documentKeydown).toEqual([])
    expect(inputKeydown).toEqual([
      'H',
      'e',
      'l',
      'l',
      'o',
      'Backspace',
    ])
  })
})

describe.skipIf(server.provider === 'preview')('userEvent.dragAndDrop', async () => {
  test('drag and drop works', async () => {
    const source = document.createElement('div')
    source.textContent = 'Drag me'
    source.style.width = '100px'
    source.style.height = '100px'
    source.style.background = 'red'
    source.draggable = true

    const dragstart = vi.fn()

    source.addEventListener('dragstart', dragstart)

    const target = document.createElement('div')
    target.style.width = '100px'
    target.style.height = '100px'
    target.style.background = 'blue'

    const dragover = vi.fn(() => {
      target.textContent = 'Dropped'
    })

    target.addEventListener('dragover', dragover)

    document.body.appendChild(source)
    document.body.appendChild(target)

    expect(target.textContent).toBe('')

    await userEvent.dragAndDrop(source, target)

    await expect.poll(() => dragstart).toHaveBeenCalled()
    await expect.poll(() => dragover).toHaveBeenCalled()

    expect(target.textContent).toBe('Dropped')
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

describe('uploading files', async () => {
  test.skipIf(server.provider === 'webdriverio')('can upload an instance of File', async () => {
    const file = new File(['hello'], 'hello.png', { type: 'image/png' })
    const input = document.createElement('input')
    input.type = 'file'
    document.body.appendChild(input)
    await userEvent.upload(input, file)
    await expect.poll(() => input.files.length).toBe(1)

    const uploadedFile = input.files[0]
    expect(uploadedFile.name).toBe('hello.png')
    expect(uploadedFile.type).toBe('image/png')
  })

  test.skipIf(server.provider === 'webdriverio')('can upload several instances of File', async () => {
    const file1 = new File(['hello1'], 'hello1.png', { type: 'image/png' })
    const file2 = new File(['hello2'], 'hello2.png', { type: 'image/png' })
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    document.body.appendChild(input)
    await userEvent.upload(input, [file1, file2])
    await expect.poll(() => input.files.length).toBe(2)

    const uploadedFile1 = input.files[0]
    expect(uploadedFile1.name).toBe('hello1.png')
    expect(uploadedFile1.type).toBe('image/png')

    const uploadedFile2 = input.files[1]
    expect(uploadedFile2.name).toBe('hello2.png')
    expect(uploadedFile2.type).toBe('image/png')
  })

  test('can upload a file by filepath relative to test file', async () => {
    const input = document.createElement('input')
    input.type = 'file'
    document.body.appendChild(input)
    await userEvent.upload(input, '../src/button.css')
    await expect.poll(() => input.files.length).toBe(1)

    const uploadedFile = input.files[0]
    expect(uploadedFile.name).toBe('button.css')
    expect(uploadedFile.type).toBe('text/css')
  })

  test('can upload several files by filepath relative to test file', async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    document.body.appendChild(input)
    await userEvent.upload(input, ['../src/button.css', '../package.json'])
    await expect.poll(() => input.files.length).toBe(2)

    const uploadedFile1 = input.files[0]
    expect(uploadedFile1.name).toBe('button.css')
    expect(uploadedFile1.type).toBe('text/css')

    const uploadedFile2 = input.files[1]
    expect(uploadedFile2.name).toBe('package.json')
    expect(uploadedFile2.type).toBe('application/json')
  })
})

function createShadowRoot() {
  const div = document.createElement('div')
  const shadowRoot = div.attachShadow({ mode: 'open' })
  document.body.appendChild(div)
  return shadowRoot
}
