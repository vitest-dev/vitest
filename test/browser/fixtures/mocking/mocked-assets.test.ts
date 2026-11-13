import { expect, test, vi } from 'vitest'
import logo from './src/logo.svg'
import settings from './src/settings.json'
import template from './src/template.html?raw'

vi.mock('./src/logo.svg', () => ({ default: '/mocked-logo.svg' }))
vi.mock('./src/template.html?raw', () => ({ default: '<p>mocked</p>' }))
vi.mock('./src/settings.json')

test('mocks modules that are not JavaScript', () => {
  expect(logo).toBe('/mocked-logo.svg')
  expect(template).toBe('<p>mocked</p>')
  expect(settings).toEqual({ theme: 'dark' })
})
