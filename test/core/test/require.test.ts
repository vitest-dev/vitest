import { describe, expect, it } from 'vitest'

const _require = require

describe('using "require" to import a module', () => {
  it('importing css files works, but doesn\'t process them', () => {
    const css = _require('./../src/file-css.css')
    const sass = _require('./../src/file-sass.sass')
    const scss = _require('./../src/file-scss.scss')

    expect(css).toEqual({})
    expect(sass).toEqual({})
    expect(scss).toEqual({})
  })
})
