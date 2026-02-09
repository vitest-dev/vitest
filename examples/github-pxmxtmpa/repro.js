import { createServer } from 'vite'

async function main() {
  const server = await createServer({
    ssr: {
      // noExternal: true
    }
  })
  await server.listen()
  // try {
  //   const result = await server.environments.ssr.pluginContainer.resolveId('bad-dep')
  //   console.log(result)
  // }
  // catch (e) {
  //   console.error(e)
  // }
  // finally {
  //   await server.close()
  // }
  try {
    const result = await server.environments.ssr.runner.import('./repro-entry.js')
    console.log(result)
  }
  catch (e) {
    console.error(e)
  }
  finally {
    await server.close()
  }
}

main()
