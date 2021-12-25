import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

const customRender = (ui: ReactElement, { ...renderOptions } = {}) => {
  return {
    ...render(ui, {
      ...renderOptions,
    }),
  }
}

export { customRender, userEvent }
export * from '@testing-library/react'
