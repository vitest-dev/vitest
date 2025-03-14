import { describe, expect, it } from 'vitest'
import { render } from './utils'

describe('.toHaveAccessibleDescription', () => {
  it('works with the link title attribute', () => {
    const {queryByTestId} = render(`
      <div>
        <a data-testid="link" href="/" aria-label="Home page" title="A link to start over">Start</a>
        <a data-testid="extra-link" href="/about" aria-label="About page">About</a>
      </div>
   `)

    const link = queryByTestId('link')
    expect(link).toHaveAccessibleDescription()
    expect(link).toHaveAccessibleDescription('A link to start over')
    expect(link).not.toHaveAccessibleDescription('Home page')
    expect(() => {
      expect(link).toHaveAccessibleDescription('Invalid description')
    }).toThrow(/expected element to have accessible description/i)
    expect(() => {
      expect(link).not.toHaveAccessibleDescription()
    }).toThrow(/expected element not to have accessible description/i)

    const extraLink = queryByTestId('extra-link')
    expect(extraLink).not.toHaveAccessibleDescription()
    expect(() => {
      expect(extraLink).toHaveAccessibleDescription()
    }).toThrow(/expected element to have accessible description/i)
  })

  it('works with aria-describedby attributes', () => {
    const {queryByTestId} = render(`
      <div>
        <img src="avatar.jpg" data-testid="avatar" alt="User profile pic">
        <img src="logo.jpg" data-testid="logo" alt="Company logo" aria-describedby="t1">
        <span id="t1" role="presentation">The logo of Our Company</span>
      </div>
   `)

    const avatar = queryByTestId('avatar')
    expect(avatar).not.toHaveAccessibleDescription()
    expect(() => {
      expect(avatar).toHaveAccessibleDescription('User profile pic')
    }).toThrow(/expected element to have accessible description/i)

    const logo = queryByTestId('logo')
    expect(logo).not.toHaveAccessibleDescription('Company logo')
    expect(logo).toHaveAccessibleDescription('The logo of Our Company')
    expect(logo).toHaveAccessibleDescription(/logo of our company/i)
    expect(logo).toHaveAccessibleDescription(
      expect.stringContaining('logo of Our Company'),
    )
    expect(() => {
      expect(logo).toHaveAccessibleDescription("Our company's logo")
    }).toThrow(/expected element to have accessible description/i)
    expect(() => {
      expect(logo).not.toHaveAccessibleDescription('The logo of Our Company')
    }).toThrow(/expected element not to have accessible description/i)
  })

  it('works with aria-description attribute', () => {
    const {queryByTestId} = render(`
      <img src="logo.jpg" data-testid="logo" alt="Company logo" aria-description="The logo of Our Company">
   `)

    const logo = queryByTestId('logo')
    expect(logo).not.toHaveAccessibleDescription('Company logo')
    expect(logo).toHaveAccessibleDescription('The logo of Our Company')
    expect(logo).toHaveAccessibleDescription(/logo of our company/i)
    expect(logo).toHaveAccessibleDescription(
      expect.stringContaining('logo of Our Company'),
    )
    expect(() => {
      expect(logo).toHaveAccessibleDescription("Our company's logo")
    }).toThrow(/expected element to have accessible description/i)
    expect(() => {
      expect(logo).not.toHaveAccessibleDescription('The logo of Our Company')
    }).toThrow(/expected element not to have accessible description/i)
  })

  it('handles multiple ids', () => {
    const {queryByTestId} = render(`
      <div>
        <div id="first">First description</div>
        <div id="second">Second description</div>
        <div id="third">Third description</div>

        <div data-testid="multiple" aria-describedby="first second third"></div>
      </div>
  `)

    expect(queryByTestId('multiple')).toHaveAccessibleDescription(
      'First description Second description Third description',
    )
    expect(queryByTestId('multiple')).toHaveAccessibleDescription(
      /Second description Third/,
    )
    expect(queryByTestId('multiple')).toHaveAccessibleDescription(
      expect.stringContaining('Second description Third'),
    )
    expect(queryByTestId('multiple')).toHaveAccessibleDescription(
      expect.stringMatching(/Second description Third/),
    )
    expect(queryByTestId('multiple')).not.toHaveAccessibleDescription(
      'Something else',
    )
    expect(queryByTestId('multiple')).not.toHaveAccessibleDescription('First')
  })

  it('normalizes whitespace', () => {
    const {queryByTestId} = render(`
      <div id="first">
        Step
          1
            of
              4
      </div>
      <div id="second">
        And
          extra
            description
      </div>
      <div data-testid="target" aria-describedby="first second"></div>
    `)

    expect(queryByTestId('target')).toHaveAccessibleDescription(
      'Step 1 of 4 And extra description',
    )
  })
})