// @vitest-environment jsdom

// import { KNOWN_ASSET_RE } from 'vite-node/constants'
import { describe, expect, it } from 'vitest'

const _require = require

describe('using "require" to import a module', () => {
  it('importing css files works, but doesn\'t process them', () => {
    const css = _require('./../src/file-css.css')
    const sass = _require('./../src/file-sass.sass')
    const scss = _require('./../src/file-scss.scss')
    const less = _require('./../src/file-less.less')

    expect(css).toEqual('')
    expect(sass).toEqual('')
    expect(scss).toEqual('')
    expect(less).toEqual('')
  })

  it('importing assets works', () => {
    const path = _require.resolve('./../src/file-txt.txt')
    expect(_require('./../src/file-txt.txt')).toBe(path)
  })
})
