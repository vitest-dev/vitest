import { getBrowserState } from './utils'

export interface IframeDoneEvent {
  type: 'done'
  filenames: string[]
  id: string
}

export interface IframeErrorEvent {
  type: 'error'
  error: any
  errorType: string
  files: string[]
  id: string
}

export interface IframeViewportEvent {
  type: 'viewport'
  width: number
  height: number
  id: string
}

export interface IframeMockEvent {
  type: 'mock'
  paths: string[]
  mock: string | undefined | null
}

export interface IframeUnmockEvent {
  type: 'unmock'
  paths: string[]
}

interface IframeMockingDoneEvent {
  type: 'mock:done' | 'unmock:done'
}

export interface IframeMockFactoryRequestEvent {
  type: 'mock-factory:request'
  id: string
}

export interface IframeMockFactoryResponseEvent {
  type: 'mock-factory:response'
  exports: string[]
}

export interface IframeViewportChannelEvent {
  type: 'viewport:done' | 'viewport:fail'
}

export type IframeChannelIncomingEvent =
  | IframeViewportEvent
  | IframeErrorEvent
  | IframeDoneEvent
  | IframeMockEvent
  | IframeUnmockEvent
  | IframeMockFactoryResponseEvent

export type IframeChannelOutgoingEvent =
  | IframeMockFactoryRequestEvent
  | IframeViewportChannelEvent
  | IframeMockingDoneEvent

export type IframeChannelEvent =
  | IframeChannelIncomingEvent
  | IframeChannelOutgoingEvent

export const channel = new BroadcastChannel(`vitest:${getBrowserState().contextId}`)

export function waitForChannel(event: IframeChannelOutgoingEvent['type']) {
  return new Promise<void>((resolve) => {
    channel.addEventListener('message', (e) => {
      if (e.data?.type === event)
        resolve()
    }, { once: true })
  })
}
