<template>
  <div grid="~ cols-[repeat(auto-fit,minmax(300px,1fr))]" gap-0>
    <section aria-labelledby="tests" bg-header rd-4 m="y-4 x-2" class="dark:bg-[#333]">
      <h2 id="tests" m="x-4 t-2 b-2" pt-2 text="center 2xl">
        Tests
      </h2>
      <div flex="~ wrap" justify-evenly gap-2 p="x-4 t-0 b-4" relative>
        <TestsEntry />
      </div>
    </section>
    <section aria-labelledby="files" bg-header rd-4 m="y-4 x-2" class="dark:bg-[#333]">
      <h2 id="files" m="x-4 t-2 b-2" pt-2 text="center 2xl">
        Files
      </h2>
      <div flex="~ wrap" justify-evenly gap-2 p="x-4 t-0 b-4" relative>
        <TestFilesEntry />
      </div>
    </section>
  </div>
</template>
