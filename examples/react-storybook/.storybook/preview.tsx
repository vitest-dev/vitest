import { QueryClient, QueryClientProvider, setLogger } from 'react-query'
import { initialize, mswDecorator } from 'msw-storybook-addon'
import type { Preview } from '@storybook/react'

// Disable `react-query` error logging
setLogger({
  error: () => {},
  // eslint-disable-next-line no-console
  log: (...params) => console.log(...params),
  warn: (...params) => console.warn(...params),
})

// Start Mock Service Worker
initialize({ onUnhandledRequest: 'bypass' })

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
  },
  decorators: [
    mswDecorator as any,
    (story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchIntervalInBackground: false,
            retry: false,
          },
        },
      })

      return (
        <QueryClientProvider client={queryClient}>{story()}</QueryClientProvider>
      )
    },
  ],
}
export default preview
