import type { CancelReason } from 'vitest'
import type { FileSpecification } from 'vitest/internal/browser'
import type { OTELCarrier } from 'vitest/internal/traces'
import { getBrowserState } from './utils'

export interface IframeViewportEvent {
  event: 'viewport'
  width: number
  height: number
  iframeId: string
}

export interface IframeViewportFailEvent {
  event: 'viewport:fail'
  iframeId: string
  error: string
}

export interface IframeViewportDoneEvent {
  event: 'viewport:done'
  iframeId: string
}

export interface IframeReadyEvent {
  event: 'ready'
  iframeId: string
}

export interface GlobalChannelTestRunCanceledEvent {
  type: 'cancel'
  reason: CancelReason
}

export interface IframeExecuteEvent {
  event: 'execute'
  method: 'run' | 'collect'
  files: FileSpecification[]
  iframeId: string
  context: string
  concurrencyId: number
  workerId: number
}

export interface IframeCleanupEvent {
  event: 'cleanup'
  iframeId: string
}

export interface IframePrepareEvent {
  event: 'prepare'
  iframeId: string
  startTime: number
  otelCarrier?: OTELCarrier
}

export type GlobalChannelIncomingEvent = GlobalChannelTestRunCanceledEvent

export type IframeChannelIncomingEvent
  = | IframeViewportEvent
    | IframeReadyEvent

export type IframeChannelOutgoingEvent
  = | IframeExecuteEvent
    | IframeCleanupEvent
    | IframePrepareEvent
    | IframeViewportFailEvent
    | IframeViewportDoneEvent

export type IframeChannelEvent
  = | IframeChannelIncomingEvent
    | IframeChannelOutgoingEvent

export const channel: BroadcastChannel = new BroadcastChannel(
  `vitest:${getBrowserState().sessionId}`,
)
export const globalChannel: BroadcastChannel = new BroadcastChannel('vitest:global')
