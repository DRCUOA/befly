# Manuscript-scoped RAG layer

## Overview

The app supports many users, many writing fragments, and many manuscript
projects per user. Every AI request that relates to a manuscript must
draw context from **only that manuscript** — no cross-manuscript bleed,
no global semantic search across the user's whole corpus.

This document describes the layer that enforces and serves that
guarantee. It lives in `server/src/services/rag/` and is invoked by:

- `manuscript-assist.service.ts` — the gap-analysis assist mode (and any
  future manuscript-level mode).
- `writing-assist.service.ts` — the per-essay coherence mode, when the
  essay belongs to a manuscript.
- `scripts/rag-cli.ts` — admin / dev reindexing.

## Why retrieval is manuscript-scoped

The relational data layer already decides which writing blocks, beats,
characters, motifs and uploaded files belong to which manuscript. The
RAG layer respects those boundaries rather than re-deriving them with a
free-text search across everything.

Concretely:

- The compiler reads only one manuscript's data per pass.
- Every row it writes carries `manuscript_id` directly.
- The retriever's SQL has `manuscript_id = $1` in the same `WHERE`
  clause as the vector op.
- `retrieveManuscriptContext` requires `manuscriptId` as a positional
  argument; there is no global retrieval mode.

## Data boundary model

```
users
 └── manuscript_projects        ←──── ai_exchanges.manuscript_id  (FK)
       ├── manuscript_sections
       ├── manuscript_items  ──→ writing_blocks (re-usable across manuscripts)
       ├── manuscript_artifacts
       ├── characters / motifs / beats / silences / causal_links
       ├── manuscript_uploaded_files  ──→ uploaded_files
       │
       ├── manuscript_context_sources   ←─ compiler writes here
       ├── context_chunks               ←─ chunker writes here
       └── context_embeddings           ←─ embedder writes here
```

Every RAG row pins to `manuscript_projects(id)` via `ON DELETE CASCADE`
so deleting a manuscript also drops its context rows.

A `writing_block` may be re-used across manuscripts. The compiler
emits one context source per `(manuscript_id, writing_block_id)` pair,
which is the right granularity: the block's body is the same, but its
*role* in each manuscript is different.

An `uploaded_file` is global per user but only enters the context layer
when explicitly attached via `manuscript_uploaded_files` with
`include_in_ai = true`.

## `manuscript_context_sources`

The compiler writes one row per AI-readable "document". Source rows
carry:

- `source_type` — what kind of thing it was compiled from (e.g.
  `'character'`, `'beat'`, `'manuscript_item'`, `'uploaded_file'`).
- `source_id` — UUID into the originating domain table, or NULL for
  free-form notes.
- `title`, `body` — the human-readable name and the prose the chunker
  will split.
- `metadata` — JSONB with whatever structured fields the origin row
  had. Used for post-filtering in retrieval (character names,
  movement, etc.).
- `context_role` — what the source IS to the manuscript: `canon`,
  `draft`, `research`, `character`, `plot`, etc.
- `priority`, `canonical`, `status`, `include_in_ai` — retrieval knobs
  (see *Retrieval scoring* below).
- `content_hash` — SHA-256 of `title + body`. The compiler skips
  rewrites when the hash matches.

The unique index `(manuscript_id, source_type, source_id) WHERE
source_id IS NOT NULL` lets the compiler upsert idempotently.

## Context compiler

`compileManuscriptContext(manuscriptId, options?)` reads:

- `manuscript_projects` (the project itself + its literary direction)
- `manuscript_sections`
- `manuscript_items` (with their joined `writing_blocks`)
- `writing_blocks` (one row per block linked to the manuscript)
- `manuscript_artifacts` (only `draft` and `accepted` artifacts)
- `characters` and `character_misreadings`
- `motifs` and `motif_voice_variants`
- `beats` (with POV character resolved)
- `silences`
- `causal_links` (with from/to beat names)
- `manuscript_uploaded_files` joined to `uploaded_files`

Each becomes a context source row via `manuscriptContextRepo.upsertSource`.

The compiler runs in three modes:

| Outcome      | When                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| `created`    | The first time a (manuscript, source_type, source_id) is seen.         |
| `updated`    | The body changed since the last compile (hash mismatch).               |
| `unchanged`  | Hash matches and status is not `superseded` — no write happens.        |

After upserting every active source, the compiler calls
`markStaleAsSuperseded` to flip rows whose origin row no longer exists
to `status = 'superseded'`. Retrieval excludes superseded rows by
default, so a deleted character disappears from context immediately
without losing audit history.

## Chunking

`chunkManuscriptContext(manuscriptId)` walks every active source and
delegates to `chunkContextSource(source)`:

- Approximate token count = `ceil(chars / 4)` (close enough for
  budgeting; we don't pull in tiktoken for this).
- Targets: ~800 tokens per chunk, ~120-token overlap (env-tunable).
- Splits prefer paragraph breaks, fall back to sentences, and
  hard-cut as a last resort.
- A chunk's `content_hash` is the SHA-256 of its text. If the
  aggregate hash of all chunks for a source matches what's already in
  the DB, the rebuild is skipped — embeddings stay too.

Chunks always carry `manuscript_id` directly (denormalised from the
parent source) so retrieval can scope without a `JOIN`.

## Embeddings

Stored in `context_embeddings` using `pgvector`'s `vector(1536)`.

- Dimension is fixed at 1536 in the migration to match
  `text-embedding-3-small`. A different-dim model needs a separate
  migration that adds a column or table — we do not let runtime config
  silently mismatch the column type.
- The `(chunk_id, embedding_model)` UNIQUE lets us coexist with
  multiple embedding models in the future (e.g. small + large for
  premium users) without breaking idempotent re-runs.
- Index: `ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`.
  Sensible default for the corpus sizes a single manuscript produces.

The provider client is injectable via `setEmbeddingClientForTests` —
exactly the same hook the chat client uses. The default production
client hits `https://api.openai.com/v1/embeddings` directly with no
SDK dependency.

`embedManuscriptContext(manuscriptId)` only embeds chunks that don't
yet have a vector for the configured model. Re-running on an
already-embedded manuscript is a no-op.

## Retrieval scoring

Vector search is cosine distance, converted to similarity as
`1 - distance`. On top of that:

| Signal                | Effect            |
| --------------------- | ----------------- |
| `canonical = true`    | +0.15             |
| `status = 'accepted'` | +0.10             |
| `priority`            | + priority / 1000 |
| `status` rejected/archived/superseded | excluded by default |
| `include_in_ai = false` | excluded always |

Filters available on `RetrievalOptions`:

- `sourceTypes`, `contextRoles` — narrow the search.
- `characterNames`, `movement` — post-filters on metadata.
- `topK`, `maxContextTokens` — bound the size of the result.
- `includeArchived` — opt back into the rows that are excluded by
  default.

The retrieval helper short-circuits to an empty result if
`stats.embeddings === 0` for the manuscript. This means:

- Tests don't burn API tokens embedding a query against an empty
  corpus.
- The assist services degrade gracefully when a manuscript hasn't
  been indexed yet.

## AI prompt integration

Three call sites use the retrieval layer today:

- `manuscript-assist` — gap-analysis mode (whole-manuscript runs only)
- `writing-assist` — coherence mode when the essay is part of a manuscript
- `manuscript-chat` — every turn in the chat drawer

All three send `LlmRequestContext.manuscriptId` through to the OpenAI
client; the client persists it on `ai_exchanges.manuscript_id`
(migration 021). This makes every AI exchange queryable per-manuscript.

### Manuscript chat

The chat drawer accessible from each manuscript's detail page is the
primary consumer of retrieval — it's the only call site that asks
ad-hoc questions across the whole indexed corpus. Schema in
[migration 023](../server/src/db/migrations/023_manuscript_chats.sql);
service in
[manuscript-chat.service.ts](../server/src/services/manuscript-chat.service.ts);
UI in
[ChatDrawer.vue](../client/src/components/manuscripts/ChatDrawer.vue).

Per-turn flow:

1. Persist the user's message to `manuscript_chat_messages` immediately
   (so the conversation state survives an LLM failure).
2. Retrieve a fresh manuscript-scoped context pack for the new question.
3. Send `system + retrieved_pack + last 6 turns + new question` via
   `LlmClient.chatText` (non-JSON mode — returns markdown).
4. Persist the assistant reply with `retrieved_chunk_ids` for provenance
   and `ai_exchange_id` for the diagnostic audit trail.

Chats are private to their author even when the manuscript is shared.
The per-conversation model is chosen from a curated allow-list
(`MANUSCRIPT_CHAT_MODELS` in
[shared/ManuscriptChat.ts](../shared/ManuscriptChat.ts)) so a typo can't
break a thread. History is capped at the last 6 messages — older turns
are simply dropped (no summary rollup yet).

The retrieval helper is invoked best-effort:

```
async function tryRetrieveContextPack(manuscriptId, query) {
  try { ...retrieve... } catch { return '' }
}
```

A non-empty `contextPack` is prepended to the user prompt as:

```
Use the retrieved manuscript context below as authoritative project
memory unless the user explicitly overrides it.

<retrieved_manuscript_context>
{contextPack}
</retrieved_manuscript_context>

{...existing prompt...}
```

For the gap-analysis mode, retrieval is skipped when the user
specified a single junction — they've already narrowed the scope and
don't want surrounding manuscript content bleeding in.

For the writing-assist `coherence` mode, retrieval fires when the
essay belongs to a manuscript the caller can read.

## Reindexing

CLI commands (run from the `server/` directory):

```
npm run rag:compile -- --manuscript <id>
npm run rag:chunk   -- --manuscript <id>
npm run rag:embed   -- --manuscript <id>
npm run rag:reindex -- --manuscript <id> [--force]
npm run rag:search  -- --manuscript <id> --query "voice guide for Marcus"
npm run rag:stats   -- --manuscript <id>
npm run rag:list    -- --manuscript <id>
```

`reindex` runs compile → chunk → embed in one pass. `--force` salts
the compile-stage hashes so every source rewrites and downstream
chunks/embeddings rebuild from scratch. Use it after upgrading the
compiler to a new prose template.

## Environment variables

| Var                       | Purpose                                  | Default                  |
| ------------------------- | ---------------------------------------- | ------------------------ |
| `OPENAI_API_KEY`          | Embeddings provider key                  | (required for embed)     |
| `EMBEDDING_MODEL`         | OpenAI embeddings model id               | `text-embedding-3-small` |
| `RAG_TOP_K`               | Default top-K for retrieval              | 8                        |
| `RAG_MAX_CONTEXT_TOKENS`  | Default max-tokens for the context pack  | 4000                     |
| `OPENAI_MODEL`            | Chat model used by the assist services   | `gpt-4o-mini`            |

## Testing

Tests live alongside the code in `server/src/services/rag/`:

- `chunker.test.ts` — pure-logic, no DB, no LLM.
- `manuscript-segregation.test.ts` — DB-backed; asserts the cross-
  manuscript-leak guarantee with a deterministic fake embedder.

The fake embedder produces unit vectors from a token-based hash so
tests get stable ordering and similarity without an OpenAI key.
Migrations through `022_manuscript_rag.sql` must be applied for
DB-backed tests to run; if the local Postgres lacks the `vector`
extension, migration 022 fails loudly — by design.

## Known limitations

- Uploaded-file bodies are not yet extracted. The compiler emits a
  metadata-only context source for each attached upload; a follow-up
  pipeline (PDF / DOCX extraction) is needed before file content
  contributes to retrieval.
- Re-ranking is a single-pass cosine search. For larger manuscripts a
  second-stage cross-encoder rerank could improve precision; out of
  scope here.
- Hybrid (BM25 + vector) search is not implemented. PostgreSQL FTS
  could be added with one more index and an OR clause in
  `searchByVector`; the scoring rules already leave a slot for a
  keyword signal.
- Retrieval is best-effort in the assist services. If the RAG layer is
  misconfigured the assist still runs, just without retrieval. This
  was a deliberate degradation choice — we'd rather lose the
  enhancement than fail an assist call.
