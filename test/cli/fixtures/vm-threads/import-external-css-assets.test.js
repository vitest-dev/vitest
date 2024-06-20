// @vitest-environment jsdom

import { describe, expect, test } from 'vitest'

import './src/external/css/empty.css'
import './src/external/css/processed.css'

import processedModule from './src/external/css/processed.module.css'

import file1 from './src/external/assets/file1.png'
import file2 from './src/external/assets/file2.txt'
import file3 from './src/external/assets/file3.svg'

describe('import external css', () => {
  test('when importing empty.css, element doesn\'t change style', () => {
    const el = document.createElement('div')
    el.classList.add('test1')
    expect(el.classList.contains('test1')).toBe(true)
    expect(window.getComputedStyle(el).color).toBe('')
  })

  test('when importing processed.css, element changes style', () => {
    const el = document.createElement('div')
    el.classList.add('test2')
    expect(el.classList.contains('test2')).toBe(true)
    expect(window.getComputedStyle(el).color).toBe('rgb(0, 128, 0)')
  })

  test('when importing processed.module.css, element changes style', () => {
    const el = document.createElement('div')
    el.classList.add(processedModule.test3)
    expect(el.classList.contains(processedModule.test3)).toBe(true)
    expect(window.getComputedStyle(el).color).toBe('rgb(255, 255, 0)')
  })
})

describe('import external assets', () => {
  test('correctly imports assets as paths', () => {
    expect(file1).toBe('/src/external/assets/file1.png')
    expect(file2).toBe('/src/external/assets/file2.txt')
    expect(file3).toBe('/src/external/assets/file3.svg')
  })
})
