import { expect, test } from 'vitest'
import { render } from './utils'

const {queryByTestId} = render(`
<span data-testid="grandparent">
  <span data-testid="parent">
    <span data-testid="child"></span>
  </span>
  <svg data-testid="svg-element"></svg>
</span>
`)

const grandparent = queryByTestId('grandparent')
const parent = queryByTestId('parent')
const child = queryByTestId('child')
const svgElement = queryByTestId('svg-element')
const nonExistantElement = queryByTestId('not-exists')
const fakeElement = {thisIsNot: 'an html element'}

test('.toContainElement positive test cases', () => {
  expect(grandparent).toContainElement(parent)
  expect(grandparent).toContainElement(child)
  expect(grandparent).toContainElement(svgElement)
  expect(parent).toContainElement(child)
  expect(parent).not.toContainElement(grandparent)
  expect(parent).not.toContainElement(svgElement)
  expect(child).not.toContainElement(parent)
  expect(child).not.toContainElement(grandparent)
  expect(child).not.toContainElement(svgElement)
  expect(grandparent).not.toContainElement(nonExistantElement)
})

test('.toContainElement negative test cases', () => {
  expect(() =>
    expect(nonExistantElement).not.toContainElement(child),
  ).toThrowError()
  expect(() => expect(parent).toContainElement(grandparent)).toThrowError()
  expect(() =>
    expect(nonExistantElement).toContainElement(grandparent),
  ).toThrowError()
  expect(() =>
    expect(grandparent).toContainElement(nonExistantElement),
  ).toThrowError()
  expect(() =>
    expect(nonExistantElement).toContainElement(nonExistantElement),
  ).toThrowError()
  expect(() =>
    // @ts-expect-error testing invalid assertion
    expect(nonExistantElement).toContainElement(fakeElement),
  ).toThrowError()
  expect(() =>
    expect(fakeElement).toContainElement(nonExistantElement),
  ).toThrowError()
  expect(() =>
    expect(fakeElement).not.toContainElement(nonExistantElement),
  ).toThrowError()
  expect(() => expect(fakeElement).toContainElement(grandparent)).toThrowError()
    // @ts-expect-error testing invalid assertion
  expect(() => expect(grandparent).toContainElement(fakeElement)).toThrowError()
    // @ts-expect-error testing invalid assertion
  expect(() => expect(fakeElement).toContainElement(fakeElement)).toThrowError()
  expect(() => expect(grandparent).not.toContainElement(child)).toThrowError()
  expect(() =>
    expect(grandparent).not.toContainElement(svgElement),
  ).toThrowError()
  expect(() =>
    expect(grandparent).not.toContainElement(undefined),
  ).toThrowError()
})