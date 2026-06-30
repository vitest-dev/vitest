export function get(...args: any[]): void

export function post(...args: any[]): void

export function isHttpError(error: unknown): boolean

declare const httpClient: {
  get: typeof get
  post: typeof post
  isHttpError: typeof isHttpError
}

export default httpClient
