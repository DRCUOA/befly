<template>
  <article class="help-article">
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-4xl mx-auto">
        <router-link to="/help" class="inline-flex items-center gap-2 text-sm font-sans text-ink-lighter hover:text-ink mb-8">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          All help
        </router-link>
        <p class="text-xs uppercase tracking-widest font-sans text-ink-lighter mb-3">Guide 1</p>
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4 leading-tight">
          Working with manuscripts
        </h1>
        <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed">
          A manuscript is the layer above your frags where a body of work
          starts to find its shape. This guide explains every field, every
          structural piece, and the workflow they&rsquo;re designed for.
        </p>
      </div>
    </div>

    <!-- Body -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-10 bg-paper">
      <div class="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-[14rem_minmax(0,1fr)] gap-8 lg:gap-12">

        <!-- Side TOC -->
        <aside class="lg:sticky lg:top-6 lg:self-start text-sm">
          <p class="text-xs uppercase tracking-widest font-sans text-ink-lighter mb-3">In this guide</p>
          <nav class="space-y-2 font-sans text-ink-light">
            <a href="#what-is-a-manuscript" class="block hover:text-ink">What is a manuscript</a>
            <a href="#literary-direction" class="block hover:text-ink">Literary direction</a>
            <a href="#central-question" class="block pl-3 hover:text-ink">— Central question</a>
            <a href="#through-line" class="block pl-3 hover:text-ink">— Through-line</a>
            <a href="#emotional-arc" class="block pl-3 hover:text-ink">— Emotional arc</a>
            <a href="#narrative-promise" class="block pl-3 hover:text-ink">— Narrative promise</a>
            <a href="#form" class="block pl-3 hover:text-ink">— Form</a>
            <a href="#status" class="block pl-3 hover:text-ink">— Status</a>
            <a href="#source-themes" class="block pl-3 hover:text-ink">— Source themes</a>
            <a href="#the-spine" class="block hover:text-ink">The spine</a>
            <a href="#sections" class="block pl-3 hover:text-ink">— Sections</a>
            <a href="#items" class="block pl-3 hover:text-ink">— Items</a>
            <a href="#item-types" class="block pl-3 hover:text-ink">— Item types</a>
            <a href="#workflow" class="block hover:text-ink">Suggested workflow</a>
            <a href="#export" class="block hover:text-ink">Exporting your manuscript</a>
          </nav>
        </aside>

        <!-- Content -->
        <div class="prose-content space-y-10">

          <section id="what-is-a-manuscript">
            <h2>What is a manuscript</h2>
            <p>
              In this app a <strong>manuscript</strong> is not the same thing as a folder.
              A folder collects material. A manuscript gives that material literary
              direction: a question it&rsquo;s circling, a through-line that holds it
              together, a sequence that the reader will move through. You can have many
              themes and never need a manuscript. You start a manuscript when you want
              the work to become a <em>book</em>, not just a pile.
            </p>
            <p>
              A manuscript draws from one or more themes. The frags themselves stay in
              your library &mdash; the manuscript references them. You can include the
              same frag in two different manuscripts; you can leave frags out;
              you can include frags you haven&rsquo;t written yet (placeholders).
            </p>
            <div class="callout">
              <p class="callout-label">Practical:</p>
              <p>
                Open <router-link to="/manuscripts">Manuscripts</router-link> to see
                what you&rsquo;ve started. From any theme detail page there&rsquo;s a
                &ldquo;Start a manuscript from this theme&rdquo; button that pre-fills
                the source theme.
              </p>
            </div>
          </section>

          <section id="literary-direction">
            <h2>Literary direction</h2>
            <p>
              These are the fields you set when you create or edit a manuscript.
              Each one shapes how the AI assistant later interprets the work
              &mdash; it&rsquo;s the &ldquo;retrieval&rdquo; in retrieval-before-generation.
              Leaving a field blank is fine; you don&rsquo;t have to know everything
              upfront.
            </p>

            <h3 id="central-question">Central question</h3>
            <p>
              The single question your work keeps circling. Not a topic
              (&ldquo;grief&rdquo;) but an interrogation of the topic
              (&ldquo;How does a person keep living when absence becomes part of the
              furniture of life?&rdquo;).
            </p>
            <p class="example">
              <strong>Why it matters:</strong> when the AI weighs gaps and bridges,
              it&rsquo;s asking &ldquo;does this transition serve the central question,
              or wander away from it?&rdquo; A manuscript without a central question
              still works, but the AI has less to anchor on.
            </p>

            <h3 id="through-line">Through-line</h3>
            <p>
              What holds the frags together as a single work. The thread you can
              point to and say <em>that&rsquo;s why these belong in the same book</em>.
              Often discovered, not declared &mdash; you can leave it blank and come
              back when you can name it.
            </p>
            <p class="example">
              <strong>Example:</strong>
              &ldquo;Reflections on grief, ageing, memory, desire, and the strange
              discipline of continuing.&rdquo;
            </p>

            <h3 id="emotional-arc">Emotional arc</h3>
            <p>
              How you want the reader to feel the journey changing across the book.
              Not the plot. The shape of feeling &mdash; from refusal to acceptance,
              from suspicion to tenderness, from certainty to doubt.
            </p>

            <h3 id="narrative-promise">Narrative promise</h3>
            <p>
              What the opening implies the book will deliver. The contract you set
              with the reader in the first few pages. If you can&rsquo;t name it yet,
              that&rsquo;s a useful signal &mdash; it often means the opening
              isn&rsquo;t doing the work it needs to.
            </p>

            <h3 id="form">Form</h3>
            <p>
              What kind of book this wants to be. The form changes how the AI treats
              it &mdash; a frag collection allows more variation between pieces;
              a long-form frag expects a single sustained argument; a memoir expects
              forward chronology and rising stakes.
            </p>
            <ul class="form-list">
              <li><strong>Memoir</strong> &mdash; first-person life narrative, time-shaped.</li>
              <li><strong>Frag collection</strong> &mdash; discrete pieces that can be read separately, but resonate when read in order.</li>
              <li><strong>Long-form frag</strong> &mdash; one extended argument, possibly book-length.</li>
              <li><strong>Creative nonfiction</strong> &mdash; reportage, criticism, hybrid voice work.</li>
              <li><strong>Hybrid</strong> &mdash; deliberately mixes forms.</li>
              <li><strong>Fictionalised memoir</strong> &mdash; lived material moved into fiction; the form gives the AI permission for invented composite figures, etc.</li>
            </ul>

            <h3 id="status">Status</h3>
            <p>
              Where the manuscript is in its life. Not enforced by the app &mdash; just
              a label so you can quickly see what you&rsquo;re looking at when you have
              several manuscripts going.
            </p>
            <ul class="form-list">
              <li><strong>Gathering</strong> &mdash; collecting material, not yet shaping.</li>
              <li><strong>Structuring</strong> &mdash; laying out the spine, ordering pieces.</li>
              <li><strong>Drafting</strong> &mdash; actively writing the pieces themselves.</li>
              <li><strong>Bridging</strong> &mdash; writing connective tissue between pieces.</li>
              <li><strong>Revising</strong> &mdash; sentence-level work.</li>
              <li><strong>Finalising</strong> &mdash; preparing for export / publication.</li>
            </ul>

            <h3 id="source-themes">Source themes</h3>
            <p>
              The themes whose frags seed this manuscript. A manuscript can draw
              from many themes, and a frag can belong to multiple themes, so a single
              manuscript can pull from a wide net.
            </p>
            <p>
              Linking a theme doesn&rsquo;t automatically pull every frag from that
              theme into the spine &mdash; you still choose which frags go on the
              spine. Themes mostly help the AI know what kind of material to expect.
            </p>
          </section>

          <section id="the-spine">
            <h2>The spine</h2>
            <p>
              The spine is the manuscript&rsquo;s actual structure: an ordered set of
              <strong>sections</strong>, each holding an ordered set of <strong>items</strong>.
              You build it in the Book Room, the right-hand panel of any manuscript page.
            </p>
            <p>
              The spine is what the AI walks when it does gap analysis &mdash; it
              looks at every adjacent pair of items in render order and asks
              &ldquo;will the reader move smoothly from this to this?&rdquo; So even
              before you run AI assist, just laying out the spine in the order you
              <em>think</em> the reader should travel is doing real structural work.
            </p>

            <h3 id="sections">Sections</h3>
            <p>
              The macro shape of the manuscript. A section is something like
              &ldquo;Opening&rdquo;, &ldquo;The early years&rdquo;, &ldquo;After
              the diagnosis&rdquo;, or &ldquo;Resolution&rdquo;. Each section has a
              <strong>purpose</strong> tag &mdash; opening, setup, deepening, turning
              point, contrast, resolution, ending, appendix &mdash; that helps you
              think about what each section is doing in the larger arc.
            </p>
            <p>
              You can drag items between sections. Deleting a section doesn&rsquo;t
              delete its items &mdash; they&rsquo;re moved to the &ldquo;Unassigned&rdquo;
              bucket so you don&rsquo;t lose work.
            </p>

            <h3 id="items">Items</h3>
            <p>
              An item is a single thing the reader will encounter at one point in the
              manuscript. Most items are <strong>frags</strong>: they link to a real
              piece in your library, and that frag&rsquo;s text is what the reader
              gets when they reach this point. But items can also represent things
              that don&rsquo;t exist yet, or things that aren&rsquo;t frags at all.
            </p>

            <h3 id="item-types">The item types</h3>
            <ul class="form-list">
              <li>
                <strong>Frag</strong> &mdash; links to an existing frag in your library.
                The export inlines the frag&rsquo;s body. The AI sees the body when it
                analyses gaps.
              </li>
              <li>
                <strong>Bridge</strong> &mdash; connective tissue between two frags.
                Often a paragraph or two; you write it directly inside the manuscript
                rather than as a standalone frag.
              </li>
              <li>
                <strong>Placeholder</strong> &mdash; a frag you haven&rsquo;t written
                yet. Drop placeholders into the spine to see the shape before the
                content exists. They appear as italic stubs in the export.
              </li>
              <li>
                <strong>Note</strong> &mdash; a working note for yourself. Excluded
                from exports by default; switch on &ldquo;Working notes&rdquo; in the
                export dialog if you want them included.
              </li>
              <li>
                <strong>Fragment</strong> &mdash; a piece of writing too small to be
                a frag yet. Excluded from exports by default for the same reason.
              </li>
            </ul>

            <p>
              Items can also have a <strong>structural role</strong>: introduces theme,
              complicates theme, personal example, turning point, counterpoint,
              deepening, release, conclusion. This is optional &mdash; useful when
              you want to see at a glance what each item is doing in the arc.
            </p>
          </section>

          <section id="workflow">
            <h2>Suggested workflow</h2>
            <ol class="form-list workflow">
              <li>
                <strong>Gather first.</strong> Write frags into themes. Don&rsquo;t
                worry about a manuscript until you have material.
              </li>
              <li>
                <strong>Start a manuscript when the work starts to want a shape.</strong>
                Set the title, source themes, and a working subtitle. Leave the
                literary-direction fields blank if you don&rsquo;t know them yet.
              </li>
              <li>
                <strong>Drop your existing frags onto the spine.</strong> Just put them
                in some order &mdash; don&rsquo;t agonise. You&rsquo;re trying to see
                the shape, not finalise it.
              </li>
              <li>
                <strong>Add sections and reorder.</strong> Drag pieces between sections
                until the macro structure looks right. Add placeholders for pieces you
                know are missing.
              </li>
              <li>
                <strong>Fill in the literary direction.</strong> Once the spine is
                roughly there, you&rsquo;ll start to see the central question and
                through-line more clearly. Edit them in place from the Book Room
                left panel.
              </li>
              <li>
                <strong>Run gap analysis.</strong> See <router-link to="/help/ai-assist">the AI assist guide</router-link>
                for what this does and how to read the results.
              </li>
              <li>
                <strong>Iterate.</strong> Reorder. Write bridges. Convert placeholders
                into real frags. Re-run gap analysis on specific junctions you&rsquo;ve
                changed.
              </li>
              <li>
                <strong>Export when you want to read it as a book.</strong>
                Markdown today; pipe through pandoc for DOCX or PDF.
              </li>
            </ol>
          </section>

          <section id="export">
            <h2>Exporting your manuscript</h2>
            <p>
              The Export button in the Book Room produces a single Markdown file. It
              respects the spine: sections become H2s, items become H3s, frag bodies
              are inlined, and bridges read as transitions. A few options worth knowing:
            </p>
            <ul class="form-list">
              <li>
                <strong>Literary direction</strong> &mdash; on by default. Adds a header
                block with the central question, through-line, etc. Turn off for a
                clean reader-facing export.
              </li>
              <li>
                <strong>Table of contents</strong> &mdash; off by default; opt in.
              </li>
              <li>
                <strong>Placeholders</strong> &mdash; on by default. They appear as
                italic stubs so the structure stays visible. Turn off for a draft
                that only contains finished work.
              </li>
              <li>
                <strong>Working notes / Fragments / AI notes</strong> &mdash; off by
                default. Useful if you&rsquo;re exporting for review.
              </li>
              <li>
                <strong>Number frags</strong> &mdash; prefixes frag headings with
                1., 2.&hellip; Numbering only counts frags, not bridges or
                placeholders.
              </li>
            </ul>
            <p>
              The export does <em>not</em> bundle your cover image files &mdash; they
              stay on the server. If you&rsquo;re moving a manuscript between
              deployments, copy <code>/uploads/cover/</code> separately.
            </p>
          </section>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
// Pure content. Anchors handled by browser.
</script>

<style scoped>
.help-article {
  min-height: 100vh;
}
.prose-content :deep(h2) {
  font-size: 1.5rem;
  font-weight: 300;
  letter-spacing: -0.01em;
  margin-bottom: 0.75rem;
  scroll-margin-top: 2rem;
}
.prose-content :deep(h3) {
  font-size: 1.125rem;
  font-weight: 400;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  scroll-margin-top: 2rem;
}
.prose-content :deep(p) {
  font-weight: 300;
  line-height: 1.7;
  color: var(--ink-light, #555);
  margin-bottom: 0.75rem;
}
.prose-content :deep(strong) { color: var(--ink, #222); font-weight: 500; }
.prose-content :deep(em)     { font-style: italic; }
.prose-content :deep(.example) {
  font-size: 0.9375rem;
  color: var(--ink-light, #555);
  border-left: 2px solid var(--line, #e5e5e5);
  padding-left: 0.75rem;
  margin: 0.5rem 0 1rem;
}
.prose-content :deep(.form-list) {
  list-style: disc;
  padding-left: 1.25rem;
  font-weight: 300;
  line-height: 1.7;
  color: var(--ink-light, #555);
}
.prose-content :deep(.form-list strong) { color: var(--ink, #222); }
.prose-content :deep(.form-list li) { margin-bottom: 0.4rem; }
.prose-content :deep(.workflow) {
  list-style: decimal;
}
.prose-content :deep(.callout) {
  background: var(--surface, #fafafa);
  border-left: 3px solid var(--ink-lighter, #999);
  padding: 0.75rem 1rem;
  margin: 1rem 0;
}
.prose-content :deep(.callout-label) {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink-lighter, #999);
  font-weight: 500;
  margin-bottom: 0.25rem;
}
.prose-content :deep(.callout p) { margin-bottom: 0; }
.prose-content :deep(a) { color: inherit; text-decoration: underline; }
.prose-content :deep(a:hover) { color: var(--ink, #222); }
.prose-content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.875em;
  background: var(--surface, #fafafa);
  padding: 1px 4px;
  border-radius: 2px;
}
</style>
