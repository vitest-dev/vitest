import type { CancelReason } from '@vitest/runner'
import type { MockedModuleSerialized } from '@vitest/mocker'
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
  module: MockedModuleSerialized
}

export interface IframeUnmockEvent {
  type: 'unmock'
  url: string
}

export interface IframeMockingDoneEvent {
  type: 'mock:done' | 'unmock:done'
}

export interface IframeMockFactoryRequestEvent {
  type: 'mock-factory:request'
  eventId: string
  id: string
}

export interface IframeMockFactoryResponseEvent {
  type: 'mock-factory:response'
  eventId: string
  exports: string[]
}

export interface IframeMockFactoryErrorEvent {
  type: 'mock-factory:error'
  eventId: string
  error: any
}

export interface IframeViewportChannelEvent {
  type: 'viewport:done' | 'viewport:fail'
}

export interface IframeMockInvalidateEvent {
  type: 'mock:invalidate'
}

export interface GlobalChannelTestRunCanceledEvent {
  type: 'cancel'
  reason: CancelReason
}

export type GlobalChannelIncomingEvent = GlobalChannelTestRunCanceledEvent

export type IframeChannelIncomingEvent =
  | IframeViewportEvent
  | IframeErrorEvent
  | IframeDoneEvent
  | IframeMockEvent
  | IframeUnmockEvent
  | IframeMockFactoryResponseEvent
  | IframeMockFactoryErrorEvent
  | IframeMockInvalidateEvent

export type IframeChannelOutgoingEvent =
  | IframeMockFactoryRequestEvent
  | IframeViewportChannelEvent
  | IframeMockingDoneEvent

export type IframeChannelEvent =
  | IframeChannelIncomingEvent
  | IframeChannelOutgoingEvent

export const channel = new BroadcastChannel(
  `vitest:${getBrowserState().contextId}`,
)
export const globalChannel = new BroadcastChannel('vitest:global')

export function waitForChannel(event: IframeChannelOutgoingEvent['type']) {
  return new Promise<void>((resolve) => {
    channel.addEventListener(
      'message',
      (e) => {
        if (e.data?.type === event) {
          resolve()
        }
      },
      { once: true },
    )
  })
}
