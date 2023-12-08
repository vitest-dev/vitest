import React from 'react'
import renderer from 'react-test-renderer'
import Link from '../components/Link.jsx'
import * as linkModule from '../components/Link.jsx'

function toJson(component: renderer.ReactTestRenderer) {
  const result = component.toJSON()
  expect(result).toBeDefined()
  expect(result).not.toBeInstanceOf(Array)
  return result as renderer.ReactTestRendererJSON
}

test('Link changes the class when hovered', () => {
  const component = renderer.create(
    <Link page="http://antfu.me">Anthony Fu</Link>,
  )
  let tree = toJson(component)
  expect(tree).toMatchSnapshot()

  // manually trigger the callback
  tree.props.onMouseEnter()

  // re-rendering
  tree = toJson(component)
  expect(tree).toMatchSnapshot()

  // manually trigger the callback
  tree.props.onMouseLeave()
  // re-rendering
  tree = toJson(component)
  expect(tree).toMatchSnapshot()
})

test('Link can be spied', () => {
  vi.spyOn(linkModule, 'default').mockImplementation(() => {
    return <div>Hello</div>
  })

  const component = renderer.create(
    <Link page="http://antfu.me">Anthony Fu</Link>,
  )

  const tree = toJson(component)
  console.warn('tree', tree)

  expect(tree.type).toBe('div')
  expect(tree.children).toStrictEqual(['Hello'])
})
