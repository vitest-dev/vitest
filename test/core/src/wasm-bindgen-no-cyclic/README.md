Recent version of wasm-bindgen bundler output which doesn't use cyclic import between wasm and js.

The code is copied from https://github.com/rustwasm/wasm-bindgen/tree/8198d2d25920e1f4fc593e9f8eb9d199e004d731/examples/hello_world

```sh
npm i
npm run build
# then
# 1. copy "examples/hello_world/pkg" to this directory
# 2. add { "type": "module" } to package.json
```
