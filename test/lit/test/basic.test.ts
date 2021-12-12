/// <reference types="vitest/global.d.ts" />

import Sinon from 'sinon'

import type { IWindow } from 'happy-dom'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MyButton } from '../src/my-button'

declare global {
  interface Window extends IWindow {}
}

describe('Button with increment', async() => {
  beforeEach(async() => {
    document.body.innerHTML = '<my-button name="World"></my-button>'

    await window.happyDOM.whenAsyncComplete()
  })

  function getInsideButton(): HTMLElement | null {
    return document.body.querySelector('my-button')?.shadowRoot?.querySelector('button')
  }

  it('should increment the count on each click', () => {
    getInsideButton()?.click()
    expect(getInsideButton()?.innerText).to.contain('1')
  })

  it('should show name props', () => {
    getInsideButton()
    expect(document.body.querySelector('my-button')?.shadowRoot?.innerHTML).to.contain('World')
  })

  it('should dispatch count event on button click', () => {
    const spyClick = Sinon.spy()

    document.querySelector('my-button').addEventListener('count', spyClick)

    getInsideButton()?.click()

    expect(spyClick).to.be.toHaveBeenCalled()
  })
})
