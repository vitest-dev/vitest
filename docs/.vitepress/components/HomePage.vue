<script setup lang="ts">
import { VPTeamMembers, VPHomeSponsors } from 'vitepress/theme'
import { teamMembers } from '../contributors'
import { sponsors } from '../sponsors'
</script>

<template>
  <div class="content">
    <div class="content-container">
      <main class="main">
        <div class="vp-doc" flex flex-col items-center>
          <h2 id="meet-the-team" op50 font-normal p="t-10 b-2">
            Meet The Team
          </h2>
          <div w-full p-10>
            <VPTeamMembers size="small" :members="teamMembers" />
          </div>
        </div>
        <VPHomeSponsors
          v-if="sponsors"
          message="Vitest is free and open source, made possible by wonderful sponsors."
          :data="sponsors"
        />
        <div class="action">
          <a
            class="sponsor"
            href="https://github.com/sponsors/vitest-dev"
            target="_blank"
            rel="noreferrer"
          >
            Sponsor Vitest
          </a>
        </div>
        <p flex flex-col items-center mt-10 class="text-center opacity-75">
          <a href="https://www.netlify.com" rel="noopener noreferrer">
            <img src="/netlify.svg" alt="Deploys by Netlify" width="114" height="151" decoding="async">
          </a>
        </p>
      </main>
    </div>
  </div>
</template>

<style scoped>
.action {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding-top: 4rem;
}

.sponsor {
  /* .VPButton */
  display: inline-block;
  border: 1px solid transparent;
  text-align: center;
  font-weight: 600;
  white-space: nowrap;
  transition:
    color 0.25s,
    border-color 0.25s,
    background-color 0.25s;
  /* .VPButton.medium */
  border-radius: 20px;
  padding: 0 20px;
  line-height: 38px;
  font-size: 14px;
  /* .VPButton.sponsor */
  border-color: var(--vp-button-sponsor-border);
  color: var(--vp-button-sponsor-text);
  background-color: var(--vp-button-sponsor-bg);
}

.sponsor:hover {
  /* .VPButton.sponsor:hover */
  border-color: var(--vp-button-sponsor-hover-border);
  color: var(--vp-button-sponsor-hover-text);
  background-color: var(--vp-button-sponsor-hover-bg);
}
</style>
