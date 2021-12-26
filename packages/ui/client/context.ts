import type { WebSocketStatus } from '@vueuse/core'
import type { InjectionKey, Ref } from 'vue'
import type { File } from 'vitest/src/types'
import type { FileUI } from './utils'

export const connectionStatus: InjectionKey<Ref<WebSocketStatus>> = Symbol('web socket status')
export const fileMetadata: InjectionKey<Ref<File[]>> = Symbol('file metadata')
export const activeFileId: InjectionKey<Ref<string>> = Symbol('active file id')
export const tasksCtx: InjectionKey<Ref<null | FileUI>> = Symbol('tasks')
