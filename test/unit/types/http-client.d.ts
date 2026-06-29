// Ambient types for the `http-client` fixture in `projects/http-client`, which is
// resolved through a Vite alias and treated as external via `deps.moduleDirectories`.
declare module 'http-client' {
  interface HttpClient {
    get: (...args: any[]) => Promise<unknown>
    post: (...args: any[]) => Promise<unknown>
    isHttpError: (error: unknown) => boolean
  }

  const httpClient: HttpClient

  export default httpClient
  export const get: HttpClient['get']
  export const post: HttpClient['post']
  export const isHttpError: HttpClient['isHttpError']
}
