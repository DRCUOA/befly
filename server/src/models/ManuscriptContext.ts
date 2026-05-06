/**
 * Manuscript context / RAG-layer types.
 *
 * Three tables, three shapes:
 *   - ManuscriptContextSource — one compiled, AI-readable document.
 *     The compiler writes it; the chunker reads it.
 *   - ContextChunk            — a retrievable piece of a source body.
 *   - ContextEmbedding        — a vector for one chunk under one model.
 *
 * Strings (source_type, context_role, status) are kept narrow with
 * unions rather than free-form so a typo doesn't silently bypass a
 * filter at retrieval time. Adding a new source_type means updating
 * this file *and* the compiler — both are deliberate.
 */

/** All source kinds the compiler may produce. */
export type ContextSourceType =
  | 'writing_block'
  | 'manuscript_item'
  | 'manuscript_artifact'
  | 'manuscript_project'
  | 'manuscript_section'
  | 'character'
  | 'character_misreading'
  | 'beat'
  | 'beat_knowledge'
  | 'motif'
  | 'motif_voice_variant'
  | 'silence'
  | 'causal_link'
  | 'theme'
  | 'uploaded_file'
  | 'manual_note'
  | 'research_note'
  | 'style_guide'
  | 'voice_guide'
  | 'plot_guide'
  | 'ai_output'
  | 'other'

/** What the source IS to the manuscript. Drives retrieval boosts and filters. */
export type ContextRole =
  | 'manuscript_text'
  | 'canon'
  | 'draft'
  | 'research'
  | 'character'
  | 'plot'
  | 'structure'
  | 'voice'
  | 'motif'
  | 'continuity'
  | 'style'
  | 'ai_output'
  | 'supporting'

export type ContextStatus =
  | 'active'
  | 'draft'
  | 'accepted'
  | 'rejected'
  | 'archived'
  | 'superseded'

export interface ManuscriptContextSource {
  id: string
  manuscriptId: string
  userId: string

  sourceType: ContextSourceType
  /** Origin row's UUID, if the source was compiled from a domain table. */
  sourceId: string | null

  title: string
  body: string | null
  metadata: Record<string, unknown>

  contextRole: ContextRole
  priority: number
  status: ContextStatus
  canonical: boolean
  includeInAi: boolean

  contentHash: string | null

  createdAt: string
  updatedAt: string
}

export interface ContextChunk {
  id: string
  manuscriptId: string
  contextSourceId: string

  chunkIndex: number
  text: string
  tokenCount: number | null
  metadata: Record<string, unknown>
  contentHash: string

  createdAt: string
}

export interface ContextEmbeddingRow {
  id: string
  manuscriptId: string
  chunkId: string
  embeddingModel: string
  createdAt: string
  /** The vector itself is not loaded into the app layer except during retrieval. */
}

/* ----- Service-level shapes ----- */

export interface CompileOptions {
  /** Force re-write of all sources even if hashes match. Default false. */
  force?: boolean
  /** Restrict to specific source types (admin / partial reindex). */
  sourceTypes?: ContextSourceType[]
}

export interface CompileResult {
  manuscriptId: string
  /** Source rows that were inserted, updated, or kept as-is. */
  sources: { sourceType: ContextSourceType; sourceId: string | null; sourceRowId: string; action: 'created' | 'updated' | 'unchanged' }[]
  /** Sources marked superseded because their domain row no longer exists. */
  superseded: string[]
  totalActive: number
}

export interface RetrievalOptions {
  sourceTypes?: ContextSourceType[]
  contextRoles?: ContextRole[]
  characterNames?: string[]
  movement?: string
  status?: ContextStatus[]
  topK?: number
  maxContextTokens?: number
  includeMetadata?: boolean
  includeArchived?: boolean
  rerank?: boolean
}

export interface RetrievedChunk {
  chunkId: string
  contextSourceId: string
  manuscriptId: string
  title: string
  sourceType: ContextSourceType
  contextRole: ContextRole
  text: string
  score: number
  metadata: Record<string, unknown>
}

export interface RetrievedContext {
  query: string
  chunks: RetrievedChunk[]
  /** Pre-rendered prompt block ready to be inlined into a system/user prompt. */
  contextPack: string
}
