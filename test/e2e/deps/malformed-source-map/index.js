const embeddedSourceMapComment = `
//# sourceMappingURL=data:application/json;base64,bm90LWpzb24=
`

export default function testMalformedSourceMap() {
  throw new Error('test error')
}
