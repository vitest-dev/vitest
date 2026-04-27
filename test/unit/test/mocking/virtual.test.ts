// @ts-expect-error virtual module
import * as virtual from 'virtual-module'

import { expect, it, vi } from 'vitest'

// @ts-expect-error vscode is not installed
import * as vscodeFactory from 'vscode-factory'
// @ts-expect-error vscode is not installed
import * as vscodeMocks from 'vscode-mocks'

vi.mock('vscode-mocks')
vi.mock('vscode-factory', () => {
  return { factory: true }
})
vi.mock('virtual-module')

it('mocks not installed in mocks folder', () => {
  expect(vscodeMocks.folder).toBe(true)
})

it('mocks not installed in mocks factory', () => {
  expect(vscodeFactory.factory).toBe(true)
})

it('mocks virtual modules in mocks folder', () => {
  expect(virtual.value).toBe('folder')
})
