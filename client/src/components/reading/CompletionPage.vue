<template>
  <div class="completion-page">
    <!-- Final paragraph section -->
    <section class="final-paragraph-section pt-32">
      <div class="deep-breath-space">
        <p class="text-2xl leading-loose font-light ending-reverence">
          {{ finalParagraph }}
        </p>
      </div>
    </section>

    <!-- Silence space -->
    <div class="silence-space"></div>

    <!-- Gentle resurfacing section -->
    <section class="gentle-resurfacing-section earned-ending">
      <div
        v-for="(text, index) in resurfacingTexts"
        :key="index"
        class="contemplative-space gentle-fade-in"
        :style="{ animationDelay: `${(index + 1) * 1000}ms` }"
      >
        <p
          class="text-xl leading-relaxed font-light text-ink-light ending-reverence"
          :class="index === resurfacingTexts.length - 1 ? 'text-ink-lighter' : ''"
        >
          {{ text }}
        </p>
      </div>
    </section>

    <!-- Silence space -->
    <div class="silence-space"></div>

    <!-- Soft affordances section -->
    <section class="soft-affordances-section pb-32">
      <div
        v-for="(option, index) in exitOptions"
        :key="index"
        class="text-center mb-12 gentle-fade-in"
        :style="{ animationDelay: `${4000 + index * 800}ms` }"
      >
        <component
          :is="option.type === 'button' ? 'button' : 'router-link'"
          :to="option.type === 'link' ? option.route : undefined"
          @click="option.type === 'button' ? handleStay() : undefined"
          class="suggestive-link soft-link text-base font-light text-ink-lighter sans tracking-wide"
          :class="{ 'text-ink-whisper': option.type === 'button' }"
        >
          {{ option.label }}
        </component>
      </div>

      <div
        class="mt-24 text-center gentle-fade-in"
        style="animation-delay: 5000ms"
      >
        <p class="text-sm font-light text-ink-whisper sans tracking-wider">
          Thank you for reading
        </p>
      </div>
    </section>

    <!-- Final breath -->
    <div class="final-breath"></div>

    <!-- Reverent footer -->
    <section class="reverent-footer-section pb-20">
      <div class="flex flex-col items-center space-y-8 opacity-30">
        <div class="flex items-center space-x-8 text-xs font-light text-ink-lighter sans tracking-wider">
          <router-link
            to="/"
            class="hover:text-ink transition-colors duration-500"
          >
            About
          </router-link>
          <span class="text-ink-whisper">·</span>
          <router-link
            to="/home"
            class="hover:text-ink transition-colors duration-500"
          >
            Archive
          </router-link>
          <span class="text-ink-whisper">·</span>
          <a
            href="#"
            class="hover:text-ink transition-colors duration-500"
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
  finalParagraph?: string
  resurfacingTexts?: string[]
  exitOptions?: ExitOption[]
}

const props = withDefaults(defineProps<Props>(), {
  finalParagraph: "And then, without ceremony, without fanfare, without any signal except the natural completion of thought—it ends. The final sentence arrives not as a conclusion but as a resting place, a moment where the rhythm gently comes to stillness. You've been carried this far, and now the current releases you, setting you down softly on the shore.",
  resurfacingTexts: () => [
    "You sit in the silence that follows. Not an empty silence, but one full of resonance, like the moment after a bell has stopped ringing but the air still vibrates with its tone. The words have ended, but their presence remains, settling into the spaces between your thoughts.",
    "There's no rush to move. No urgent pull toward the next thing. The experience has earned this pause, this moment of integration, this gentle transition from the world of the text back to the world of ordinary time. You're grateful for both: for where you've been, and for the care with which you're being returned.",
    "The afternoon light has changed completely now. Hours have passed, though you couldn't say exactly how many. Time has been transformed, and now it's transforming back, but you're not the same. Something has shifted, subtly but irreversibly. You've spent time in a different quality of consciousness, and traces of it linger.",
  ],
  exitOptions: () => [
    { type: 'link', label: 'Another piece', route: '/home' },
    { type: 'link', label: 'Return to essays', route: '/home' },
    { type: 'button', label: 'Stay here a moment' },
  ],
})

const softLinks = ref<NodeListOf<Element> | null>(null)

const handleStay = () => {
  // Scroll to top and hide links temporarily
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })

  setTimeout(() => {
    if (softLinks.value) {
      softLinks.value.forEach((link) => {
        ;(link as HTMLElement).style.opacity = '0'
      })
    }
  }, 800)

  setTimeout(() => {
    if (softLinks.value) {
      softLinks.value.forEach((link) => {
        ;(link as HTMLElement).style.opacity = '0.4'
      })
    }
  }, 3000)
}

onMounted(() => {
  softLinks.value = document.querySelectorAll('.soft-link')
  
  // Make links visible after delay
  setTimeout(() => {
    if (softLinks.value) {
      softLinks.value.forEach((link, index) => {
        setTimeout(() => {
          ;(link as HTMLElement).style.opacity = '0.4'
        }, index * 800)
      })
    }
  }, 5000)
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
  height: 50vh;
}

.final-breath {
  height: 40vh;
}

.earned-ending {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.ending-reverence {
  line-height: 2.4;
  letter-spacing: 0.02em;
}

.gentle-fade-in {
  animation: gentleFadeIn 2s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  opacity: 0;
}

.soft-link {
  opacity: 0;
  transition: opacity 0.8s cubic-bezier(0.25, 0.1, 0.25, 1);
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
  transition: width 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.soft-link:hover {
  opacity: 1;
  transition: opacity 0.3s ease;
}

.soft-link:hover::after {
  width: 100%;
}

.suggestive-link {
  cursor: pointer;
}
</style>
