const sleep = async n => new Promise(resolve => setTimeout(resolve, n))

// let start

export async function setup() {
  // setup something eg start a server, db or whatever
  // const server = await start()
  // console.log('globalSetup named-exports.js')
  // start = Date.now()
  await sleep(25)
}

export async function teardown() {
  // tear it down here
  // await server.close()
  await sleep(25)
  // const duration = Date.now() - start
  // console.log(`globalTeardown named-exports.js, took ${(duration)}ms`)
  // if (duration > 4000)
  //  throw new Error('error from teardown in globalSetup named-exports.js')
}
