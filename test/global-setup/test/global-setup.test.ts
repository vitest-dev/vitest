import http from 'http'

async function sendRequest(host: string, port: number) {
  return new Promise<string>((resolve) => {
    http.request({ host, port }, (res) => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => resolve(data))
    }).end()
  })
}

test('server running', async() => {
  const res = await sendRequest('127.0.0.1', 9876)
  expect(res).toBe('Hello Vitest\n')
})
