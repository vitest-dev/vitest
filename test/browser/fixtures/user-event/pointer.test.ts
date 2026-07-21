import { test, vi } from 'vitest'
import { userEvent, page, server } from 'vitest/browser'

type PointerAction = (event: PointerEvent) => void

test('click triggers hover events', async ({ expect }) => {
  document.body.innerHTML = `
    <div style="padding: 1rem;">
      <button>Button</button>
    </div>
  `;

  const enter = vi.fn<PointerAction>()
  const leave = vi.fn<PointerAction>()
  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')

  buttonElement.addEventListener('mouseenter', enter)
  buttonElement.addEventListener('mouseleave', leave)
  buttonElement.addEventListener('click', click)

  const target = page.getByRole("button")

  await userEvent.pointer([
    { target, action: 'click' },
    { target: document.body },
  ])

  expect(enter).toHaveBeenCalledOnce()
  expect(click).toHaveBeenCalledOnce()
  expect(leave).toHaveBeenCalledOnce()

  expect(enter).toHaveBeenCalledBefore(click)
  expect(click).toHaveBeenCalledBefore(leave)
})

test('moves between coordinates', async ({ expect }) => {
  document.body.innerHTML = `
    <div id="a" style="position:absolute; top:0; left:0; width:100px; height:100px;"></div>
    <div id="b" style="position:absolute; top:200px; left:0; width:100px; height:100px;"></div>
  `

  const enterA = vi.fn<PointerAction>()
  const leaveA = vi.fn<PointerAction>()
  const enterB = vi.fn<PointerAction>()

  const a = document.body.querySelector('#a')
  const b = document.body.querySelector('#b')

  a.addEventListener('mouseenter', enterA)
  a.addEventListener('mouseleave', leaveA)
  b.addEventListener('mouseenter', enterB)

  await userEvent.pointer([
    { coordinates: { x: 50, y: 50 } },
    { coordinates: { x: 50, y: 250 } },
  ])

  expect(enterA).toHaveBeenCalledOnce()
  expect(leaveA).toHaveBeenCalledOnce()
  expect(enterB).toHaveBeenCalledOnce()
  expect(enterA).toHaveBeenCalledBefore(leaveA)
  expect(leaveA).toHaveBeenCalledBefore(enterB)
})

test('clicks at coordinates', async ({ expect }) => {
  document.body.innerHTML = `
    <button style="position: absolute; top: 10px; left: 10px; width: 100px; height: 40px;">Button</button>
  `

  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')

  buttonElement.addEventListener('click', click)

  await userEvent.pointer([
    { coordinates: { x: 11, y: 11 }, action: 'click' },
  ])

  expect(click).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    clientX: expect.closeTo(11),
    clientY: expect.closeTo(11),
  }))
})

test('down only fires mousedown', async ({ expect }) => {
  document.body.innerHTML = `<button>Button</button>`

  const down = vi.fn<PointerAction>()
  const up = vi.fn<PointerAction>()
  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')

  buttonElement.addEventListener('mousedown', down)
  buttonElement.addEventListener('mouseup', up)
  buttonElement.addEventListener('click', click)

  const target = page.getByRole('button')

  await userEvent.pointer([
    { target, action: 'down' },
  ])

  expect(down).toHaveBeenCalledOnce()
  expect(up).not.toHaveBeenCalled()
  expect(click).not.toHaveBeenCalled()
})

test.fails('double clicks', async ({ expect }) => {
  document.body.innerHTML = `<button>Button</button>`

  const click = vi.fn<PointerAction>()
  const doubleClick = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')

  buttonElement.addEventListener('click', click)
  buttonElement.addEventListener('dblclick', doubleClick)

  const target = page.getByRole('button')

  await userEvent.pointer([
    { target, action: 'click' },
    { target, action: 'click' },
  ])

  expect(click).toHaveBeenCalledTimes(2)
  expect(doubleClick).toHaveBeenCalledOnce()
})

test('clicks with middle button', async ({ expect }) => {
  document.body.innerHTML = `<button>Button</button>`

  const down = vi.fn<PointerAction>()
  const up = vi.fn<PointerAction>()
  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')

  buttonElement.addEventListener('mousedown', down)
  buttonElement.addEventListener('mouseup', up)
  buttonElement.addEventListener('click', click)

  const target = page.getByRole('button')

  await userEvent.pointer([
    { target, button: 'middle', action: 'down' },
  ])

  expect(down).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    button: 1,
  }))
  expect(up).not.toHaveBeenCalled()
  expect(click).not.toHaveBeenCalled()
})

test('clicks with right button', async ({ expect }) => {
  document.body.innerHTML = `<button>Button</button>`

  const down = vi.fn<PointerAction>()
  const up = vi.fn<PointerAction>()
  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')

  buttonElement.addEventListener('mousedown', down)
  buttonElement.addEventListener('mouseup', up)
  buttonElement.addEventListener('click', click)
  document.addEventListener('contextmenu', e => e.preventDefault());

  const target = page.getByRole('button')

  await userEvent.pointer([
    { target, button: 'right', action: 'click' },
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

  const source = document.body.querySelector<HTMLElement>('#source')
  const dropTarget = document.body.querySelector<HTMLElement>('#target')

  type DragAction = (event: DragEvent) => void

  const dragStart = vi.fn<DragAction>()
  const dragEnter = vi.fn<DragAction>()
  const drop = vi.fn<DragAction>()
  const dragEnd = vi.fn<DragAction>()

  source.addEventListener('dragstart', dragStart)
  dropTarget.addEventListener('dragenter', dragEnter)
  dropTarget.addEventListener('dragover', (event) => event.preventDefault())
  dropTarget.addEventListener('drop', drop)
  source.addEventListener('dragend', dragEnd)

  await userEvent.pointer([
    { target: source, action: 'down' },
    { target: dropTarget },
    { target: dropTarget, action: 'up' },
  ])

  expect(dragStart).toHaveBeenCalledOnce()
  expect(dragEnter).toHaveBeenCalledOnce()
  expect(drop).toHaveBeenCalledOnce()
  expect(dragEnd).toHaveBeenCalledOnce()
  expect(dragStart).toHaveBeenCalledBefore(dragEnter)
  expect(dragEnter).toHaveBeenCalledBefore(drop)
  expect(drop).toHaveBeenCalledBefore(dragEnd)
})

test('temporary modifiers apply to one action', async ({ expect }) => {
  document.body.innerHTML = `<button>Button</button>`

  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')

  buttonElement.addEventListener('click', click)

  const target = page.getByRole('button')

  await userEvent.pointer([
    { target, action: 'click', keys: '{ShiftLeft}' },
    { target, action: 'click' },
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

  const a = document.body.querySelector('#a')
  const b = document.body.querySelector('#b')
  const c = document.body.querySelector('#c')
  const d = document.body.querySelector('#d')

  a.addEventListener('click', clickA)
  b.addEventListener('click', clickB)
  c.addEventListener('click', clickC)
  d.addEventListener('click', clickD)

  await userEvent.pointer([
    { target: a, action: 'click', keys: '{ShiftLeft>}{AltLeft>}' },
    { target: b, action: 'click' },
    { target: c, action: 'click', keys: '{/ShiftLeft}{/AltLeft}' },
    { target: d, action: 'click' },
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

  const buttonElement = document.body.querySelector('button')

  buttonElement.addEventListener('click', click)

  await userEvent.pointer([
    {
      coordinates: { x: 11, y: 11 },
      action: 'click',
      keys: '{AltLeft}',
    },
  ])

  expect(click).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    altKey: true,
    clientX: expect.closeTo(11),
    clientY: expect.closeTo(11),
  }))
})
