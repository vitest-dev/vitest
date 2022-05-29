module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === 'vue-template-compiler')
        pkg.dependencies.vue = '^2.6.0'
      return pkg
    },
  },
}
