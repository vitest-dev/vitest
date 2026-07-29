The recent version of the wasm-bindgen bundler output does not use cyclic imports between wasm and js.

For this non-cyclic version to work, both `index_bg.js` and `index_bg.wasm` need to be externalized
since otherwise a dual package hazard on `index_bg.js` would make it non-functional.

The code is copied from https://github.com/rustwasm/wasm-bindgen/tree/8198d2d25920e1f4fc593e9f8eb9d199e004d731/examples/hello_world

```sh
npm i
npm run build
# then
# 1. copy `examples/hello_world/pkg` to this directory
# 2. add { "type": "module" } to `package.json`
#    (this will be automatically included after https://github.com/rustwasm/wasm-pack/pull/1061)
```
