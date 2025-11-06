<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  screenshotUrls: string[]
  alt?: string
}>()

const showFullscreen = ref(false)
const currentIndex = ref(0)

// Extract filename from URL
function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url, window.location.origin)
    const path = urlObj.searchParams.get('path') || ''
    return path.split('/').pop()?.split('\\').pop() || 'screenshot.png'
  }
  catch {
    return 'screenshot.png'
  }
}

// Extract short label from filename (e.g., "1", "2", "auto") for display in carousel thumbnails
// Pattern: test-name-NUMBER-instance or test-name-auto-instance
// The instance name is the last segment (or doesn't exist)
// The label is the second-to-last segment (or last if no instance)
function getShortLabel(filename: string): string {
  // Remove .png extension
  const nameWithoutExt = filename.replace(/\.png$/, '')

  const parts = nameWithoutExt.split('-')

  // Check if "auto" exists
  const autoIndex = parts.lastIndexOf('auto')
  if (autoIndex !== -1) {
    return 'auto'
  }

  // Look for last number in the parts (should be before instance name)
  // Start from the end and find the first number
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(parts[i])) {
      return parts[i]
    }
  }

  // Fallback to full filename
  return filename
}

const filenames = computed(() => props.screenshotUrls.map(getFilenameFromUrl))
const shortLabels = computed(() => filenames.value.map(getShortLabel))

function openFullscreen(index: number) {
  currentIndex.value = index
  showFullscreen.value = true
}

function closeFullscreen() {
  showFullscreen.value = false
}

function nextImage() {
  if (currentIndex.value < props.screenshotUrls.length - 1) {
    currentIndex.value++
  }
}

function prevImage() {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeFullscreen()
  }
  else if (event.key === 'ArrowRight') {
    nextImage()
  }
  else if (event.key === 'ArrowLeft') {
    prevImage()
  }
}
</script>

<template>
  <div class="screenshot-carousel">
    <!-- Thumbnails Grid -->
    <div class="screenshot-grid">
      <div
        v-for="(url, index) in screenshotUrls"
        :key="url"
        class="screenshot-item"
      >
        <img
          :src="url"
          :alt="alt || `Test screenshot ${index + 1}`"
          class="screenshot-thumbnail"
          @click="openFullscreen(index)"
        >
        <div class="screenshot-filename">
          {{ shortLabels[index] }}
        </div>
      </div>
    </div>

    <!-- Fullscreen overlay -->
    <div
      v-if="showFullscreen"
      class="screenshot-overlay"
      tabindex="0"
      @click="closeFullscreen"
      @keydown="handleKeydown"
    >
      <!-- Navigation buttons -->
      <button
        v-if="currentIndex > 0"
        class="screenshot-nav screenshot-nav-prev"
        @click.stop="prevImage"
      >
        ‹
      </button>

      <img
        :src="screenshotUrls[currentIndex]"
        :alt="alt || `Test screenshot ${currentIndex + 1}`"
        class="screenshot-fullscreen"
        @click.stop
      >

      <button
        v-if="currentIndex < screenshotUrls.length - 1"
        class="screenshot-nav screenshot-nav-next"
        @click.stop="nextImage"
      >
        ›
      </button>

      <!-- Counter with filename -->
      <div class="screenshot-counter">
        <div class="screenshot-counter-text">
          {{ currentIndex + 1 }} / {{ screenshotUrls.length }}
        </div>
        <div class="screenshot-counter-filename">
          {{ filenames[currentIndex] }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.screenshot-carousel {
  margin: 0.5rem 0;
}

.screenshot-grid {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.screenshot-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.screenshot-thumbnail {
  max-height: 200px;
  max-width: 300px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
  border: 1px solid rgba(128, 128, 128, 0.2);
}

.screenshot-thumbnail:hover {
  opacity: 0.8;
}

.screenshot-filename {
  font-size: 0.75rem;
  color: rgba(128, 128, 128, 0.8);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.screenshot-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
}

.screenshot-overlay:focus {
  outline: none;
}

.screenshot-fullscreen {
  max-width: 90vw;
  max-height: 90vh;
  cursor: default;
  border-radius: 4px;
}

.screenshot-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 2.5rem;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  padding-bottom: 0.15rem;
}

.screenshot-nav:hover {
  background: rgba(255, 255, 255, 0.2);
}

.screenshot-nav-prev {
  left: 2rem;
}

.screenshot-nav-next {
  right: 2rem;
}

.screenshot-counter {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  text-align: center;
}

.screenshot-counter-text {
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.screenshot-counter-filename {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  max-width: 50vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
