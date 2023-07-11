import '@testing-library/jest-dom'
import { Buffer } from 'node:buffer'
import { setGlobalConfig } from '@storybook/testing-react'
import { getWorker } from 'msw-storybook-addon'
import * as globalStorybookConfig from '../.storybook/preview'

setGlobalConfig(globalStorybookConfig)

// Ensure MSW connections are closed
// @ts-expect-error https://github.com/mswjs/msw-storybook-addon/issues/65
afterAll(() => getWorker().close())

// Buffer is not available in browser environment, but some testing libraries require it
globalThis.Buffer = Buffer
