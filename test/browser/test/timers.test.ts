import { afterEach, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

it('only runs a setTimeout callback once (ever)', () => {
  vi.useFakeTimers()

  const fn = vi.fn()
  setTimeout(fn, 0)
  expect(fn).toHaveBeenCalledTimes(0)

  vi.runAllTimers()
  expect(fn).toHaveBeenCalledTimes(1)

  vi.runAllTimers()
  expect(fn).toHaveBeenCalledTimes(1)
})

it('locator actions advance fake timers while waiting for the element', async () => {
  vi.useFakeTimers()

  const onClick = vi.fn()
  setTimeout(() => {
    const button = document.createElement('button')
    button.textContent = 'Click me!'
    button.addEventListener('click', onClick)
    document.body.append(button)
  }, 100)

  await page.getByRole('button', { name: 'Click me!' }).click()
  expect(onClick).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

it('locator.findElement advances fake timers while waiting for the element', async () => {
  vi.useFakeTimers()

  setTimeout(() => {
    const button = document.createElement('button')
    button.textContent = 'Find me!'
    document.body.append(button)
  }, 100)

  const element = await page.getByRole('button', { name: 'Find me!' }).findElement()
  expect(element).toHaveTextContent('Find me!')
})

it('userEvent.type advances fake timers while waiting for the element', async () => {
  vi.useFakeTimers()

  setTimeout(() => {
    const input = document.createElement('input')
    input.setAttribute('aria-label', 'Type here')
    document.body.append(input)
  }, 100)

  const input = page.getByRole('textbox', { name: 'Type here' })
  await userEvent.type(input, 'hello')
  await expect.element(input).toHaveValue('hello')
})

it('locator.wheel advances fake timers while waiting for the element', async () => {
  vi.useFakeTimers()

  const onWheel = vi.fn()
  setTimeout(() => {
    const div = document.createElement('div')
    div.textContent = 'Scroll me'
    div.addEventListener('wheel', onWheel)
    document.body.append(div)
  }, 100)

  await page.getByText('Scroll me').wheel({ direction: 'down' })
  expect(onWheel).toHaveBeenCalled()
})
