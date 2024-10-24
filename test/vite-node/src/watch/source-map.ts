// 1
// 1
async function main() {
  try {
    // 2
    // 2
    throw new Error('boom')
  }
  catch (e) {
    // eslint-disable-next-line no-console
    console.log(e)
  }
}
// 3
// 3
main()
