import { describe, expect, it } from 'vitest'
import { render } from './utils'

describe('.toHaveRole', () => {
  it('matches implicit role', () => {
    const {queryByTestId} = render(`
      <div>
        <button data-testid="continue-button">Continue</button>
      </div>
    `)

    const continueButton = queryByTestId('continue-button')

    expect(continueButton).not.toHaveRole('listitem')
    expect(continueButton).toHaveRole('button')

    expect(() => {
      expect(continueButton).toHaveRole('listitem')
    }).toThrow(/expected element to have role/i)
    expect(() => {
      expect(continueButton).not.toHaveRole('button')
    }).toThrow(/expected element not to have role/i)
  })

  it('matches explicit role', () => {
    const {queryByTestId} = render(`
      <div>
        <div role="button" data-testid="continue-button">Continue</div>
      </div>
    `)

    const continueButton = queryByTestId('continue-button')

    expect(continueButton).not.toHaveRole('listitem')
    expect(continueButton).toHaveRole('button')

    expect(() => {
      expect(continueButton).toHaveRole('listitem')
    }).toThrow(/expected element to have role/i)
    expect(() => {
      expect(continueButton).not.toHaveRole('button')
    }).toThrow(/expected element not to have role/i)
  })

  it('matches multiple explicit roles', () => {
    const {queryByTestId} = render(`
      <div>
        <div role="button switch" data-testid="continue-button">Continue</div>
      </div>
    `)

    const continueButton = queryByTestId('continue-button')

    expect(continueButton).not.toHaveRole('listitem')
    expect(continueButton).toHaveRole('button')
    expect(continueButton).not.toHaveRole('switch')

    expect(() => {
      expect(continueButton).toHaveRole('listitem')
    }).toThrow(/expected element to have role/i)
    expect(() => {
      expect(continueButton).not.toHaveRole('button')
    }).toThrow(/expected element not to have role/i)
  })
})
