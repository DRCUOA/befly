<template>
  <div class="reading-stage-manager">
    <slot
      :current-stage="currentStage"
      :interface-visible="interfaceVisible"
      :progress-bar-visible="progressBarVisible"
      :progress-bar-faded="progressBarFaded"
      :back-button-visible="backButtonVisible"
      :back-button-faded="backButtonFaded"
      :scroll-percent="scrollPercent"
      :is-near-end="isNearEnd"
    />
  </div>
</template>

<script setup lang="ts">
import { useReadingStage } from '../../composables/useReadingStage'
import { useReadingProgress } from '../../composables/useReadingProgress'

const {
  currentStage,
  interfaceVisible,
  progressBarVisible,
  progressBarFaded,
  backButtonVisible,
  backButtonFaded,
} = useReadingStage()

const { scrollPercent, isNearEnd } = useReadingProgress()
</script>

<style scoped>
.reading-stage-manager {
  /* Container for stage management */
}
</style>
