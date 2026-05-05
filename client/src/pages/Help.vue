<template>
  <div class="help-page">
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-24 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-4xl mx-auto text-center">
        <p class="text-xs sm:text-sm tracking-widest uppercase font-sans text-ink-lighter mb-4">
          Help
        </p>
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-6 leading-tight">
          How to get the most out of this app
        </h1>
        <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed max-w-2xl mx-auto">
          Three guides for the parts of the app that reward a little explanation:
          shaping a manuscript, working with the AI assistant without losing your voice,
          and moving frags in and out of the system.
        </p>
      </div>
    </div>

    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-paper">
      <div class="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <router-link
          to="/help/manuscripts"
          class="help-card group block bg-paper border border-line p-8 hover:border-ink-lighter transition-colors duration-300"
        >
          <p class="text-xs uppercase tracking-widest font-sans text-ink-lighter mb-3">Guide 1</p>
          <h2 class="text-xl font-light tracking-tight mb-3 group-hover:text-ink-light transition-colors">
            Manuscripts
          </h2>
          <p class="text-sm font-light text-ink-light leading-relaxed">
            What a manuscript is in this app, why it&rsquo;s more than a folder of frags,
            and how to use the literary direction fields, sections, and the spine to
            shape a body of work.
          </p>
        </router-link>

        <router-link
          to="/help/ai-assist"
          class="help-card group block bg-paper border border-line p-8 hover:border-ink-lighter transition-colors duration-300"
        >
          <p class="text-xs uppercase tracking-widest font-sans text-ink-lighter mb-3">Guide 2</p>
          <h2 class="text-xl font-light tracking-tight mb-3 group-hover:text-ink-light transition-colors">
            AI assistant
          </h2>
          <p class="text-sm font-light text-ink-light leading-relaxed">
            How gap analysis works, the seven kinds of gap it looks for,
            what gets sent to OpenAI, and the rules that keep the assistant
            a structural editor instead of a ghostwriter.
          </p>
        </router-link>

        <router-link
          to="/help/import-export"
          class="help-card group block bg-paper border border-line p-8 hover:border-ink-lighter transition-colors duration-300"
        >
          <p class="text-xs uppercase tracking-widest font-sans text-ink-lighter mb-3">Guide 3</p>
          <h2 class="text-xl font-light tracking-tight mb-3 group-hover:text-ink-light transition-colors">
            Import &middot; Export
          </h2>
          <p class="text-sm font-light text-ink-light leading-relaxed">
            The JSON envelope format, theme dedup behaviour, ownership choices,
            and how to back up or move frags between deployments. Admin only.
          </p>
        </router-link>
      </div>
    </div>

    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-surface/50">
      <div class="max-w-3xl mx-auto">
        <h2 class="text-xl font-light tracking-tight mb-4">A note on philosophy</h2>
        <p class="text-base font-light text-ink-light leading-relaxed mb-3">
          This is a writing companion, not a writing machine. The point of every feature
          here &mdash; the manuscript layer, the spine, the AI assist modes, even the
          import-export &mdash; is to help you shape your own work without flattening it
          into something generic.
        </p>
        <p class="text-base font-light text-ink-light leading-relaxed">
          The AI is asked to be a structural editor: to find gaps, suggest order,
          identify motifs, ask questions. It is explicitly asked <em>not</em> to write
          finished prose for you, not to invent facts or memories, and not to flatten
          unusual phrasing into corporate clarity. If you ever find a feature pushing in
          the other direction, that&rsquo;s a bug worth flagging.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Pure content page. No state needed.
</script>

<style scoped>
.help-page {
  min-height: 100vh;
}
.help-card {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s;
}
.help-card:hover {
  transform: translateY(-2px);
}
</style>
