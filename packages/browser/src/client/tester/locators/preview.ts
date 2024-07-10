import { getByAltText, getByLabelText, getByPlaceholderText, getByRole, getByTestId, getByText, getByTitle } from '@testing-library/dom'
import { page } from '@vitest/browser/context'
import { getBrowserState } from '../../utils'
import { Locator } from './index'

// TODO: type options
page.extend({
  getByLabelText(text: string | RegExp) {
    return new PreviewLocator(getByLabelText(document.body, text))
  },
  getByRole(role: string, options?: any) {
    return new PreviewLocator(getByRole(document.body, role, options))
  },
  getByTestId(testId: string | RegExp) {
    return new PreviewLocator(getByTestId(document.body, testId))
  },
  getByAltText(text: string | RegExp) {
    return new PreviewLocator(getByAltText(document.body, text))
  },
  getByPlaceholder(text: string | RegExp) {
    return new PreviewLocator(getByPlaceholderText(document.body, text))
  },
  getByText(text: string | RegExp) {
    return new PreviewLocator(getByText(document.body, text))
  },
  getByTitle(title: string | RegExp) {
    return new PreviewLocator(getByTitle(document.body, title))
  },
})

class PreviewLocator extends Locator {
  constructor(element: Element) {
    super(convertElementToCssSelector(element))
  }
}

function convertElementToCssSelector(element: Element) {
  if (!element || !(element instanceof Element)) {
    throw new Error(
      `Expected DOM element to be an instance of Element, received ${typeof element}`,
    )
  }

  return getUniqueCssSelector(element)
}

function getUniqueCssSelector(el: Element) {
  const path = []
  let parent: null | ParentNode
  let hasShadowRoot = false
  // eslint-disable-next-line no-cond-assign
  while (parent = getParent(el)) {
    if ((parent as Element).shadowRoot) {
      hasShadowRoot = true
    }

    const tag = el.tagName
    if (el.id) {
      path.push(`#${el.id}`)
    }
    else if (!el.nextElementSibling && !el.previousElementSibling) {
      path.push(tag)
    }
    else {
      let index = 0
      let sameTagSiblings = 0
      let elementIndex = 0

      for (const sibling of parent.children) {
        index++
        if (sibling.tagName === tag) {
          sameTagSiblings++
        }
        if (sibling === el) {
          elementIndex = index
        }
      }

      if (sameTagSiblings > 1) {
        path.push(`${tag}:nth-child(${elementIndex})`)
      }
      else {
        path.push(tag)
      }
    }
    el = parent as Element
  };
  return `${getBrowserState().provider === 'webdriverio' && hasShadowRoot ? '>>>' : ''}${path.reverse().join(' > ')}`.toLowerCase()
}

function getParent(el: Element) {
  const parent = el.parentNode
  if (parent instanceof ShadowRoot) {
    return parent.host
  }
  return parent
}
