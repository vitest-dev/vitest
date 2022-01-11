<template>
  <div grid="~ auto-flow-col-dense" gap-0>
    <section aria-labelledby="tests" bg-header rd-4 m-4>
      <h2 id="tests" m="x-4 t-2 b-2" pt-2 text="center 2xl">
        Tests
      </h2>
      <div flex="~ wrap" justify-evenly gap-4 p="x-4 t-0 b-4" relative>
        <TestsEntry />
      </div>
    </section>
    <section aria-labelledby="files" bg-header rd-4 m-4>
      <h2 id="files" m="x-4 t-2 b-2" pt-2 text="center 2xl">
        Files
      </h2>
      <div flex="~ wrap" justify-evenly gap-4 p="x-4 t-0 b-4" relative>
        <TestFilesEntry />
      </div>
    </section>
  </div>
</template>
