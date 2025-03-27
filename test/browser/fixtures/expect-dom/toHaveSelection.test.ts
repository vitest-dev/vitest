import { describe, expect, test } from 'vitest'
import { render } from './utils'

describe('.toHaveSelection', () => {
  test.each(['text', 'password', 'textarea'])(
    'handles selection within form elements',
    testId => {
      const {getInputByTestId} = render(`
        <input type="text" value="text selected text" data-testid="text" />
        <input type="password" value="text selected text" data-testid="password" />
        <textarea data-testid="textarea">text selected text</textarea>
    `)

      getInputByTestId(testId).setSelectionRange(5, 13)
      expect(getInputByTestId(testId)).toHaveSelection('selected')

      getInputByTestId(testId).select()
      expect(getInputByTestId(testId)).toHaveSelection('text selected text')
    },
  )

  test.each(['checkbox', 'radio'])(
    'returns empty string for form elements without text',
    testId => {
      const {getInputByTestId} = render(`
        <input type="checkbox" value="checkbox" data-testid="checkbox" />
        <input type="radio" value="radio" data-testid="radio" />
    `)

      getInputByTestId(testId).select()
      expect(getInputByTestId(testId)).toHaveSelection('')
    },
  )

  test('does not match subset string', () => {
    const {getInputByTestId} = render(`
        <input type="text" value="text selected text" data-testid="text" />
    `)

    getInputByTestId('text').setSelectionRange(5, 13)
    expect(getInputByTestId('text')).not.toHaveSelection('select')
    expect(getInputByTestId('text')).toHaveSelection('selected')
  })

  test('accepts any selection when expected selection is missing', () => {
    const {getInputByTestId} = render(`
        <input type="text" value="text selected text" data-testid="text" />
    `)

    expect(getInputByTestId('text')).not.toHaveSelection()

    getInputByTestId('text').setSelectionRange(5, 13)

    expect(getInputByTestId('text')).toHaveSelection()
  })

  test('throws when form element is not selected', () => {
    const {queryByTestId} = render(`
        <input type="text" value="text selected text" data-testid="text" />
    `)

    expect(() =>
      expect(queryByTestId('text')).toHaveSelection(),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Error: expect(element).toHaveSelection(expected)

      Expected the element to have selection:
        (any)
      Received:
      ]
    `)
  })

  test('throws when form element is selected', () => {
    const {getInputByTestId} = render(`
        <input type="text" value="text selected text" data-testid="text" />
    `)
    getInputByTestId('text').setSelectionRange(5, 13)

    expect(() =>
      expect(getInputByTestId('text')).not.toHaveSelection(),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Error: expect(element).not.toHaveSelection(expected)

      Expected the element not to have selection:
        (any)
      Received:
        selected]
    `)
  })

  test('throws when element is not selected', () => {
    const {queryByTestId} = render(`
        <div data-testid="text">text</div>
    `)

    expect(() =>
      expect(queryByTestId('text')).toHaveSelection(),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Error: expect(element).toHaveSelection(expected)

      Expected the element to have selection:
        (any)
      Received:
      ]
    `)
  })

  test('throws when element selection does not match', () => {
    const {getInputByTestId} = render(`
        <input type="text" value="text selected text" data-testid="text" />
    `)
    getInputByTestId('text').setSelectionRange(0, 4)

    expect(() =>
      expect(getInputByTestId('text')).toHaveSelection('no match'),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Error: expect(element).toHaveSelection(no match)

      Expected the element to have selection:
        no match
      Received:
        text]
    `)
  })

  test('handles selection within text nodes', () => {
    const {queryByTestId} = render(`
			<div>
        <div data-testid="prev">prev</div>
        <div data-testid="parent">text <span data-testid="child">selected</span> text</div>
        <div data-testid="next">next</div>
			</div>
    `)

    const selection = queryByTestId('child').ownerDocument.getSelection()
    const range = queryByTestId('child').ownerDocument.createRange()
    selection.removeAllRanges()
		selection.empty()
    selection.addRange(range)

    range.selectNodeContents(queryByTestId('child'))

    expect(queryByTestId('child')).toHaveSelection('selected')
    expect(queryByTestId('parent')).toHaveSelection('selected')

    range.selectNodeContents(queryByTestId('parent'))

    expect(queryByTestId('child')).toHaveSelection('selected')
    expect(queryByTestId('parent')).toHaveSelection('text selected text')

    range.setStart(queryByTestId('prev'), 0)
    range.setEnd(queryByTestId('child').childNodes[0], 3)

    expect(queryByTestId('prev')).toHaveSelection('prev')
    expect(queryByTestId('child')).toHaveSelection('sel')
    expect(queryByTestId('parent')).toHaveSelection('text sel')
    expect(queryByTestId('next')).not.toHaveSelection()

    range.setStart(queryByTestId('child').childNodes[0], 3)
    range.setEnd(queryByTestId('next').childNodes[0], 2)

    expect(queryByTestId('child')).toHaveSelection('ected')
    expect(queryByTestId('parent')).toHaveSelection('ected text')
    expect(queryByTestId('prev')).not.toHaveSelection()
    expect(queryByTestId('next')).toHaveSelection('ne')
  })

  test('throws with information when the expected selection is not string', () => {
    const {container} = render(`<div>1</div>`)
    const element = container.firstChild
    const range = element.ownerDocument.createRange()
    range.selectNodeContents(element)
    element.ownerDocument.getSelection().addRange(range)

    expect(() =>
      // @ts-expect-error wrong type
      expect(element).toHaveSelection(1),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: expected selection must be a string or undefined]`
    )
  })
})