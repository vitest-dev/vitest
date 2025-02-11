```js
it('should work', (done) => {  // [!code --]
it('should work', () => new Promise(done => { // [!code ++]
  // ...
  done()
}) // [!code --]
})) // [!code ++]
```
