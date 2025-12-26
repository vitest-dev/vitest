<template>
  <div class="wrapper wrapper--ticks border-t py-14 lg:py-30 px-5 sm:px-10 lg:px-20">
    <div class="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-5 lg:gap-8 text-left">
      <div class="flex flex-col gap-3 max-w-md">
        <div class="flex gap-3 items-center">
          <img src="@assets/icons/vitest-light.svg" alt="Vitest icon" class="size-5">
          <span class="text-grey text-xs font-medium font-mono uppercase tracking-wide">Why Vitest</span>
        </div>
        <h3 class="text-white max-w-xl text-balance">
          The Vite Native Test Runner
        </h3>
        <a href="/guide/why" target="_blank" class="button w-fit mt-8 hidden lg:block">Learn more</a>
      </div>
      <div class="lg:max-w-lg">
        <p class="text-pretty mb-5">
          <a href="https://vite.dev" target="_blank"><code
            class="mr-1 outline-none bg-nickel/50 text-vite"
          >Vite</code></a> has become the shared foundation for
          modern
          web development - but test runners like <a href="https://jestjs.io/" target="_blank"><code
            class="mr-1 outline-none bg-nickel/50 text-zest"
          >Jest</code></a>
          cannot reuse its resolution and transform
          pipeline, resulting in duplicated configurations and compatibility issues.
        </p>
        <p class="text-pretty mb-5">
          Vitest was born to solve this problem: by building on top of Vite, Vitest natively
          understands everything you have configured for your Vite app, and the tests just work.
        </p>
        <p class="text-pretty">
          That said, you can totally use Vitest without using Vite - even for backend code. It's a
          great test runner in
          its own right.
        </p>
        <a href="/guide/why" target="_blank" class="button w-fit mt-8 block lg:hidden">Learn more</a>
      </div>
    </div>
  </div>
</template>
