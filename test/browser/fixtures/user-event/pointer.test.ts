import { describe, expect, test, vi } from 'vitest'
import { userEvent, page } from 'vitest/browser'

type PointerAction = (event: PointerEvent) => void
type MouseAction = (event: MouseEvent) => void

test('click triggers hover events', async ({ expect }) => {
  document.body.innerHTML = `
    <div style="padding: 1rem;">
      <button>Button</button>
    </div>
  `;

  const enter = vi.fn<MouseAction>()
  const leave = vi.fn<MouseAction>()
  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')!

  buttonElement.addEventListener('mouseenter', enter)
  buttonElement.addEventListener('mouseleave', leave)
  buttonElement.addEventListener('click', click)

  const target = page.getByRole("button")

  await userEvent.pointer([
    { target, keys: '[MouseLeft]' },
    { target: document.body },
  ])

  expect(enter).toHaveBeenCalledOnce()
  expect(click).toHaveBeenCalledOnce()
  expect(leave).toHaveBeenCalledOnce()

  expect(enter).toHaveBeenCalledBefore(click)
  expect(click).toHaveBeenCalledBefore(leave)
})

test('click at coordinates triggers hover events', async ({ expect }) => {
  document.body.innerHTML = `
    <button style="position: absolute; top: 10px; left: 10px; width: 100px; height: 40px;">Button</button>
  `

  const enter = vi.fn<MouseAction>()
  const leave = vi.fn<MouseAction>()
  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')!

  buttonElement.addEventListener('mouseenter', enter)
  buttonElement.addEventListener('mouseleave', leave)
  buttonElement.addEventListener('click', click)

  await userEvent.pointer([
    { coords: { x: 11, y: 11 }, keys: '[MouseLeft]' },
    { target: document.body },
  ])

  expect(enter).toHaveBeenCalledOnce()
  expect(click).toHaveBeenCalledOnce()
  expect(click).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    clientX: expect.closeTo(11),
    clientY: expect.closeTo(11),
  }))

  expect(enter).toHaveBeenCalledBefore(click)
  expect(click).toHaveBeenCalledBefore(leave)
})

test('moves between coordinates', async ({ expect }) => {
  document.body.innerHTML = `
    <div id="a" style="position:absolute; top:0; left:0; width:100px; height:100px;"></div>
    <div id="b" style="position:absolute; top:200px; left:0; width:100px; height:100px;"></div>
  `

  const enterA = vi.fn<MouseAction>()
  const leaveA = vi.fn<MouseAction>()
  const enterB = vi.fn<MouseAction>()

  const a = document.body.querySelector('#a') as HTMLDivElement
  const b = document.body.querySelector('#b') as HTMLDivElement

  a.addEventListener('mouseenter', enterA)
  a.addEventListener('mouseleave', leaveA)
  b.addEventListener('mouseenter', enterB)

  await userEvent.pointer([
    { coords: { x: 50, y: 50 } },
    { coords: { x: 50, y: 250 } },
  ])

  expect(enterA).toHaveBeenCalledOnce()
  expect(leaveA).toHaveBeenCalledOnce()
  expect(enterB).toHaveBeenCalledOnce()
  expect(enterA).toHaveBeenCalledBefore(leaveA)
  expect(leaveA).toHaveBeenCalledBefore(enterB)
})

test('down only fires mousedown event', async ({ expect }) => {
  document.body.innerHTML = `<button>Button</button>`

  const down = vi.fn<MouseAction>()
  const up = vi.fn<MouseAction>()
  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')!

  buttonElement.addEventListener('mousedown', down)
  buttonElement.addEventListener('mouseup', up)
  buttonElement.addEventListener('click', click)

  const target = page.getByRole('button')

  await userEvent.pointer([
    { target, keys: '[MouseLeft>]' },
  ])

  expect(down).toHaveBeenCalledOnce()
  expect(up).not.toHaveBeenCalled()
  expect(click).not.toHaveBeenCalled()
})

test.for([
  { action: 'down', keys: '[MouseLeft>]' },
  { action: 'up', keys: '[/MouseLeft]' },
  { action: 'click', keys: '[MouseLeft]' },
] as const)('pointer $action action works with offsets', async ({ action, keys }, { expect }) => {
  document.body.innerHTML = `
    <button style="position: absolute; top: 10px; left: 10px; width: 100px; height: 40px;">Button</button>
  `

  const spy = vi.fn<(e: PointerEvent | MouseEvent) => void>()

  const buttonElement = document.body.querySelector('button')!

  buttonElement.addEventListener(action === 'click' ? 'click' : `mouse${action}`, spy)

  await userEvent.pointer([
    { target: buttonElement, coords: { x: 10, y: 10 }, keys },
  ])

  expect(spy).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    clientX: expect.closeTo(20, -2),
    clientY: expect.closeTo(20, -2),
    offsetX: expect.closeTo(10),
    offsetY: expect.closeTo(10),
  }))
})

test('multiple clicks trigger double click', async ({ expect }) => {
  document.body.innerHTML = `<button>Button</button>`

  const click = vi.fn<PointerAction>()
  const doubleClick = vi.fn<MouseAction>()

  const buttonElement = document.body.querySelector('button')!

  buttonElement.addEventListener('click', click)
  buttonElement.addEventListener('dblclick', doubleClick)

  const target = page.getByRole('button')

  await userEvent.pointer([
    { target, keys: '[MouseLeft]'.repeat(3) },
  ])

  expect(click).toHaveBeenCalledTimes(3)

  expect(click).toHaveBeenNthCalledWith(1, expect.objectContaining({ detail: 1 }))
  expect(click).toHaveBeenNthCalledWith(2, expect.objectContaining({ detail: 2 }))
  expect(click).toHaveBeenNthCalledWith(3, expect.objectContaining({ detail: 3 }))

  expect(doubleClick).toHaveBeenCalledOnce()
})

test('clicks with middle button', async ({ expect }) => {
  document.body.innerHTML = `<button>Button</button>`

  const down = vi.fn<MouseAction>()
  const up = vi.fn<MouseAction>()
  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')!

  buttonElement.addEventListener('mousedown', down)
  buttonElement.addEventListener('mouseup', up)
  buttonElement.addEventListener('click', click)

  const target = page.getByRole('button')

  await userEvent.pointer([
    { target, keys: '[MouseMiddle]' },
  ])

  expect(down).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    button: 1,
  }))
  expect(up).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    button: 1,
  }))
  expect(click).not.toHaveBeenCalled()
})

test('clicks with right button', async ({ expect }) => {
  document.body.innerHTML = `<button>Button</button>`

  const down = vi.fn<MouseAction>()
  const up = vi.fn<MouseAction>()
  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')!

  buttonElement.addEventListener('mousedown', down)
  buttonElement.addEventListener('mouseup', up)
  buttonElement.addEventListener('click', click)
  document.addEventListener('contextmenu', e => e.preventDefault());

  const target = page.getByRole('button')

  await userEvent.pointer([
    { target, keys: '[MouseRight]' },
  ])

  expect(down).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    button: 2,
  }))
  expect(up).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    button: 2,
  }))
  expect(click).not.toHaveBeenCalled()
})

test('drags and drops', async ({ expect }) => {
  document.body.innerHTML = `
    <div id="source" draggable="true" style="position: absolute; top: 0; left: 0; width: 50px; height: 50px;">Drag me</div>
    <div id="target" style="position: absolute; top: 0; left: 300px; width: 100px; height: 100px;">Drop here</div>
  `

  const DRAG_CONTENT = 'drag content'

  const source = document.body.querySelector('#source') as HTMLElement
  const dropTarget = document.body.querySelector('#target') as HTMLElement

  type DragAction = (event: DragEvent) => void

  let dragData: string | undefined

  const dragStart = vi.fn<DragAction>((event) => {
    event.dataTransfer!.setData('text/plain', DRAG_CONTENT)
  })
  const dragEnter = vi.fn<DragAction>()
  const drop = vi.fn<DragAction>((event) => {
    // retrieving the data from the mock doesn't work, so we need to save it
    dragData = event.dataTransfer!.getData('text/plain')
  })
  const dragEnd = vi.fn<DragAction>()

  source.addEventListener('dragstart', dragStart)
  dropTarget.addEventListener('dragenter', dragEnter)
  dropTarget.addEventListener('dragover', (event) => event.preventDefault())
  dropTarget.addEventListener('drop', drop)
  source.addEventListener('dragend', dragEnd)

  await userEvent.pointer([
    { target: source, keys: '[MouseLeft>]' },
    { target: dropTarget, keys: '[/MouseLeft]' },
  ])

  expect(dragStart).toHaveBeenCalledOnce()
  expect(dragEnter).toHaveBeenCalledOnce()
  expect(drop).toHaveBeenCalledOnce()
  expect(dragEnd).toHaveBeenCalledOnce()
  expect(dragStart).toHaveBeenCalledBefore(dragEnter)
  expect(dragEnter).toHaveBeenCalledBefore(drop)
  expect(drop).toHaveBeenCalledBefore(dragEnd)

  expect(dragData).toBe(DRAG_CONTENT)
})

test('temporary modifiers apply to one action', async ({ expect }) => {
  document.body.innerHTML = `<button>Button</button>`

  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')!

  buttonElement.addEventListener('click', click)

  const target = page.getByRole('button')

  await userEvent.pointer([
    { target, keys: '[ShiftLeft>][MouseLeft][/ShiftLeft]' },
    { target, keys: '[MouseLeft]' },
  ])

  expect(click).toHaveBeenCalledTimes(2)
  expect(click).toHaveBeenNthCalledWith(1, expect.objectContaining({ shiftKey: true }))
  expect(click).toHaveBeenNthCalledWith(2, expect.objectContaining({ shiftKey: false }))
})

test('persistent modifiers survive multiple actions', async ({ expect }) => {
  document.body.innerHTML = `
    <button id="a">A</button>
    <button id="b">B</button>
    <button id="c">C</button>
    <button id="d">D</button>
  `

  const clickA = vi.fn<PointerAction>()
  const clickB = vi.fn<PointerAction>()
  const clickC = vi.fn<PointerAction>()
  const clickD = vi.fn<PointerAction>()

  const a = document.body.querySelector('#a') as HTMLButtonElement
  const b = document.body.querySelector('#b') as HTMLButtonElement
  const c = document.body.querySelector('#c') as HTMLButtonElement
  const d = document.body.querySelector('#d') as HTMLButtonElement

  a.addEventListener('click', clickA)
  b.addEventListener('click', clickB)
  c.addEventListener('click', clickC)
  d.addEventListener('click', clickD)

  await userEvent.pointer([
    { target: a, keys: '[ShiftLeft>][AltLeft>][MouseLeft]' },
    { target: b, keys: '[MouseLeft]' },
    { target: c, keys: '[MouseLeft][/ShiftLeft][/AltLeft]' },
    { target: d, keys: '[MouseLeft]' },
  ])

  expect(clickA).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ shiftKey: true, altKey: true }))
  expect(clickB).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ shiftKey: true, altKey: true }))
  expect(clickC).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ shiftKey: true, altKey: true }))
  expect(clickD).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ shiftKey: false, altKey: false }))
})

test('modifiers work with coordinates', async ({ expect }) => {
  document.body.innerHTML = `
    <button style="position: absolute; top: 10px; left: 10px; width: 100px; height: 40px;">Button</button>
  `

  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')!

  buttonElement.addEventListener('click', click)

  await userEvent.pointer([
    {
      coords: { x: 11, y: 11 },
      keys: '[AltLeft>][MouseLeft][/AltLeft]',
    },
  ])

  expect(click).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    altKey: true,
    clientX: expect.closeTo(11),
    clientY: expect.closeTo(11),
  }))
})

test('keyboard-fired modifiers apply to pointer events', async ({ expect }) => {
  document.body.innerHTML = `<button>Button</button>`

  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')!

  buttonElement.addEventListener('click', click)

  const target = page.getByRole('button')


  await userEvent.keyboard('[ShiftLeft>]')
  await userEvent.pointer({ keys: '[MouseLeft]', target })
  await userEvent.keyboard('[/ShiftLeft][AltLeft>]')
  await userEvent.pointer({ keys: '[MouseLeft]', target })
  await userEvent.keyboard('[/AltLeft][MetaLeft>]')
  await userEvent.pointer({ keys: '[MouseLeft]', target })
  await userEvent.keyboard('[/MetaLeft]')

  expect(click).toHaveBeenNthCalledWith(1, expect.objectContaining({ shiftKey: true }))
  expect(click).toHaveBeenNthCalledWith(2, expect.objectContaining({ altKey: true }))
  expect(click).toHaveBeenNthCalledWith(3, expect.objectContaining({ metaKey: true }))
})

describe('keeps using previous target or coordinates', () => {
  const HTML = `<button style="position: absolute; top: 10px; left: 10px; width: 100px; height: 40px;">Button</button>`
  const TARGET = page.getByRole('button')
  const COORDS = { x: 11, y: 11 }
  const EXPECTED_COORDS_TARGET = { clientX: expect.closeTo(60), clientY: expect.closeTo(30) }
  const EXPECTED_COORDS_COORDS = { clientX: expect.closeTo(11), clientY: expect.closeTo(11) }

  test.for([
    {
      name: 'target same',
      action: async () => {
        await userEvent.pointer([
          { keys: '[MouseLeft]', target: TARGET },
          '[MouseLeft]',
        ])
      },
      expectedCoords: EXPECTED_COORDS_TARGET,
    },
    {
      name: 'target different',
      action: async () => {
        await userEvent.pointer([{ keys: '[MouseLeft]', target: TARGET }])
        await userEvent.pointer('[MouseLeft]',)
      },
      expectedCoords: EXPECTED_COORDS_TARGET,
    },
    {
      name: 'target same',
      action: async () => {
        await userEvent.pointer([
          { keys: '[MouseLeft]', coords: COORDS },
          '[MouseLeft]',
        ])
      },
      expectedCoords: EXPECTED_COORDS_COORDS,
    },
    {
      name: 'coordinates different',
      action: async () => {
        await userEvent.pointer([{ keys: '[MouseLeft]', coords: COORDS }])
        await userEvent.pointer('[MouseLeft]',)
      },
      expectedCoords: EXPECTED_COORDS_COORDS,
    },
  ])('previous target $name action', async ({ action, expectedCoords }, { expect }) => {
    document.body.innerHTML = HTML

    const click = vi.fn<PointerAction>()

    const buttonElement = document.body.querySelector('button')!
    buttonElement.addEventListener('click', click)

    await action()

    expect(click).toHaveBeenCalledTimes(2)
    expect(click).toHaveBeenNthCalledWith(1, expect.objectContaining(expectedCoords))
    expect(click).toHaveBeenNthCalledWith(2, expect.objectContaining(expectedCoords))
  })

  test.for([
    {
      name: 'coords resets previous target',
      action: async () => {
        await userEvent.pointer([
          { keys: '[MouseLeft]', target: TARGET },
          '[MouseLeft]',
          { keys: '[MouseLeft]', coords: COORDS },
        ])
      },
      expectedCalls: [
        [expect.objectContaining(EXPECTED_COORDS_TARGET)],
        [expect.objectContaining(EXPECTED_COORDS_TARGET)],
        [expect.objectContaining(EXPECTED_COORDS_COORDS)],
      ]
    },
    {
      name: 'target resets previous coords',
      action: async () => {
        await userEvent.pointer([
          { keys: '[MouseLeft]', coords: COORDS },
          '[MouseLeft]',
          { keys: '[MouseLeft]', target: TARGET },
        ])
      },
      expectedCalls: [
        [expect.objectContaining(EXPECTED_COORDS_COORDS)],
        [expect.objectContaining(EXPECTED_COORDS_COORDS)],
        [expect.objectContaining(EXPECTED_COORDS_TARGET)],
      ]
    },
  ])('$name', async ({ action, expectedCalls }, { expect }) => {
    document.body.innerHTML = HTML

    const click = vi.fn<PointerAction>()

    const buttonElement = document.body.querySelector('button')!
    buttonElement.addEventListener('click', click)

    await action()

    expect(click).toHaveBeenCalledTimes(3)
    expect(click.mock.calls).toEqual(expectedCalls)
  })
})
