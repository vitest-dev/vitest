import type { ComponentMeta, ComponentStory } from '@storybook/react'
import type { DefaultRequestBody, PathParams } from 'msw'
import { rest } from 'msw'
import { App } from './App'
import type { Post } from './types'
import { posts } from './mockData'

export default {
  title: 'App',
  component: App,
} as ComponentMeta<typeof App>

const Template: ComponentStory<typeof App> = () => <App />

export const Loading = Template.bind({})
Loading.parameters = {
  msw: {
    handlers: [
      rest.get('https://jsonplaceholder.typicode.com/posts', (req, res, ctx) => res(ctx.delay('infinite'))),
    ],
  },
}

export const Data = Template.bind({})
Data.parameters = {
  msw: {
    handlers: [
      rest.get<DefaultRequestBody, PathParams, Post[]>(
        'https://jsonplaceholder.typicode.com/posts',
        (req, res, ctx) => res(ctx.json(posts)),
      ),
    ],
  },
}

export const Error = Template.bind({})
Error.parameters = {
  msw: {
    handlers: [
      rest.get('https://jsonplaceholder.typicode.com/posts', (req, res, ctx) => res(ctx.status(500))),
    ],
  },
}
