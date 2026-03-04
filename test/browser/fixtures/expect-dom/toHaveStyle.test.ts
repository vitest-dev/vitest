import { describe, expect, test } from 'vitest'
import { render } from './utils'

describe('.toHaveStyle', () => {
  test('handles positive test cases', () => {
    const { container } = render(`
          <div class="label" style="background-color: blue; height: 100%;">
            Hello World
          </div>
        `)

    const style = document.createElement('style')
    style.innerHTML = `
          .label {
            align-items: center;
            background-color: black;
            color: white;
            float: left;
            transition: opacity 0.2s ease-out, top 0.3s cubic-bezier(0.1, 0.7, 1.0, 0.1);
            transform: translateX(0px);
          }
        `
    document.body.appendChild(style)
    document.body.appendChild(container)

    // border: fakefake doesn't exist
    expect(() => {
      expect(container.querySelector('.label')).toHaveStyle('border: fakefake')
    }).toThrow()

    expect(container.querySelector('.label')).toHaveStyle(`
          height: 100%;
          color: white;
          background-color: blue;
        `)

    expect(container.querySelector('.label')).toHaveStyle(`
          background-color: blue;
          color: white;
        `)

    expect(container.querySelector('.label')).toHaveStyle(
      'transition: opacity 0.2s ease-out, top 0.3s cubic-bezier(0.1, 0.7, 1.0, 0.1)',
    )

    expect(container.querySelector('.label')).toHaveStyle(
      'background-color:blue;color:white',
    )

    expect(container.querySelector('.label')).not.toHaveStyle(`
          color: white;
          font-weight: bold;
        `)

    expect(container.querySelector('.label')).toHaveStyle(`
        Align-items: center;
      `)

    expect(container.querySelector('.label')).toHaveStyle(`
      transform: translateX(0px);
    `)
  })

  test('handles negative test cases', () => {
    const { container } = render(`
    <div class="label" style="background-color: blue; height: 100%">
      Hello World
    </div>
  `)

    const style = document.createElement('style')
    style.innerHTML = `
    .label {
      background-color: black;
      color: white;
      float: left;
      --var-name: 0px;
      transition: opacity 0.2s ease-out, top 0.3s cubic-bezier(1.175, 0.885, 0.32, 1.275);
    }
  `
    document.body.appendChild(style)
    document.body.appendChild(container)

    // CSS parser is forgiving, it doesn't throw
    // expect(() =>
    //   expect(container.querySelector('.label')).not.toHaveStyle(
    //     'font-weight bold',
    //   ),
    // ).toThrow()

    expect(() =>
      expect(container.querySelector('.label')).toHaveStyle(
        'font-weight: bold',
      ),
    ).toThrow()

    expect(() =>
      expect(container.querySelector('.label')).not.toHaveStyle('color: white'),
    ).toThrow()

    expect(() =>
      expect(container.querySelector('.label')).toHaveStyle(
        'transition: all 0.7s ease, width 1.0s cubic-bezier(3, 4, 5, 6);',
      ),
    ).toThrow()

    // Custom property names are case sensitive
    expect(() =>
      expect(container.querySelector('.label')).toHaveStyle('--VAR-NAME: 0px;'),
    ).toThrow()

    expect(() =>
      expect(container.querySelector('.label')).toHaveStyle('color white'),
    ).toThrow()

    expect(() =>
      expect(container.querySelector('.label')).toHaveStyle('--color: black'),
    ).toThrow()
    document.body.removeChild(style)
    document.body.removeChild(container)
  })

  test('properly normalizes colors', () => {
    const { queryByTestId } = render(`
      <span data-testid="color-example" style="background-color: #123456">Hello World</span>
    `)
    expect(queryByTestId('color-example')).toHaveStyle(
      'background-color: #123456',
    )
  })

  test('handles inline custom properties (with uppercase letters)', () => {
    const { queryByTestId } = render(`
      <span data-testid="color-example" style="--accentColor: blue">Hello World</span>
    `)
    expect(queryByTestId('color-example')).toHaveStyle('--accentColor: blue')
  })

  test('handles global custom properties', () => {
    const style = document.createElement('style')
    style.innerHTML = `
      div {
        --color: blue;
      }
    `

    const { container } = render(`
      <div>
        Hello world
      </div>
    `)

    document.body.appendChild(style)
    document.body.appendChild(container)

    expect(container).toHaveStyle(`--color: blue`)
  })

  test('properly normalizes colors for border', () => {
    const { queryByTestId } = render(`
    <span data-testid="color-example" style="border: 1px solid #fff">Hello World</span>
  `)
    expect(queryByTestId('color-example')).toHaveStyle('border: 1px solid #fff')
  })

  test('handles different color declaration formats', () => {
    const { queryByTestId } = render(`
      <span data-testid="color-example" style="color: rgba(0, 0, 0, 1); background-color: #000000">Hello World</span>
    `)

    expect(queryByTestId('color-example')).toHaveStyle('color: #000000')
    expect(queryByTestId('color-example')).toHaveStyle(
      'background-color: rgba(0, 0, 0, 1)',
    )
  })

  test('handles nonexistent styles', () => {
    const { container } = render(`
          <div class="label" style="background-color: blue; height: 100%">
            Hello World
          </div>
        `)

    expect(container.querySelector('.label')).not.toHaveStyle(
      'whatever: anything',
    )
  })

  describe('object syntax', () => {
    test('handles styles as object', () => {
      const { container } = render(`
        <div class="label" style="background-color: blue; height: 100%">
          Hello World
        </div>
      `)

      expect(container.querySelector('.label')).toHaveStyle({
        backgroundColor: 'blue',
      })
      expect(container.querySelector('.label')).toHaveStyle({
        backgroundColor: 'blue',
        height: '100%',
      })
      expect(container.querySelector('.label')).not.toHaveStyle({
        backgroundColor: 'red',
        height: '100%',
      })
      expect(container.querySelector('.label')).not.toHaveStyle({
        whatever: 'anything',
      })
    })

    // https://github.com/testing-library/jest-dom/issues/350
    test('Uses correct computed values', () => {
      const { container } = render(`
          <div class="label">
            Hello World
          </div>
      `)

      const style = document.createElement('style')
      style.innerHTML = `
            .label {
              color: #fff;
              background-color: #000;
            }
          `
      document.body.appendChild(style)
      document.body.appendChild(container)

      expect(container.querySelector('.label')).toHaveStyle('color: #FFF')
    })

    test('Uses px as the default unit', () => {
      const { queryByTestId } = render(`
        <span data-testid="color-example" style="font-size: 12px">Hello World</span>
      `)
      expect(queryByTestId('color-example')).toHaveStyle({
        // in jest-dom '12' is converted to 12px
        // but in the browser setting the style to 12 wil have no effect,
        // so Vitest prioritizes the browser behavior
        // fontSize: 12,
        fontSize: '12px',
      })
    })

    test('Fails with an invalid unit', () => {
      const { queryByTestId } = render(`
        <span data-testid="color-example" style="font-size: 12rem">Hello World</span>
      `)
      expect(() => {
        expect(queryByTestId('color-example')).toHaveStyle({ fontSize: '12px' })
      }).toThrow()
    })

    test('supports dash-cased property names', () => {
      const { container } = render(`
        <div class="label" style="background-color: blue; height: 100%">
          Hello World
        </div>
      `)
      expect(container.querySelector('.label')).toHaveStyle({
        'background-color': 'blue',
      })
    })

    test('requires strict empty properties matching', () => {
      const { container } = render(`
        <div class="label" style="width: 100%;height: 100%">
          Hello World
        </div>
      `)
      expect(container.querySelector('.label')).not.toHaveStyle({
        width: '100%',
        height: '',
      })
      expect(container.querySelector('.label')).not.toHaveStyle({
        width: '',
        height: '',
      })
    })
  })
})
