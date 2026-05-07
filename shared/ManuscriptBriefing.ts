/**
 * Manuscript briefing envelope — a one-way "state snapshot" intended for AI
 * consumption (or a fast human read-through), not for round-trip backup.
 *
 * Why this is a separate format from the existing essay-export and the
 * manuscript Markdown export:
 *
 *   - The Markdown export is a reading copy: it produces a printable book.
 *     It is good for humans, but a model has to re-derive the structural
 *     skeleton from prose to "review the latest state".
 *
 *   - The essay-export envelope is a round-trip backup: full prose, themes,
 *     visibility, importable. Heavy. The shape is tuned for re-creating
 *     records on a different deployment.
 *
 *   - The briefing is the *planning layer made legible*: literary direction,
 *     spine, beats with their inner/outer turn, character voice bibles,
 *     causal links, motifs, silences, recent AI artifacts — everything that
 *     lets another model orient on the manuscript without ingesting every
 *     word. Prose bodies are excluded by default; the caller can opt in to
 *     short digests (first/last sentence per item) when voice flavour is
 *     useful, or — for a deep critique — to full bodies.
 *
 * Versioned so the envelope can evolve without silently breaking consumers.
 *
 * Safety note: a briefing carries the writer's deepest planning (voice
 * bible, hidden needs, false beliefs, silences). It is more sensitive than
 * the published prose, not less. The endpoint enforces the same visibility
 * rules as the rest of the manuscript repo; the `_documentation` block on
 * the envelope carries a reminder for downstream consumers.
 */

import type {
  ManuscriptForm,
  ManuscriptStatus,
  ManuscriptVisibility,
  ManuscriptSectionPurpose,
  ManuscriptItemType,
  ManuscriptStructuralRole,
  ManuscriptArtifactType,
  ManuscriptArtifactStatus,
} from './Manuscript'
import type {
  VoiceBible,
  SceneFunctionType,
  WithholdingLevel,
  KnowledgeKind,
  CausalLinkType,
  SilenceType,
} from './StoryCraft'

/**
 * Envelope version literal type. Like the essay-export envelope, the runtime
 * constant lives server-side (server/src/models/ManuscriptBriefing.ts) so the
 * tsx dev loader doesn't have to resolve a value export across the shared
 * workspace boundary.
 */
export type ManuscriptBriefingVersion = '1.0'

/**
 * Prose-inclusion level. Controls how much of the actual manuscript text
 * travels in the envelope.
 *
 *   - 'none'   : no prose at all. Smallest payload.
 *   - 'digest' : per item, the first and last sentence of its writing-block
 *                body (if any), plus the writer's `summary`. Gives a model
 *                voice flavour without the full text. The DEFAULT.
 *   - 'full'   : full prose bodies on every essay-backed item. Heavy. Use
 *                only when the consumer is doing a deep critique that
 *                requires reading every word.
 */
export type ProseLevel = 'none' | 'digest' | 'full'

/* ----- Project ----- */

export interface BriefingProject {
  id: string
  title: string
  workingSubtitle: string | null
  form: ManuscriptForm
  status: ManuscriptStatus
  visibility: ManuscriptVisibility
  intendedReader: string | null
  centralQuestion: string | null
  throughLine: string | null
  emotionalArc: string | null
  narrativePromise: string | null
  /** Theme ids the manuscript draws from. Names travel in `themes[]` below. */
  sourceThemeIds: string[]
  createdAt: string
  updatedAt: string
}

export interface BriefingTheme {
  id: string
  name: string
  slug: string
}

/* ----- Spine ----- */

export interface BriefingSection {
  id: string
  title: string
  orderIndex: number
  purpose: ManuscriptSectionPurpose
  notes: string | null
  itemIds: string[]
}

export interface BriefingItem {
  id: string
  sectionId: string | null
  writingBlockId: string | null
  itemType: ManuscriptItemType
  title: string
  orderIndex: number
  structuralRole: ManuscriptStructuralRole | null
  /** Writer-set one-line summary of what this item does. */
  summary: string | null
  /**
   * Approximate word count of the underlying writing block, if any. Cheap
   * for a model to read; lets it tell "10-word stub" from "5,000-word essay".
   */
  wordCount: number | null
  /**
   * Prose digest, or full body, depending on the requested ProseLevel. Null
   * when prose='none', when there is no writing block, or when the body is
   * empty. The shape is always a string so consumers don't have to branch
   * on prose level beyond null-checking.
   */
  prose: string | null
}

/* ----- StoryCraft ----- */

export interface BriefingCharacter {
  id: string
  name: string
  fullName: string | null
  role: string | null
  socialPosition: string | null
  contradiction: string | null
  publicWant: string | null
  privateWant: string | null
  hiddenNeed: string | null
  greatestFear: string | null
  falseBelief: string | null
  wound: string | null
  voice: VoiceBible
  arcPhases: string[]
  plotFunctions: string[]
  /** Misreadings as flat strings: "label — why" when both present. */
  misreadings: { label: string; why: string | null }[]
  /** Notes are deliberately omitted — they're the writer's scratch space. */
}

export interface BriefingMotif {
  id: string
  name: string
  function: string | null
  /** Per-character voice variants for this motif. Only includes characters with a meaning set. */
  voiceVariants: { characterId: string; meaning: string }[]
}

export interface BriefingBeat {
  id: string
  itemId: string | null
  povCharacterId: string | null
  orderIndex: number
  label: string | null
  title: string | null
  timelinePoint: string | null
  movement: string | null
  outerEvent: string | null
  innerTurn: string | null
  voiceConstraint: string | null
  finalImage: string | null
  sceneFunctionType: SceneFunctionType | null
  withholdingLevel: WithholdingLevel | null
  uniquePerception: string | null
  blindSpot: string | null
  misreading: string | null
  readerInference: string | null
  reasonForNextPovSwitch: string | null
  /** Knowledge ledger entries for this beat. Reader row = characterId null. */
  knowledge: {
    characterId: string | null
    knowledgeKind: KnowledgeKind
    text: string
  }[]
  /** Motifs touched in this beat, with optional per-beat variant note. */
  motifs: { motifId: string; variantNote: string | null }[]
}

/**
 * Causal links as a flat edge list referencing beat ids, so a consumer can
 * walk it without joining tables.
 */
export interface BriefingCausalLink {
  id: string
  fromBeatId: string
  toBeatId: string
  linkType: CausalLinkType
  note: string | null
}

export interface BriefingSilence {
  id: string
  characterId: string | null
  beatId: string | null
  whatUnsaid: string
  why: string | null
  consequence: string | null
  silenceType: SilenceType | null
}

/* ----- Recent AI artifacts ----- */

/**
 * A trimmed view of the most recent AI-generated artifacts (gap analyses,
 * spine suggestions, etc.). Tells a downstream model what the writer has
 * already considered, so it doesn't waste a turn re-deriving them.
 */
export interface BriefingArtifact {
  id: string
  type: ManuscriptArtifactType
  title: string
  status: ManuscriptArtifactStatus
  /** Type-specific structured payload. Same shape as in ManuscriptArtifact.content. */
  content: Record<string, unknown>
  fromItemId: string | null
  toItemId: string | null
  sourceModel: string | null
  createdAt: string
}

/* ----- Freshness ----- */

/**
 * Per-layer most-recent update timestamp. Tells the consuming reader what's
 * fresh and what's stale. Null when the layer has no rows.
 */
export interface BriefingFreshness {
  project: string
  spine: string | null
  beats: string | null
  characters: string | null
  motifs: string | null
  causalLinks: string | null
  silences: string | null
  artifacts: string | null
}

/* ----- Counts (cheap glance metrics) ----- */

export interface BriefingCounts {
  sections: number
  items: number
  itemsByType: Record<ManuscriptItemType, number>
  characters: number
  beats: number
  motifs: number
  causalLinks: number
  silences: number
  artifacts: number
  /** Sum of writing-block word counts across the spine. */
  totalWordCount: number
}

/* ----- Envelope ----- */

export interface ManuscriptBriefingEnvelope {
  version: ManuscriptBriefingVersion
  type: 'manuscript_briefing'
  /** ISO 8601 timestamp the briefing was assembled. */
  exportedAt: string
  /** Which prose level was used to build this envelope. Verbatim from the request. */
  proseLevel: ProseLevel
  /** Free-text label, e.g. "Briefing for 'The Long Road' (drafting, 12 items)". */
  scopeLabel: string
  /**
   * Self-describing readme. Lives as a key (JSON has no comments) so a model
   * reading the file for the first time can orient itself in seconds.
   */
  _documentation: Record<string, string>

  project: BriefingProject
  themes: BriefingTheme[]

  sections: BriefingSection[]
  items: BriefingItem[]

  characters: BriefingCharacter[]
  motifs: BriefingMotif[]
  beats: BriefingBeat[]
  causalLinks: BriefingCausalLink[]
  silences: BriefingSilence[]

  recentArtifacts: BriefingArtifact[]

  counts: BriefingCounts
  freshness: BriefingFreshness
}

/* ----- Request options (used by the controller / client API) ----- */

export interface BriefingRequestOptions {
  /** How much manuscript prose to include in items[].prose. Default: 'digest'. */
  proseLevel?: ProseLevel
  /**
   * Limit recent artifacts to the N most recent. Default: 10. Pass 0 to
   * exclude artifacts entirely.
   */
  artifactLimit?: number
}

/* ----- Beat import ----- */

/**
 * Import payload accepted by POST /api/manuscripts/:id/beats/import.
 *
 * Designed to round-trip with the Beats-tab JSON export but lenient enough
 * to accept hand-edited or model-generated payloads. Every field on a beat
 * is optional — a beat with only a title is valid; downstream nullable
 * fields just default to null in the database.
 *
 * Reference resolution:
 *
 *   - povCharacterId, knowledge[].characterId, motifs[].motifId travel as
 *     ids in the payload, but the importer resolves them by NAME against
 *     the target manuscript using the optional `characterNamesById` /
 *     `motifNamesById` lookups. If a referenced id has no entry in the
 *     lookup, or the name doesn't match a character/motif in the target,
 *     the reference resolves to null and the beat still imports.
 *
 *   - causalLinks reference beats by source id. The importer remaps each
 *     to the freshly-inserted beat's new id; links whose endpoints didn't
 *     both map (e.g. one beat failed validation) are skipped, not failed.
 *
 * Beat ids and causalLink ids in the payload are advisory. The importer
 * always assigns fresh UUIDs on insert, so the same payload imported twice
 * produces duplicates rather than collisions — the same idempotency
 * contract the essay importer offers.
 */
export interface BeatsImportEnvelope {
  /** Optional. Preserved for future format checks; not used today. */
  version?: string
  /** Optional sanity check; the importer accepts any value or absence. */
  type?: string

  /** The beat list. The only structurally-required field on the envelope. */
  beats: BeatImportInput[]

  /** Causal links by source-id reference. Optional. */
  causalLinks?: CausalLinkImportInput[]

  /**
   * Source-side character lookup: { [oldCharacterId]: name }. Used to map
   * povCharacterId and knowledge[].characterId to characters in the target
   * manuscript by NAME.
   */
  characterNamesById?: Record<string, string>

  /** Source-side motif lookup: { [oldMotifId]: name }. */
  motifNamesById?: Record<string, string>
}

/** A beat in the import payload. Every field is optional. */
export interface BeatImportInput {
  /** Source-side id. Advisory only — used for causal-link remapping. */
  id?: string
  itemId?: string | null
  povCharacterId?: string | null
  orderIndex?: number
  label?: string | null
  title?: string | null
  timelinePoint?: string | null
  movement?: string | null
  outerEvent?: string | null
  innerTurn?: string | null
  voiceConstraint?: string | null
  finalImage?: string | null
  sceneFunctionType?: string | null
  withholdingLevel?: string | null
  uniquePerception?: string | null
  blindSpot?: string | null
  misreading?: string | null
  readerInference?: string | null
  reasonForNextPovSwitch?: string | null
  knowledge?: {
    characterId?: string | null
    knowledgeKind?: string
    text?: string
  }[]
  motifs?: {
    motifId?: string
    variantNote?: string | null
  }[]
}

export interface CausalLinkImportInput {
  fromBeatId?: string
  toBeatId?: string
  linkType?: string
  note?: string | null
}

/** Result returned by the import endpoint. */
export interface BeatsImportResult {
  /** Total beats seen in the envelope (including any that failed). */
  total: number
  /** Beats successfully created, with fresh ids for client-side updates. */
  created: {
    sourceId: string
    newId: string
    label: string | null
    title: string | null
  }[]
  /** Per-beat errors that didn't stop the import. */
  errors: { sourceId: string; error: string }[]
  /** Causal-link summary. Skipped links had at least one endpoint that didn't map. */
  causalLinks: {
    created: number
    skipped: number
  }
  /**
   * Names referenced by povCharacterId / knowledge / motifs that did NOT
   * match any character or motif in the target manuscript. Surfaced so the
   * writer can create them and re-import (the original beats still
   * imported, just with the offending refs resolved to null).
   */
  unmatched: {
    characterNames: string[]
    motifNames: string[]
  }
}
