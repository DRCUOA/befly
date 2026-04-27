<template>
  <article class="help-article">
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-4xl mx-auto">
        <router-link to="/help" class="inline-flex items-center gap-2 text-sm font-sans text-ink-lighter hover:text-ink mb-8">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          All help
        </router-link>
        <p class="text-xs uppercase tracking-widest font-sans text-ink-lighter mb-3">Guide 2</p>
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4 leading-tight">
          The AI assistant
        </h1>
        <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed">
          What it does, what it deliberately doesn&rsquo;t do, what gets sent
          where, and how to read the suggestions it gives back.
        </p>
      </div>
    </div>

    <div class="w-full px-4 sm:px-6 md:px-8 py-10 bg-paper">
      <div class="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-[14rem_minmax(0,1fr)] gap-8 lg:gap-12">

        <aside class="lg:sticky lg:top-6 lg:self-start text-sm">
          <p class="text-xs uppercase tracking-widest font-sans text-ink-lighter mb-3">In this guide</p>
          <nav class="space-y-2 font-sans text-ink-light">
            <a href="#philosophy" class="block hover:text-ink">Philosophy</a>
            <a href="#gap-analysis" class="block hover:text-ink">What gap analysis does</a>
            <a href="#gap-types" class="block pl-3 hover:text-ink">— The seven gap types</a>
            <a href="#confidence" class="block pl-3 hover:text-ink">— Confidence and action types</a>
            <a href="#provenance" class="block pl-3 hover:text-ink">— Provenance and grounding</a>
            <a href="#reading-results" class="block hover:text-ink">Reading the results</a>
            <a href="#workflow" class="block pl-3 hover:text-ink">— Accept, reject, delete</a>
            <a href="#what-gets-sent" class="block hover:text-ink">What gets sent to OpenAI</a>
            <a href="#privacy" class="block pl-3 hover:text-ink">— Privacy</a>
            <a href="#cost" class="block pl-3 hover:text-ink">— Cost and tokens</a>
            <a href="#setup" class="block hover:text-ink">Setup</a>
            <a href="#failure-modes" class="block hover:text-ink">When it goes wrong</a>
          </nav>
        </aside>

        <div class="prose-content space-y-10">

          <section id="philosophy">
            <h2>Philosophy</h2>
            <p>
              The AI here is asked to be a <strong>structural editor</strong>, not a
              ghostwriter. The product rules built into the system prompt and into the
              code itself are explicit about this:
            </p>
            <ul class="form-list">
              <li>Work only from your material; never invent events, people, or facts.</li>
              <li>Preserve your voice; do not flatten unusual phrasing into corporate clarity.</li>
              <li>Prefer outlines, questions, and structural notes over finished prose.</li>
              <li>Treat productive roughness &mdash; contradiction, unresolved feeling, odd phrasing &mdash; as potentially valuable, not as a problem to fix.</li>
              <li>Show which excerpts every suggestion is grounded in.</li>
              <li>Ask a question when the manuscript is missing something, rather than fabricating an answer.</li>
            </ul>
            <p>
              These aren&rsquo;t marketing copy. They&rsquo;re enforced in the prompt
              the model receives on every call, and the response is parsed defensively
              so a model that ignores them produces a smaller, less surprising effect
              on the manuscript than one that follows them.
            </p>
          </section>

          <section id="gap-analysis">
            <h2>What gap analysis does</h2>
            <p>
              Gap analysis walks the spine in the order a reader would experience it
              and inspects every adjacent pair of items. For each pair it asks:
              <em>will the reader move smoothly from this to this, or is something
              missing?</em>
            </p>
            <p>
              For each junction it produces:
            </p>
            <ul class="form-list">
              <li>A short summary of how the transition currently reads.</li>
              <li>Zero or more <strong>suggestions</strong>, each describing a specific gap, what kind of gap it is, and what could close it.</li>
              <li>Provenance: short verbatim excerpts from your essays that anchor each suggestion.</li>
            </ul>
            <p>
              You can run a full pass (every junction) by clicking <strong>Find gaps</strong>
              in the Book Room header, or target a single junction (not yet exposed in the
              UI; the API supports it). Each junction is one LLM call, so a manuscript with
              twenty items will produce nineteen calls.
            </p>
            <p>
              Junctions where both items are empty placeholders are skipped &mdash; there&rsquo;s
              nothing to analyse. The result panel tells you how many were skipped.
            </p>

            <h3 id="gap-types">The seven gap types</h3>
            <ul class="form-list">
              <li><strong>Context</strong> &mdash; the reader doesn&rsquo;t know enough background to follow what comes next.</li>
              <li><strong>Emotional</strong> &mdash; the feeling jumps too quickly. The earlier piece ends one way; the later piece begins somewhere disconnected.</li>
              <li><strong>Logical</strong> &mdash; the argument skips a step.</li>
              <li><strong>Time</strong> &mdash; the timeline is unclear. The reader doesn&rsquo;t know if a day has passed or a decade.</li>
              <li><strong>Character</strong> &mdash; a person appears without enough grounding for the reader to know who they are.</li>
              <li><strong>Motif</strong> &mdash; an image or figure appeared powerfully earlier and isn&rsquo;t developed when it could be.</li>
              <li><strong>Repetition</strong> &mdash; the same idea has appeared too often without progression.</li>
            </ul>
            <p>
              You&rsquo;ll get suggestions tagged with one of these. They&rsquo;re a
              prompt for your thinking, not a verdict &mdash; sometimes a &ldquo;gap&rdquo;
              is exactly the silence you wanted.
            </p>

            <h3 id="confidence">Confidence and action types</h3>
            <p>Each suggestion comes with two more labels:</p>
            <p>
              <strong>Confidence</strong> &mdash; how strongly the model thinks this is a real
              gap. Low / medium / high. Don&rsquo;t over-trust any of them. Treat
              &ldquo;low&rdquo; as &ldquo;possibly worth a look&rdquo; and &ldquo;high&rdquo;
              as &ldquo;this junction is probably worth your attention.&rdquo;
            </p>
            <p>
              <strong>Action type</strong> &mdash; what kind of edit might close the gap.
            </p>
            <ul class="form-list">
              <li><strong>add_bridge</strong> &mdash; write a short transition between the two pieces.</li>
              <li><strong>revise</strong> &mdash; rework one of the pieces (usually the opening or closing).</li>
              <li><strong>reorder</strong> &mdash; the pieces don&rsquo;t belong adjacent in this order.</li>
              <li><strong>cut</strong> &mdash; one of the pieces (or part of it) might not earn its place.</li>
              <li><strong>expand</strong> &mdash; one of the pieces needs more scene, image, or context.</li>
              <li><strong>question</strong> &mdash; the model needs information from you it can&rsquo;t derive.</li>
              <li><strong>note</strong> &mdash; a structural observation worth holding without an immediate edit.</li>
            </ul>

            <h3 id="provenance">Provenance and grounding</h3>
            <p>
              Every suggestion lists what it was <strong>grounded in</strong> &mdash; short
              verbatim excerpts from your essays that the model used to anchor its
              reasoning. Click <em>Grounded in</em> on any suggestion in the Find Gaps
              panel to see them.
            </p>
            <p>
              This is the single most important thing to look at before deciding
              whether a suggestion is worth acting on. A suggestion grounded in real
              text from your own pieces is meaningfully different from a suggestion
              that&rsquo;s just generic literary advice. If the &ldquo;grounded in&rdquo;
              section is thin or doesn&rsquo;t actually quote your work, treat the
              suggestion with extra scepticism.
            </p>
          </section>

          <section id="reading-results">
            <h2>Reading the results</h2>
            <p>
              A useful read of a gap analysis takes ten or fifteen minutes. A few
              habits that help:
            </p>
            <ul class="form-list">
              <li>
                <strong>Skim summaries first.</strong> Each artifact has a one-sentence
                summary describing the transition. Reading just the summaries gives you
                a fast picture of where the manuscript is breathing and where it&rsquo;s
                stalling.
              </li>
              <li>
                <strong>Trust the &ldquo;no significant gap&rdquo; results.</strong>
                If a junction comes back with zero suggestions, that&rsquo;s a positive
                signal, not nothing. The model walked it and didn&rsquo;t flag anything.
              </li>
              <li>
                <strong>Be honest about contradictions.</strong> Sometimes the model
                will flag a tonal jump (grief to administration, say) and the jump is
                exactly the point. Reject it. The product is designed to preserve
                productive difficulty, not to smooth it out.
              </li>
              <li>
                <strong>Re-run the same junction after a change.</strong> When you
                change a piece, the previous gap analysis for its junctions may no
                longer apply. The accept/reject status survives across re-runs, so you
                can see &ldquo;this gap I already accepted&rdquo; vs &ldquo;here&rsquo;s
                a new one.&rdquo;
              </li>
            </ul>

            <h3 id="workflow">Accept, reject, delete</h3>
            <p>The three buttons on each artifact card behave differently:</p>
            <ul class="form-list">
              <li>
                <strong>Accept</strong> &mdash; the suggestion stays visible at full
                opacity. It&rsquo;s also passed back to future gap analyses on the same
                manuscript so the model can see what you&rsquo;ve already accepted and
                avoid re-suggesting it.
              </li>
              <li>
                <strong>Reject</strong> &mdash; the suggestion stays in your history,
                dimmed, so you can see what&rsquo;s been considered. It&rsquo;s
                <em>not</em> passed back to future runs &mdash; rejection is treated as
                a private decision, not as guidance for the AI.
              </li>
              <li>
                <strong>Delete</strong> &mdash; permanent. Removes the artifact entirely.
              </li>
            </ul>
          </section>

          <section id="what-gets-sent">
            <h2>What gets sent to OpenAI</h2>
            <p>
              Each gap analysis call sends OpenAI exactly the material it needs to
              analyse one junction:
            </p>
            <ul class="form-list">
              <li>The manuscript&rsquo;s title and form.</li>
              <li>Your literary direction fields (central question, through-line, emotional arc, narrative promise) when you&rsquo;ve set them.</li>
              <li>The titles, summaries, and full bodies of the two essays at this junction (bodies are trimmed to ~3500 characters from each end if very long).</li>
              <li>The titles of any prior <em>accepted</em> gap-analysis artifacts for this manuscript, so the model doesn&rsquo;t repeat itself.</li>
            </ul>
            <p>
              That&rsquo;s the entire payload. No theme list, no other manuscripts, no
              user identifiers, no other essays. The system prompt forbids inventing
              facts, so even if the model has training-data knowledge of your topic,
              it&rsquo;s instructed to ignore it and reason only from the supplied
              material.
            </p>

            <h3 id="privacy">Privacy</h3>
            <p>
              By default, OpenAI&rsquo;s API does not train on data sent through the
              API (their published policy). Their data retention is up to 30 days for
              abuse monitoring, then deleted. If your work is sensitive enough that
              this matters, you have a few options:
            </p>
            <ul class="form-list">
              <li>
                Don&rsquo;t use AI assist. The rest of the manuscript layer (spine,
                literary direction, drag-and-drop, export) works completely without it.
              </li>
              <li>
                Use a self-hosted or locally-run model. The <code>LlmClient</code>
                interface in <code>server/src/services/llm/llm-client.ts</code> is
                provider-agnostic; an alternative implementation can replace OpenAI
                without touching the rest of the code.
              </li>
              <li>
                Apply for OpenAI&rsquo;s zero-data-retention agreement if you have a
                business case for it.
              </li>
            </ul>

            <h3 id="cost">Cost and tokens</h3>
            <p>
              By default the app uses <code>gpt-4o-mini</code>, OpenAI&rsquo;s cheapest
              capable model. A typical gap-analysis call sends a few thousand input
              tokens (the two essay bodies are the bulk) and produces a few hundred
              output tokens. As of writing, that&rsquo;s a tenth of a cent or so per
              junction. A full pass on a 20-item manuscript is around 19 calls &mdash;
              call it two or three cents at the upper bound.
            </p>
            <p>
              You can change the model by setting <code>OPENAI_MODEL</code> in the
              server&rsquo;s environment. <code>gpt-4o</code> produces noticeably
              richer suggestions but costs roughly 30&times; more per token. Think
              about what you want before you bump it.
            </p>
          </section>

          <section id="setup">
            <h2>Setup</h2>
            <p>The AI is off by default. To enable it:</p>
            <ol class="form-list">
              <li>Get an OpenAI API key from <code>platform.openai.com</code>.</li>
              <li>Add <code>OPENAI_API_KEY=sk-...</code> to the server&rsquo;s <code>.env</code> file.</li>
              <li>Optionally set <code>OPENAI_MODEL=gpt-4o</code> if you want richer (more expensive) output. Default is <code>gpt-4o-mini</code>.</li>
              <li>Restart the server.</li>
            </ol>
            <p>
              If the key isn&rsquo;t set when you click <strong>Find gaps</strong>, the
              server returns a clean &ldquo;AI assist is not configured&rdquo; message.
              Nothing breaks; the rest of the app keeps working.
            </p>
          </section>

          <section id="failure-modes">
            <h2>When it goes wrong</h2>
            <p>A few real-world failure modes worth knowing about.</p>
            <ul class="form-list">
              <li>
                <strong>Suggestions that aren&rsquo;t grounded.</strong> If the
                &ldquo;Grounded in&rdquo; section is empty or contains generic phrasing
                rather than actual excerpts from your work, the model has slipped from
                grounded reasoning into generic advice. Reject those; they&rsquo;re not
                useful.
              </li>
              <li>
                <strong>Suggestions that flatten your voice.</strong> If a suggestion
                proposes a bridge sentence that sounds nothing like you, ignore the
                example sentence and consider only the structural insight. The model
                is asked to provide structural notes, not finished prose, but it
                sometimes drifts.
              </li>
              <li>
                <strong>Suggestions that &ldquo;fix&rdquo; intentional roughness.</strong>
                The product is designed to preserve productive difficulty &mdash;
                contradiction, unresolved feeling, odd phrasing that carries meaning.
                If a suggestion wants to smooth out something you put in deliberately,
                reject it. The reject status is your record that you&rsquo;ve already
                considered and dismissed it.
              </li>
              <li>
                <strong>OpenAI API errors.</strong> Rate limits, transient outages, etc.
                The error message will say what happened. The artifact won&rsquo;t be
                created on failure; nothing is half-saved.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
// Pure content.
</script>

<style scoped>
.help-article { min-height: 100vh; }
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
.prose-content :deep(.form-list) {
  list-style: disc;
  padding-left: 1.25rem;
  font-weight: 300;
  line-height: 1.7;
  color: var(--ink-light, #555);
}
.prose-content :deep(.form-list strong) { color: var(--ink, #222); }
.prose-content :deep(.form-list li) { margin-bottom: 0.4rem; }
.prose-content :deep(ol.form-list)  { list-style: decimal; }
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
