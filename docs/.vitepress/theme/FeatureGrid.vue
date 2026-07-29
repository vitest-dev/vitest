<script setup>
import esmAnimation from '@assets/vitest/animations/640_x_300_esm.riv'
import vitePoweredAnimation from '@assets/vitest/animations/650_x_300_vite_powered.riv'
import RiveAnimation from '@components/shared/RiveAnimation.vue'
</script>

<template>
  <section class="wrapper wrapper--ticks border-t grid lg:grid-cols-2 divide-x divide-y divide-nickel">
    <div class="flex flex-col gap-3">
      <div class="p-5 sm:p-10 pb-0 sm:pb-0 flex flex-col gap-3">
        <h5 class="text-balance sm:text-pretty text-white">
          Vite Powered
        </h5>
        <p class="sm:max-w-[30rem] text-pretty">
          Reuse <code
            class="mr-1 outline-none bg-nickel/50 text-vite"
          >Vite</code>'s config and plugins - consistent across your app and tests.
          But it's not required to use Vitest!
        </p>
      </div>
      <RiveAnimation
        :desktop-src="vitePoweredAnimation"
        :desktop-width="650"
        :desktop-height="300"
        canvas-class="w-full"
      />
    </div>
    <div class="flex flex-col gap-3 border-r-0 justify-between">
      <div class="p-5 sm:p-10 pb-0 sm:pb-0 flex flex-col gap-3">
        <h5 class="text-white">
          Jest Compatible
        </h5>
        <p class="max-w-[28rem] text-pretty">
          Expect, snapshot, coverage, and more - migrating from <code
            class="mr-1 outline-none bg-nickel/50 text-zest"
          >Jest</code> is
          straightforward.
        </p>
      </div>
      <div class="flex-1 flex items-center justify-center p-5 sm:p-10">
        <img src="@assets/vitest/vitest-jest-compatible.png" inert loading="lazy" alt="jest compatible" class="w-full max-w-50">
      </div>
    </div>
    <div class="flex flex-col gap-3 justify-between">
      <div class="p-5 sm:p-10 flex flex-col gap-3">
        <h5 class="text-white">
          Smart & instant watch mode
        </h5>
        <p class="max-w-[23rem] text-pretty">
          Only rerun the related changes, just like HMR for tests!
        </p>
      </div>
      <div class="card-bg px-5 sm:px-10 pt-5 sm:pt-10 flex justify-center">
        <img src="@assets/vitest/vitest-watcher.png" inert loading="lazy" alt="typed api">
      </div>
    </div>
    <div class="flex flex-col gap-3 justify-between">
      <div class="p-5 sm:p-10 pb-0 sm:pb-0 flex flex-col gap-3">
        <h5 class="text-white">
          ESM, TypeScript, JSX
        </h5>
        <p class="max-w-[25rem] text-pretty">
          Out-of-box ESM, TypeScript and JSX support powered by <code class="mx-1 outline-none bg-nickel/50 text-aqua">Oxc</code>.
        </p>
      </div>
      <RiveAnimation
        :desktop-src="esmAnimation"
        :desktop-width="640"
        :desktop-height="300"
        canvas-class="w-full"
      />
    </div>
  </section>
  <section class="wrapper border-t py-10 flex items-center justify-center">
    <a href="/guide/features" class="button">See full features list</a>
  </section>
</template>

<style scoped>
.card-bg {
  background-image: url('@assets/vitest/vitest-watcher-background.jpg');
  background-size: cover;
  background-position: center;
}
</style>
