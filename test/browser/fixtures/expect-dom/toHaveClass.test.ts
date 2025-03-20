import { expect, test } from 'vitest'
import { render } from './utils'

const renderElementWithClasses = () =>
  render(`
<div>
  <button data-testid="delete-button" class="btn extra btn-danger">
    Delete item
  </button>
  <button data-testid="cancel-button">
    Cancel
  </button>
  <svg data-testid="svg-spinner" class="spinner clockwise">
    <path />
  </svg>
  <div data-testid="only-one-class" class="alone"></div>
  <div data-testid="no-classes"></div>
</div>
`)

test('.toHaveClass', () => {
  const {queryByTestId} = renderElementWithClasses()

  expect(queryByTestId('delete-button')).toHaveClass('btn')
  expect(queryByTestId('delete-button')).toHaveClass('btn-danger')
  expect(queryByTestId('delete-button')).toHaveClass('extra')
  expect(queryByTestId('delete-button')).not.toHaveClass('xtra')
  expect(queryByTestId('delete-button')).not.toHaveClass('btn xtra')
  expect(queryByTestId('delete-button')).not.toHaveClass('btn', 'xtra')
  expect(queryByTestId('delete-button')).not.toHaveClass('btn', 'extra xtra')
  expect(queryByTestId('delete-button')).toHaveClass('btn btn-danger')
  expect(queryByTestId('delete-button')).toHaveClass('btn', 'btn-danger')
  expect(queryByTestId('delete-button')).toHaveClass(
    'btn extra',
    'btn-danger extra',
  )
  expect(queryByTestId('delete-button')).not.toHaveClass('btn-link')
  expect(queryByTestId('cancel-button')).not.toHaveClass('btn-danger')
  expect(queryByTestId('svg-spinner')).toHaveClass('spinner')
  expect(queryByTestId('svg-spinner')).toHaveClass('clockwise')
  expect(queryByTestId('svg-spinner')).not.toHaveClass('wise')
  expect(queryByTestId('no-classes')).not.toHaveClass()
  expect(queryByTestId('no-classes')).not.toHaveClass(' ')

  expect(() =>
    expect(queryByTestId('delete-button')).not.toHaveClass('btn'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('delete-button')).not.toHaveClass('btn-danger'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('delete-button')).not.toHaveClass('extra'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('delete-button')).toHaveClass('xtra'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('delete-button')).toHaveClass('btn', 'extra xtra'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('delete-button')).not.toHaveClass('btn btn-danger'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('delete-button')).not.toHaveClass('btn', 'btn-danger'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('delete-button')).toHaveClass('btn-link'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('cancel-button')).toHaveClass('btn-danger'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('svg-spinner')).not.toHaveClass('spinner'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('svg-spinner')).toHaveClass('wise'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('delete-button')).toHaveClass(),
  ).toThrowError(/At least one expected class must be provided/)
  expect(() =>
    expect(queryByTestId('delete-button')).toHaveClass(''),
  ).toThrowError(/At least one expected class must be provided/)
  expect(() => expect(queryByTestId('no-classes')).toHaveClass()).toThrowError(
    /At least one expected class must be provided/,
  )
  expect(() =>
    expect(queryByTestId('delete-button')).not.toHaveClass(),
  ).toThrowError(/(none)/)
  expect(() =>
    expect(queryByTestId('delete-button')).not.toHaveClass('  '),
  ).toThrowError(/(none)/)
})

test('.toHaveClass with regular expressions', () => {
  const {queryByTestId} = renderElementWithClasses()

  expect(queryByTestId('delete-button')).toHaveClass(/btn/)
  expect(queryByTestId('delete-button')).toHaveClass(/danger/)
  expect(queryByTestId('delete-button')).toHaveClass(
    /-danger$/,
    'extra',
    /^btn-[a-z]+$/,
    /\bbtn/,
  )

  // It does not match with "btn extra", even though it is a substring of the
  // class "btn extra btn-danger". This is because the regular expression is
  // matched against each class individually.
  expect(queryByTestId('delete-button')).not.toHaveClass(/btn extra/)

  expect(() =>
    expect(queryByTestId('delete-button')).not.toHaveClass(/danger/),
  ).toThrowError()

  expect(() =>
    expect(queryByTestId('delete-button')).toHaveClass(/dangerous/),
  ).toThrowError()
})

test('.toHaveClass with exact mode option', () => {
  const {queryByTestId} = renderElementWithClasses()

  expect(queryByTestId('delete-button')).toHaveClass('btn extra btn-danger', {
    exact: true,
  })
  expect(queryByTestId('delete-button')).not.toHaveClass('btn extra', {
    exact: true,
  })
  expect(queryByTestId('delete-button')).not.toHaveClass(
    'btn extra btn-danger foo',
    {exact: true},
  )

  expect(queryByTestId('delete-button')).toHaveClass('btn extra btn-danger', {
    exact: false,
  })
  expect(queryByTestId('delete-button')).toHaveClass('btn extra', {
    exact: false,
  })
  expect(queryByTestId('delete-button')).not.toHaveClass(
    'btn extra btn-danger foo',
    {exact: false},
  )

  expect(queryByTestId('delete-button')).toHaveClass(
    'btn',
    'extra',
    'btn-danger',
    {exact: true},
  )
  expect(queryByTestId('delete-button')).not.toHaveClass('btn', 'extra', {
    exact: true,
  })
  expect(queryByTestId('delete-button')).not.toHaveClass(
    'btn',
    'extra',
    'btn-danger',
    'foo',
    {exact: true},
  )

  expect(queryByTestId('delete-button')).toHaveClass(
    'btn',
    'extra',
    'btn-danger',
    {exact: false},
  )
  expect(queryByTestId('delete-button')).toHaveClass('btn', 'extra', {
    exact: false,
  })
  expect(queryByTestId('delete-button')).not.toHaveClass(
    'btn',
    'extra',
    'btn-danger',
    'foo',
    {exact: false},
  )

  expect(queryByTestId('only-one-class')).toHaveClass('alone', {exact: true})
  expect(queryByTestId('only-one-class')).not.toHaveClass('alone foo', {
    exact: true,
  })
  expect(queryByTestId('only-one-class')).not.toHaveClass('alone', 'foo', {
    exact: true,
  })

  expect(queryByTestId('only-one-class')).toHaveClass('alone', {exact: false})
  expect(queryByTestId('only-one-class')).not.toHaveClass('alone foo', {
    exact: false,
  })
  expect(queryByTestId('only-one-class')).not.toHaveClass('alone', 'foo', {
    exact: false,
  })

  expect(() =>
    expect(queryByTestId('only-one-class')).not.toHaveClass('alone', {
      exact: true,
    }),
  ).toThrowError(/Expected the element not to have EXACTLY defined classes/)

  expect(() =>
    expect(queryByTestId('only-one-class')).toHaveClass('alone', 'foo', {
      exact: true,
    }),
  ).toThrowError(/Expected the element to have EXACTLY defined classes/)
})

test('.toHaveClass combining {exact:true} and regular expressions throws an error', () => {
  const {queryByTestId} = renderElementWithClasses()

  expect(() =>
    // @ts-expect-error regexp is not supported with exact
    expect(queryByTestId('delete-button')).not.toHaveClass(/btn/, {
      exact: true,
    }),
  ).toThrowError()

  expect(() =>
    expect(queryByTestId('delete-button')).not.toHaveClass(
      // @ts-expect-error regexp is not supported with exact
      /-danger$/,
      'extra',
      /\bbtn/,
      {exact: true},
    ),
  ).toThrowError()

  expect(() =>
    // @ts-expect-error regexp is not supported with exact
    expect(queryByTestId('delete-button')).toHaveClass(/danger/, {exact: true}),
  ).toThrowError()
})