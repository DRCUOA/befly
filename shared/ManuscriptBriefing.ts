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
  /**
   * Configured spine depth (1..MAX_SPINE_DEPTH). Optional on the wire
   * because legacy briefing consumers predate the Configurable Spine
   * Depth Refactor; missing means "treat as depth 1". When present,
   * `spineLayerLabels.length` equals this value.
   */
  spineDepth?: number
  /**
   * Human label for each spine layer, outermost first. Lets the
   * briefing's narrative prompt name the user's actual containers
   * (e.g. "Part / Chapter / Section") instead of generic "Section".
   */
  spineLayerLabels?: string[]
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
  /**
   * Phase 6 of the Configurable Spine Depth Refactor: tree shape so
   * downstream AI consumers can read the manuscript's container
   * hierarchy (e.g. Parts containing Chapters) rather than seeing a
   * flat list. Optional on the wire so legacy consumers ignore them;
   * a depth-1 manuscript serialises with parentSectionId=null,
   * level=1, childSectionIds=[] on every row.
   */
  parentSectionId?: string | null
  level?: number
  /** Direct children's section ids, ordered by orderIndex / createdAt. */
  childSectionIds?: string[]
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

/* ----- Beat import: preview + apply ----- */

/**
 * One field-level issue surfaced by the resolver. Five kinds:
 *
 *   - 'unknown_enum'     — incoming value isn't in the schema's whitelist
 *                          AND the schema rejects it (e.g. linkType
 *                          "reframing"). The resolved value drops to null.
 *   - 'new_enum_value'   — incoming value isn't in the canonical set but
 *                          the schema accepts arbitrary strings (today:
 *                          sceneFunctionType only — VARCHAR(64), no CHECK).
 *                          The value passes through; the UI gets a
 *                          dropdown of canonical suggestions so the user
 *                          can optionally remap to a known one.
 *   - 'unmatched_name'   — incoming reference points at a name the target
 *                          manuscript doesn't have (character / motif).
 *   - 'missing_lookup'   — incoming reference is an id but the envelope
 *                          had no name lookup to translate it. Common
 *                          when a model returns the trimmed Beats-tab
 *                          shape but loses the *NamesById blocks.
 *   - 'null_overwrite'   — for update actions only: the incoming resolved
 *                          value is null and the existing field is
 *                          non-null. By default the importer preserves
 *                          the existing value; the user must opt in to
 *                          overwrite.
 *
 * Each warning carries the original input, the resolved value, and a
 * human-readable reason so the UI can render a clear explanation per
 * field.
 */
export type BeatFieldWarningKind =
  | 'unknown_enum'
  | 'new_enum_value'
  | 'unmatched_name'
  | 'missing_lookup'
  | 'null_overwrite'

export interface BeatFieldWarning {
  field: string
  kind: BeatFieldWarningKind
  reason: string
  /** What the envelope said. Often a string like "frame_contract" or a UUID. */
  inputValue: unknown
  /** What the resolver landed on after validation/lookup. Usually null. */
  resolvedValue: unknown
  /** For 'null_overwrite' only: the existing value the importer would otherwise preserve. */
  existingValue?: unknown
  /**
   * For 'new_enum_value' only: canonical alternatives the UI should offer
   * as remap options in a dropdown alongside "keep imported value".
   */
  suggestions?: string[]
}

/**
 * Resolved beat fields ready to write. Mirrors BriefingBeat but motifs use
 * the canonical {motifId, variantNote} shape (after string[] shorthand has
 * been expanded), and ids in povCharacterId / knowledge[].characterId /
 * motifs[].motifId have already been mapped to target-manuscript ids.
 */
export interface ResolvedBeat {
  itemId: string | null
  povCharacterId: string | null
  label: string | null
  title: string | null
  timelinePoint: string | null
  movement: string | null
  outerEvent: string | null
  innerTurn: string | null
  voiceConstraint: string | null
  finalImage: string | null
  sceneFunctionType: string | null
  withholdingLevel: string | null
  uniquePerception: string | null
  blindSpot: string | null
  misreading: string | null
  readerInference: string | null
  reasonForNextPovSwitch: string | null
  knowledge: {
    characterId: string | null
    knowledgeKind: string
    text: string
  }[]
  motifs: {
    motifId: string
    variantNote: string | null
  }[]
}

/** Per-field diff entry (only populated for action='update'). */
export interface BeatFieldDiff {
  field: string
  /** Existing value in the target manuscript. */
  from: unknown
  /** Value the importer would write if the user accepts. */
  to: unknown
}

export type BeatImportAction = 'create' | 'update' | 'no_change'

/** A single beat in the preview plan. */
export interface BeatImportPlanItem {
  /** Source id from the envelope. Falls back to "__index_N" when missing. */
  sourceId: string
  /** Action the resolver intends to take if the user accepts. */
  action: BeatImportAction
  /**
   * Existing beat id in the target manuscript that this incoming beat
   * matched, if any. Null for fresh creates.
   */
  matchedBeatId: string | null
  /** How the match was found, for the UI to explain itself. */
  matchedBy: 'id' | 'label' | null
  /** Display label used in the UI: "P00 — Title…" */
  display: string
  /** Resolved fields ready to write. */
  resolved: ResolvedBeat
  /** Per-field warnings — invalid enum values, unmatched names, etc. */
  warnings: BeatFieldWarning[]
  /** Field-by-field diff against the existing beat. Empty for create. */
  diff: BeatFieldDiff[]
}

/** Causal-link entry in the plan. */
export interface CausalLinkPlanItem {
  /** Source ids as they appeared in the envelope. */
  fromSourceId: string
  toSourceId: string
  linkType: string
  note: string | null
  /**
   * Whether both endpoints will resolve given the current decisions. The
   * preview computes this assuming all beats with action != 'skip' will go
   * through; the apply phase recomputes against the user's final choices.
   */
  willResolve: boolean
  reason?: string
}

export interface BeatsImportPlan {
  total: number
  beats: BeatImportPlanItem[]
  causalLinks: CausalLinkPlanItem[]
  /**
   * Names referenced by the envelope that don't exist in the target
   * manuscript. These cause 'unmatched_name' warnings on individual beats;
   * the deduplicated rollup here is for the summary panel.
   */
  unmatched: {
    characterNames: string[]
    motifNames: string[]
  }
  /**
   * True when the envelope had no characterNamesById or motifNamesById and
   * the resolver derived them from a `characters[]` / `motifs[]` block on
   * the envelope. Lets the UI explain why some refs may have unmatched
   * names that look like UUIDs in older payloads.
   */
  derivedLookups: {
    characters: boolean
    motifs: boolean
  }
}

/**
 * Per-field overrides chosen by the user during review. Lets the user
 * remap an unfamiliar enum value (e.g. sceneFunctionType: "frame_contract")
 * to a canonical one before the import writes. The import writes the
 * imported value as-is unless an override is set.
 *
 * Only fields with permissive DB storage are remappable here; fields with
 * CHECK constraints (withholdingLevel, knowledgeKind, linkType) are
 * already strict at the resolver and can't reach this map.
 */
export interface BeatFieldRemaps {
  /** Override for sceneFunctionType. null = explicit "write null". */
  sceneFunctionType?: string | null
}

/** What the user decides to do per beat in the apply phase. */
export interface BeatImportDecision {
  /** 'apply' = persist the resolved values; 'skip' = leave this beat alone. */
  action: 'apply' | 'skip'
  /**
   * For 'update' actions only: when true, fields whose resolved value is
   * null are written as null (overwriting the existing value). When false
   * (the default), those fields preserve their existing value. Has no
   * effect on 'create' actions because there's no existing value to
   * preserve.
   */
  allowOverwriteWithNull?: boolean
  /**
   * Per-field remaps the user chose during review. Values here override
   * what the resolver produced; missing keys mean "use the resolver's
   * value". Used today only for sceneFunctionType remapping; extensible
   * to other permissive fields later.
   */
  fieldRemaps?: BeatFieldRemaps
}

/**
 * Apply-phase request body. The envelope is sent again so the server can
 * re-run resolution end-to-end (avoiding stale-plan races) and apply the
 * user's decisions.
 */
export interface BeatsImportApplyRequest {
  envelope: BeatsImportEnvelope
  decisions: Record<string, BeatImportDecision>
}

/** Final result returned by the apply endpoint. */
export interface BeatsImportResult {
  total: number
  /** Beats freshly created. */
  created: {
    sourceId: string
    newId: string
    label: string | null
    title: string | null
  }[]
  /** Beats matched to existing rows and updated. */
  updated: {
    sourceId: string
    beatId: string
    label: string | null
    title: string | null
    /** Number of fields written in the update. */
    fieldsChanged: number
  }[]
  /** Beats explicitly skipped by the user. */
  skipped: { sourceId: string; reason: string }[]
  /** Per-beat errors that didn't stop the import. */
  errors: { sourceId: string; error: string }[]
  causalLinks: {
    created: number
    updated: number
    skipped: number
  }
  unmatched: {
    characterNames: string[]
    motifNames: string[]
  }
}
