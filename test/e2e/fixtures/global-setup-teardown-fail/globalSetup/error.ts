export default function () {
  return () => {
    throw new Error('teardown error')
  }
}
