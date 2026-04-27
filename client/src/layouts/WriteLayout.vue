<template>
  <!-- Zen layout: deliberately empty wrapper. No header, no nav, no footer.
       The Write page provides everything the writer needs through the
       floating tools cluster. Anything else on screen breaks the contract. -->
  <div class="min-h-screen page-canvas">
    <slot />
  </div>
</template>

<script setup lang="ts">
// No imports — this layout is intentionally empty. Sign-out, navigation,
// and mobile menu live in WritingToolsCluster (rendered by Write.vue) so
// the writing surface stays uncluttered.
</script>
