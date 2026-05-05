<template>
  <article class="help-article">
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-gradient-to-b from-paper to-surface">
      <div class="max-w-4xl mx-auto">
        <router-link to="/help" class="inline-flex items-center gap-2 text-sm font-sans text-ink-lighter hover:text-ink mb-8">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          All help
        </router-link>
        <p class="text-xs uppercase tracking-widest font-sans text-ink-lighter mb-3">Guide 3 · Admin</p>
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4 leading-tight">
          Import &middot; Export frags
        </h1>
        <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed">
          Move frags in and out of the system as JSON. Bulk migration, backups,
          and account-to-account transfers.
        </p>
      </div>
    </div>

    <div class="w-full px-4 sm:px-6 md:px-8 py-10 bg-paper">
      <div class="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-[14rem_minmax(0,1fr)] gap-8 lg:gap-12">

        <aside class="lg:sticky lg:top-6 lg:self-start text-sm">
          <p class="text-xs uppercase tracking-widest font-sans text-ink-lighter mb-3">In this guide</p>
          <nav class="space-y-2 font-sans text-ink-light">
            <a href="#what-it-is" class="block hover:text-ink">What it is</a>
            <a href="#envelope" class="block hover:text-ink">The envelope format</a>
            <a href="#export-tab" class="block hover:text-ink">Export</a>
            <a href="#import-tab" class="block hover:text-ink">Import</a>
            <a href="#ownership" class="block pl-3 hover:text-ink">— Ownership</a>
            <a href="#themes-dedup" class="block pl-3 hover:text-ink">— Theme dedup</a>
            <a href="#partial-failure" class="block pl-3 hover:text-ink">— Partial failure</a>
            <a href="#cover-images" class="block hover:text-ink">Cover images</a>
            <a href="#use-cases" class="block hover:text-ink">Use cases</a>
            <a href="#limits" class="block hover:text-ink">Payload limits</a>
          </nav>
        </aside>

        <div class="prose-content space-y-10">

          <section id="what-it-is">
            <h2>What it is</h2>
            <p>
              The Import / Export tool lives in the Admin view (button in the
              header). It lets an admin export frags as a single JSON file, and
              import a JSON file back into the same or a different deployment.
              Three tabs:
            </p>
            <ul class="form-list">
              <li><strong>Export</strong> &mdash; pick a scope and download a file.</li>
              <li><strong>Import</strong> &mdash; upload a file, choose ownership, run.</li>
              <li><strong>Template</strong> &mdash; download an example file with inline documentation.</li>
            </ul>
            <p>
              Admin-only at every step. The endpoints behind it require both
              authentication and the <code>admin</code> role.
            </p>
          </section>

          <section id="envelope">
            <h2>The envelope format</h2>
            <p>
              The export produces a versioned JSON envelope:
            </p>
            <pre><code>{
  "version": "1.0",
  "exportedAt": "2026-04-26T...",
  "type": "essays",
  "scopeLabel": "All essays for user ...",
  "themes":  [ ... ],
  "essays":  [ ... ],
  "users":   [ ... ]
}</code></pre>
            <p>
              <strong>Themes travel inline.</strong> Each frag&rsquo;s
              <code>themeIds</code> reference the <code>themes[]</code> array within
              the same file. On import, those IDs are remapped to the destination
              account&rsquo;s real theme IDs (see <a href="#themes-dedup">theme
              dedup</a> below).
            </p>
            <p>
              <strong>Frag IDs are advisory.</strong> The importer always assigns
              fresh UUIDs. This makes the same file safe to import twice: you get
              duplicate frags, not constraint collisions.
            </p>
            <p>
              <strong>The version is enforced.</strong> If the envelope&rsquo;s
              <code>version</code> doesn&rsquo;t match the importer&rsquo;s expected
              version, the import is rejected. We&rsquo;ll add migration helpers if
              the format ever changes incompatibly.
            </p>
            <p>
              The downloadable template under the <strong>Template</strong> tab includes
              an inline <code>_documentation</code> block explaining every field. JSON
              has no comments, so we put the readme as a key.
            </p>
          </section>

          <section id="export-tab">
            <h2>Export</h2>
            <p>Two scope choices:</p>
            <ul class="form-list">
              <li><strong>All users, all frags.</strong> Every frag in the database. Use carefully on large datasets &mdash; the file can be tens of megabytes.</li>
              <li><strong>A specific user&rsquo;s frags.</strong> Once you pick a user, an optional checkbox list appears. Tick none to export everything they have; tick some to export only those.</li>
            </ul>
            <p>
              The download is a plain anchor with <code>download</code> attribute, so
              it uses your current cookie auth and saves directly. There&rsquo;s no
              long-running job &mdash; the server assembles the envelope and streams
              it back in one request.
            </p>
            <p>
              The filename includes a timestamp and a slug derived from the scope, so
              two exports on the same day don&rsquo;t overwrite each other in your
              Downloads folder.
            </p>
          </section>

          <section id="import-tab">
            <h2>Import</h2>
            <p>Steps:</p>
            <ol class="form-list">
              <li>Drop or pick the JSON file. The client parses it and previews the count.</li>
              <li>Choose who should own the imported frags (see <a href="#ownership">ownership</a>).</li>
              <li>Optionally select a subset of frags from the file. Leave everything unchecked to import all.</li>
              <li>Click Import. The result panel shows what was created, what themes were resolved, and any per-frag errors.</li>
            </ol>

            <h3 id="ownership">Ownership</h3>
            <p>
              Imported frags are <em>always</em> assigned to a user that exists in the
              destination database. The original <code>userId</code> in the envelope is
              used only to label the export &mdash; never to assign ownership. Two
              choices:
            </p>
            <ul class="form-list">
              <li><strong>Me</strong> &mdash; the importing admin. The simplest case. Fine when you&rsquo;re moving your own work between deployments.</li>
              <li><strong>Another user</strong> &mdash; pick an existing active user from the dropdown. All imported frags will be created under that account. Useful when you&rsquo;re standing up a deployment for someone else and giving them their starter material.</li>
            </ul>

            <h3 id="themes-dedup">Theme dedup</h3>
            <p>
              When the importer encounters a theme reference, it tries to resolve the
              theme by <strong>name</strong>, case-insensitive, within the destination
              owner&rsquo;s themes. If a match exists, the existing theme is reused.
              If not, a new one is created on the destination owner.
            </p>
            <p>
              This means importing &ldquo;Grief&rdquo; from one account into another
              account that already has a theme called &ldquo;Grief&rdquo; merges them
              cleanly &mdash; you don&rsquo;t end up with two copies. It also means
              that if you import the same file twice, you get duplicate frags but
              not duplicate themes.
            </p>

            <h3 id="partial-failure">Partial failure</h3>
            <p>
              The importer doesn&rsquo;t stop when one frag fails. If frag 7 has a
              missing title, the importer logs that error in the result and continues
              to frag 8. The result panel groups the errors at the end so you can see
              what was created and what wasn&rsquo;t.
            </p>
            <p>
              This is deliberate. A 200-frag envelope failing on a single bad row
              shouldn&rsquo;t cost you the other 199 imports.
            </p>
          </section>

          <section id="cover-images">
            <h2>Cover images</h2>
            <p>
              Cover images are <strong>references, not data</strong>. The envelope
              includes <code>coverImageUrl</code> as a path string (e.g.
              <code>/uploads/cover/abc123.jpg</code>) but does <em>not</em> embed the
              actual image bytes. A 50-frag export with embedded base64 images can
              easily be 100MB; a JSON-only export is small and forgiving.
            </p>
            <p>
              Practically, this means moving a manuscript between deployments has two
              steps:
            </p>
            <ol class="form-list">
              <li>Export the JSON envelope from the source.</li>
              <li>Copy the actual image files in <code>/uploads/cover/</code> to the destination&rsquo;s same path. Then import the envelope.</li>
            </ol>
            <p>
              If you skip step 2, the frags import fine but their cover images will
              show as broken thumbnails. The fix is to copy the missing files later
              &mdash; the URLs stored in the database are still correct.
            </p>
          </section>

          <section id="use-cases">
            <h2>Use cases</h2>
            <ul class="form-list">
              <li>
                <strong>Backup.</strong> Run an export of all frags once a week; archive
                the JSON. Restoring is one click in the Import tab.
              </li>
              <li>
                <strong>Account migration.</strong> Move one user&rsquo;s work onto a
                new account. Export their frags, import as that user.
              </li>
              <li>
                <strong>Deployment migration.</strong> Bring up a new deployment,
                export from the old, import into the new. Don&rsquo;t forget to copy
                the cover image files.
              </li>
              <li>
                <strong>Bulk seeding.</strong> Hand-author a JSON file (use the
                Template tab to see the shape) and import a starter library for a
                new account.
              </li>
            </ul>
          </section>

          <section id="limits">
            <h2>Payload limits</h2>
            <p>
              The import endpoint accepts envelopes up to <strong>50MB</strong>. That
              comfortably fits thousands of frags. The general API has a 2MB cap to
              keep individual write endpoints small &mdash; the import endpoint
              overrides that with its own larger limit.
            </p>
            <p>
              On Heroku specifically, the platform router enforces an additional
              ~30MB request body limit. If you need to import an envelope larger than
              that, split it: the importer&rsquo;s <code>onlyEssayIds</code> option
              lets a single envelope file be imported in batches by selecting subsets
              of frags from the same file.
            </p>
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
.prose-content :deep(pre) {
  background: var(--surface, #fafafa);
  border: 1px solid var(--line, #e5e5e5);
  padding: 0.75rem 1rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.8125rem;
  line-height: 1.5;
  margin: 0.5rem 0 1rem;
}
.prose-content :deep(pre code) {
  background: transparent;
  padding: 0;
}
</style>
