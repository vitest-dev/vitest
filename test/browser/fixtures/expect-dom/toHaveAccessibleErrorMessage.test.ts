import { describe, expect, it } from 'vitest'
import { render } from './utils'

describe('.toHaveAccessibleErrorMessage', () => {
  const input = 'input'
  const errorId = 'error-id'
  const error = 'This field is invalid'
  const strings = {true: String(true), false: String(false)}

  describe('Positive Test Cases', () => {
    it("Fails the test if an invalid `id` is provided for the target element's `aria-errormessage`", () => {
      const secondId = 'id2'
      const secondError = 'LISTEN TO ME!!!'

      const {queryByTestId} = render(`
        <div>
          <${input} data-testid="${input}" aria-invalid="${strings.true}" aria-errormessage="${errorId} ${secondId}" />
          <div data-testid="${errorId}" id="${errorId}" role="alert">${error}</div>
          <div data-testid="${secondId}" id="${secondId}" role="alert">${secondError}</div>
        </div>
      `)

      const field = queryByTestId('input')
      expect(() => expect(field).toHaveAccessibleErrorMessage())
        .toThrowErrorMatchingInlineSnapshot(`
        <dim>expect(</><red>element</><dim>).toHaveAccessibleErrorMessage(</><green>expected</><dim>)</>

        Expected element's \`aria-errormessage\` attribute to be empty or a single, valid ID:

        Received:
        <red>  aria-errormessage="error-id id2"</>
      `)

      // Assume the remaining error messages are the EXACT same as above
      expect(() =>
        expect(field).toHaveAccessibleErrorMessage(new RegExp(error[0])),
      ).toThrow()

      expect(() => expect(field).toHaveAccessibleErrorMessage(error)).toThrow()
      expect(() =>
        expect(field).toHaveAccessibleErrorMessage(secondError),
      ).toThrow()

      expect(() =>
        expect(field).toHaveAccessibleErrorMessage(new RegExp(secondError[0])),
      ).toThrow()
    })

    it('Fails the test if the target element is valid according to the WAI-ARIA spec', () => {
      const noAriaInvalidAttribute = 'no-aria-invalid-attribute'
      const validFieldState = 'false'
      const invalidFieldStates = [
        'true',
        '',
        'grammar',
        'spelling',
        'asfdafbasdfasa',
      ]

      function renderFieldWithState(state) {
        return render(`
          <div>
            <${input} data-testid="${input}" aria-invalid="${state}" aria-errormessage="${errorId}" />
            <div data-testid="${errorId}" id="${errorId}" role="alert">${error}</div>
            
            <input data-testid="${noAriaInvalidAttribute}" aria-errormessage="${errorId}" />
          </div>
        `)
      }

      // Success Cases
      invalidFieldStates.forEach(invalidState => {
        const {queryByTestId} = renderFieldWithState(invalidState)
        const field = queryByTestId('input')

        expect(field).toHaveAccessibleErrorMessage()
        expect(field).toHaveAccessibleErrorMessage(error)
      })

      // Failure Case
      const {queryByTestId} = renderFieldWithState(validFieldState)
      const field = queryByTestId('input')
      const fieldWithoutAttribute = queryByTestId(noAriaInvalidAttribute)

      expect(() => expect(fieldWithoutAttribute).toHaveAccessibleErrorMessage())
        .toThrowErrorMatchingInlineSnapshot(`
        <dim>expect(</><red>element</><dim>).toHaveAccessibleErrorMessage(</><green>expected</><dim>)</>

        Expected element to be marked as invalid with attribute:
        <green>  aria-invalid="true"</>
        Received:
        <red>  null</>
      `)

      expect(() => expect(field).toHaveAccessibleErrorMessage())
        .toThrowErrorMatchingInlineSnapshot(`
        <dim>expect(</><red>element</><dim>).toHaveAccessibleErrorMessage(</><green>expected</><dim>)</>

        Expected element to be marked as invalid with attribute:
        <green>  aria-invalid="true"</>
        Received:
        <red>  aria-invalid="false</>
      `)

      // Assume the remaining error messages are the EXACT same as above
      expect(() => expect(field).toHaveAccessibleErrorMessage(error)).toThrow()
      expect(() =>
        expect(field).toHaveAccessibleErrorMessage(new RegExp(error, 'i')),
      ).toThrow()
    })

    it('Passes the test if the target element has ANY recognized, non-empty error message', () => {
      const {queryByTestId} = render(`
        <div>
          <${input} data-testid="${input}" aria-invalid="${strings.true}" aria-errormessage="${errorId}" />
          <div data-testid="${errorId}" id="${errorId}" role="alert">${error}</div>
        </div>
      `)

      const field = queryByTestId(input)
      expect(field).toHaveAccessibleErrorMessage()
    })

    it('Fails the test if NO recognized, non-empty error message was found for the target element', () => {
      const empty = 'empty'
      const emptyErrorId = 'empty-error'
      const missing = 'missing'

      const {queryByTestId} = render(`
        <div>
          <input data-testid="${empty}" aria-invalid="${strings.true}" aria-errormessage="${emptyErrorId}" />
          <div data-testid="${emptyErrorId}" id="${emptyErrorId}" role="alert"></div>

          <input data-testid="${missing}" aria-invalid="${strings.true}" aria-errormessage="${missing}-error" />
        </div>
      `)

      const fieldWithEmptyError = queryByTestId(empty)
      const fieldMissingError = queryByTestId(missing)

      expect(() => expect(fieldWithEmptyError).toHaveAccessibleErrorMessage())
        .toThrowErrorMatchingInlineSnapshot(`
        <dim>expect(</><red>element</><dim>).toHaveAccessibleErrorMessage(</><green>expected</><dim>)</>

        Expected element to have accessible error message:

        Received:

      `)

      expect(() => expect(fieldMissingError).toHaveAccessibleErrorMessage())
        .toThrowErrorMatchingInlineSnapshot(`
        <dim>expect(</><red>element</><dim>).toHaveAccessibleErrorMessage(</><green>expected</><dim>)</>

        Expected element to have accessible error message:

        Received:

      `)
    })

    it('Passes the test if the target element has the error message that was SPECIFIED', () => {
      const {queryByTestId} = render(`
        <div>
          <${input} data-testid="${input}" aria-invalid="${strings.true}" aria-errormessage="${errorId}" />
          <div data-testid="${errorId}" id="${errorId}" role="alert">${error}</div>
        </div>
      `)

      const field = queryByTestId(input)
      const halfOfError = error.slice(0, Math.floor(error.length * 0.5))

      expect(field).toHaveAccessibleErrorMessage(error)
      expect(field).toHaveAccessibleErrorMessage(new RegExp(halfOfError, 'i'))
      expect(field).toHaveAccessibleErrorMessage(
        expect.stringContaining(halfOfError),
      )
      expect(field).toHaveAccessibleErrorMessage(
        expect.stringMatching(new RegExp(halfOfError, 'i')),
      )
    })

    it('Fails the test if the target element DOES NOT have the error message that was SPECIFIED', () => {
      const {queryByTestId} = render(`
        <div>
          <${input} data-testid="${input}" aria-invalid="${strings.true}" aria-errormessage="${errorId}" />
          <div data-testid="${errorId}" id="${errorId}" role="alert">${error}</div>
        </div>
      `)

      const field = queryByTestId(input)
      const msg = 'asdflkje2984fguyvb bnafdsasfa;lj'

      expect(() => expect(field).toHaveAccessibleErrorMessage(''))
        .toThrowErrorMatchingInlineSnapshot(`
        <dim>expect(</><red>element</><dim>).toHaveAccessibleErrorMessage(</><green>expected</><dim>)</>

        Expected element to have accessible error message:

        Received:
        <red>  This field is invalid</>
      `)

      // Assume this error is SIMILAR to the error above
      expect(() => expect(field).toHaveAccessibleErrorMessage(msg)).toThrow()
      expect(() =>
        expect(field).toHaveAccessibleErrorMessage(
          error.slice(0, Math.floor(error.length * 0.5)),
        ),
      ).toThrow()

      expect(() =>
        expect(field).toHaveAccessibleErrorMessage(new RegExp(msg, 'i')),
      ).toThrowErrorMatchingInlineSnapshot(`
        <dim>expect(</><red>element</><dim>).toHaveAccessibleErrorMessage(</><green>expected</><dim>)</>

        Expected element to have accessible error message:
        <green>  /asdflkje2984fguyvb bnafdsasfa;lj/</>
        Received:
        <red>  This field is invalid</>
      `)
    })

    it('Normalizes the whitespace of the received error message', () => {
      const {queryByTestId} = render(`
        <div>
          <${input} data-testid="${input}" aria-invalid="${strings.true}" aria-errormessage="${errorId}" />
          <div data-testid="${errorId}" id="${errorId}" role="alert">
            Step
              1
                of
                  9000
          </div>
        </div>
      `)

      const field = queryByTestId(input)
      expect(field).toHaveAccessibleErrorMessage('Step 1 of 9000')
    })
  })

  // These tests for the `.not` use cases will help us cover our bases and complete test coverage
  describe('Negated Test Cases', () => {
    it("Passes the test if an invalid `id` is provided for the target element's `aria-errormessage`", () => {
      const secondId = 'id2'
      const secondError = 'LISTEN TO ME!!!'

      const {queryByTestId} = render(`
        <div>
          <${input} data-testid="${input}" aria-invalid="${strings.true}" aria-errormessage="${errorId} ${secondId}" />
          <div data-testid="${errorId}" id="${errorId}" role="alert">${error}</div>
          <div data-testid="${secondId}" id="${secondId}" role="alert">${secondError}</div>
        </div>
      `)

      const field = queryByTestId('input')
      expect(field).not.toHaveAccessibleErrorMessage()
      expect(field).not.toHaveAccessibleErrorMessage(error)
      expect(field).not.toHaveAccessibleErrorMessage(new RegExp(error[0]))
      expect(field).not.toHaveAccessibleErrorMessage(secondError)
      expect(field).not.toHaveAccessibleErrorMessage(new RegExp(secondError[0]))
    })

    it('Passes the test if the target element is valid according to the WAI-ARIA spec', () => {
      const {queryByTestId} = render(`
        <div>
          <${input} data-testid="${input}" aria-errormessage="${errorId}" />
          <div data-testid="${errorId}" id="${errorId}" role="alert">${error}</div>
        </div>
      `)

      const field = queryByTestId(input)
      expect(field).not.toHaveAccessibleErrorMessage()
      expect(field).not.toHaveAccessibleErrorMessage(error)
      expect(field).not.toHaveAccessibleErrorMessage(new RegExp(error[0]))
    })
  })
})