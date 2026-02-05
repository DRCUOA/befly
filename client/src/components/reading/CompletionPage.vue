<template>
  <div class="completion-page">
    <!-- Completion space -->
    <div class="silence-space"></div>

    <!-- Navigation options -->
    <section class="soft-affordances-section pb-32">
      <div
        v-for="(option, index) in exitOptions"
        :key="index"
        class="text-center mb-12"
      >
        <router-link
          v-if="option.type === 'link'"
          :to="option.route!"
          class="suggestive-link soft-link text-base font-light text-ink-lighter sans tracking-wide"
        >
          {{ option.label }}
        </router-link>
      </div>

    </section>

    <!-- Final space -->
    <div class="silence-space"></div>

    <!-- Reverent footer -->
    <section class="reverent-footer-section pb-20">
      <div class="flex flex-col items-center space-y-8 opacity-30">
        <div class="flex items-center space-x-8 text-xs font-light text-ink-lighter sans tracking-wider">
          <router-link
            to="/"
            class="hover:text-ink"
          >
            About
          </router-link>
          <span class="text-ink-whisper">·</span>
          <router-link
            to="/home"
            class="hover:text-ink"
          >
            Archive
          </router-link>
          <span class="text-ink-whisper">·</span>
          <a
            href="#"
            class="hover:text-ink"
          >
            Subscribe
          </a>
        </div>
        <div class="text-xs font-light text-ink-whisper sans tracking-wider">
          © 2025
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface ExitOption {
  type: 'link' | 'button'
  label: string
  route?: string
}

interface Props {
  exitOptions?: ExitOption[]
}

const props = withDefaults(defineProps<Props>(), {
  exitOptions: () => [
    { type: 'link', label: 'Back to essays', route: '/home' },
    { type: 'link', label: 'Browse more', route: '/home' },
  ],
})

</script>

<style scoped>
.completion-page {
  max-width: 48rem;
  margin: 0 auto;
  padding: 0 2rem;
}

.deep-breath-space {
  margin-bottom: 6rem;
}

.contemplative-space {
  margin-bottom: 12rem;
}

.silence-space {
  height: 30vh;
}

.soft-link {
  border: none;
  background: none;
  text-decoration: none;
  position: relative;
}

.soft-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 1px;
  background: currentColor;
}

.soft-link:hover::after {
  width: 100%;
}

.suggestive-link {
  cursor: pointer;
}
</style>
