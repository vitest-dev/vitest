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

it('expect.element advances fake timers while waiting for the element', async () => {
  vi.useFakeTimers()

  setTimeout(() => {
    const button = document.createElement('button')
    button.textContent = 'Expect me!'
    document.body.append(button)
  }, 100)

  await expect.element(page.getByRole('button', { name: 'Expect me!' })).toBeInTheDocument()
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

it('userEvent.pointer advances fake timers while waiting for the target', async () => {
  vi.useFakeTimers()

  const onClick = vi.fn()
  setTimeout(() => {
    const button = document.createElement('button')
    button.textContent = 'Point me!'
    button.addEventListener('click', onClick)
    document.body.append(button)
  }, 100)

  await userEvent.pointer({
    keys: '[MouseLeft]',
    target: page.getByRole('button', { name: 'Point me!' }),
  })
  expect(onClick).toHaveBeenCalledTimes(1)
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

it('does not advance fake timers past the action timeout', async () => {
  vi.useFakeTimers()

  setTimeout(() => {
    const button = document.createElement('button')
    button.textContent = 'Too late'
    document.body.append(button)
  }, 5000)

  const button = page.getByRole('button', { name: 'Too late' })
  await expect(button.click({ timeout: 100 })).rejects.toThrow('Timeout 100ms exceeded')
  expect(vi.getTimerCount()).toBe(1)
  await expect(button.findElement({ timeout: 100 })).rejects.toThrow('Cannot find element')
  expect(vi.getTimerCount()).toBe(1)
  await expect(expect.element(button, { timeout: 100 }).toBeInTheDocument()).rejects.toThrow()
  expect(vi.getTimerCount()).toBe(1)
})
