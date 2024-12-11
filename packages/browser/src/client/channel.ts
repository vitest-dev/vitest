import type { CancelReason } from '@vitest/runner'
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

export interface GlobalChannelTestRunCanceledEvent {
  type: 'cancel'
  reason: CancelReason
}

export type GlobalChannelIncomingEvent = GlobalChannelTestRunCanceledEvent

export type IframeChannelIncomingEvent =
  | IframeViewportEvent
  | IframeErrorEvent
  | IframeDoneEvent

export type IframeChannelOutgoingEvent = never

export type IframeChannelEvent =
  | IframeChannelIncomingEvent
  | IframeChannelOutgoingEvent

export const channel = new BroadcastChannel(
  `vitest:${getBrowserState().sessionId}`,
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
