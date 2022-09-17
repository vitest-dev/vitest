import { expect, test } from 'vitest'
import { calcExternalLabels, createModuleLabelItem } from '../../../packages/ui/client/composables/module-graph'

const getExternalLabelsObj = (modules: string[]) => {
  const labels = modules.map(module => createModuleLabelItem(module))
  return Object.fromEntries(calcExternalLabels(labels))
}

test('calculate label of external module', () => {
  const modules1: string[] = []
  expect(getExternalLabelsObj(modules1)).toEqual({})
  const modules2 = ['']
  expect(getExternalLabelsObj(modules2)).toEqual({ '': '' })
  const modules3 = [
    'org/testA',
    'org/testB',
  ]
  expect(getExternalLabelsObj(modules3)).toEqual({
    'org/testA': 'org/testA',
    'org/testB': 'org/testB',
  })
  const modules4 = [...modules3, 'org/testC']
  expect(getExternalLabelsObj(modules4)).toEqual({
    'org/testA': 'org/testA',
    'org/testB': 'org/testB',
    'org/testC': 'org/testC',
  })
  const modules5 = [
    'orgA',
    'orgB',
  ]
  expect(getExternalLabelsObj(modules5)).toEqual({
    orgA: 'orgA',
    orgB: 'orgB',
  })
  const modules6 = ['orgA', 'orgB', 'orgA/dist']
  expect(getExternalLabelsObj(modules6)).toEqual({
    'orgA': 'orgA',
    'orgB': 'orgB',
    'orgA/dist': 'orgA/dist',
  })
  const modules7 = [
    '@testing-library/jest-dom/dist/index.js',
    '@testing-library/react/dist/index.js',
  ]
  expect(getExternalLabelsObj(modules7)).toEqual({
    '@testing-library/jest-dom/dist/index.js': '@testing-library/jest-dom',
    '@testing-library/react/dist/index.js': '@testing-library/react',
  })
})
