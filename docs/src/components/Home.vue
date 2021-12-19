<template>
  <div flex flex-col items-center>
    <div flex flex-col items-center p="t-10 md:t-20 b-10">
      <img src="/logo.svg" h="40 md:60">
      <h1 text-3em md:text-4em font-light>
        Vitest
      </h1>
      <p text="1.2em center" leading-7 op60 font-normal tracking-wide>
        A blazing fast unit-test framework<br>powered by
        <a href="https://vitejs.dev" target="_blank" font="bold">Vite ⚡️</a>
      </p>
      <div
        text-center
        flex
        flex-col
        sm:flex-row
        flex-wrap
        items-center
        gap-4
        mt-5
        children:my0
      >
        <a class="btn bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 saturate-80" href="/guide/">
          <span class="i-carbon:page-last inline-block text-lg" />
          <span ma>Get Started</span>
        </a>
        <a class="btn bg-lime-500 hover:bg-lime-600 dark:bg-lime-600 dark:hover:bg-lime-700 saturate-80" href="/guide/why">
          <span class="i-carbon:list-checked inline-block text-lg" />
          <span ma>Learn More</span>
        </a>
      </div>
    </div>

    <h3 op50 font-normal pt-10>
      Features
    </h3>
    <FeaturesList class="max-w-140 text-lg" />

    <h3 id="made-by" op50 font-normal pt-5 pb-2>
      Made by
    </h3>
    <Collaborators />
    <p op80 text-lg max-w-150 text-center leading-7>
      ...and the Vitest <a href="https://github.com/antfu-sponsors/vitest/network/dependencies" target="_blank">contributors</a>.<br><br>
      <a href="https://discord.com/invite/2zYZNngd7y">Join the community</a> and get involved!
    </p>
    <div mb-30 />
  </div>
</template>
