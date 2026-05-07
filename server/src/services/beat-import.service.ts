/**
 * Beat import service — preview + apply, two-phase.
 *
 * Phase 1: previewBeatsImport(...) reads the envelope, resolves every beat
 * field against the target manuscript, computes a diff for any incoming
 * beat that matches an existing one, and returns a BeatsImportPlan. No
 * writes happen.
 *
 * Phase 2: applyBeatsImport(...) takes the envelope plus the user's
 * decisions, re-runs resolution from scratch (so the apply doesn't depend
 * on stale plan state), and writes through storyCraftRepo. The user's
 * 'skip' decisions are honored as no-ops; their per-beat
 * allowOverwriteWithNull flag controls whether resolved nulls are written
 * over existing non-null values.
 *
 * Path B leniencies built in here:
 *
 *   - characterNamesById / motifNamesById are auto-derived from
 *     `envelope.characters[]` / `envelope.motifs[]` if those arrays are
 *     present and the explicit lookup blocks are missing. Lets the full
 *     briefing JSON round-trip without the writer touching the file.
 *
 *   - beat.motifs accepts both shapes:
 *       string[]                                — bare ids
 *       { motifId, variantNote }[]              — canonical
 *
 *   - Resolution outcomes are surfaced as field-level warnings (unknown
 *     enum, unmatched name, missing lookup, would-overwrite-with-null),
 *     so the UI never silently loses a value.
 *
 * Dedup:
 *
 *   - First, match the incoming beat by exact id against existing beats in
 *     the target manuscript.
 *   - If no id match and the incoming beat has a non-empty label, fall
 *     back to label match (case-insensitive).
 *   - If neither matches: action=create, fresh UUID.
 *
 * Knowledge entries and beat-motif links are upserted on update (existing
 * repo semantics). They're additive — entries present on the existing beat
 * but absent in the incoming list are left alone, so re-imports are never
 * destructive.
 */
import { storyCraftRepo } from '../repositories/storycraft.repo.js'
import {
  CAUSAL_LINK_TYPES,
  KNOWLEDGE_KINDS,
  SCENE_FUNCTION_TYPES,
  WITHHOLDING_LEVELS,
  type Beat,
  type CausalLinkType,
  type KnowledgeKind,
  type SceneFunctionType,
  type WithholdingLevel,
} from '../models/StoryCraft.js'
import type {
  BeatsImportEnvelope,
  BeatImportInput,
  CausalLinkImportInput,
  BeatsImportResult,
  BeatsImportPlan,
  BeatImportPlanItem,
  CausalLinkPlanItem,
  BeatFieldWarning,
  BeatFieldDiff,
  ResolvedBeat,
  BeatImportDecision,
} from '../models/ManuscriptBriefing.js'
import { ValidationError } from '../utils/errors.js'

/* ----- Validation ----- */

const SCENE_FUNCTION_SET = new Set<string>(SCENE_FUNCTION_TYPES)
const WITHHOLDING_SET = new Set<string>(WITHHOLDING_LEVELS)
const KNOWLEDGE_KIND_SET = new Set<string>(KNOWLEDGE_KINDS)
const CAUSAL_LINK_SET = new Set<string>(CAUSAL_LINK_TYPES)

function validateEnvelope(raw: unknown): BeatsImportEnvelope {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Import payload must be a JSON object')
  }
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.beats)) {
    throw new ValidationError('Import payload must contain a "beats" array')
  }
  if (obj.causalLinks !== undefined && !Array.isArray(obj.causalLinks)) {
    throw new ValidationError('"causalLinks" must be an array if present')
  }
  return obj as unknown as BeatsImportEnvelope
}

/* ----- Small coercion helpers ----- */

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

function nonNegInt(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null
  return Math.floor(v)
}

/**
 * Validate an enum-style field. Returns the value if it's in the whitelist,
 * or { ok: false, reason } if not. The caller decides whether to surface a
 * warning or just drop silently.
 */
function checkEnum(
  v: unknown,
  set: Set<string>,
  fieldName: string
):
  | { ok: true; value: string | null }
  | { ok: false; reason: string; input: unknown } {
  if (v === null || v === undefined) return { ok: true, value: null }
  if (typeof v !== 'string') {
    return { ok: false, reason: `${fieldName}: expected string, got ${typeof v}`, input: v }
  }
  if (set.has(v)) return { ok: true, value: v }
  return { ok: false, reason: `${fieldName}: "${v}" is not a recognized value`, input: v }
}

/* ----- Path B: name lookup derivation ----- */

/**
 * Build a source-side id → name lookup. Prefer the explicit *NamesById map
 * if present (the trimmed Beats-tab export shape); otherwise derive from a
 * full `characters[]` / `motifs[]` block on the envelope (the full
 * briefing shape). Either form round-trips cleanly.
 */
function deriveNameLookup(
  explicit: Record<string, string> | undefined,
  fullList: { id?: unknown; name?: unknown }[] | undefined
): { lookup: Record<string, string>; derived: boolean } {
  if (explicit && typeof explicit === 'object' && !Array.isArray(explicit)) {
    return { lookup: explicit, derived: false }
  }
  if (!Array.isArray(fullList)) return { lookup: {}, derived: false }
  const lookup: Record<string, string> = {}
  for (const row of fullList) {
    if (!row || typeof row !== 'object') continue
    const id = typeof row.id === 'string' ? row.id : null
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (id && name) lookup[id] = name
  }
  return { lookup, derived: Object.keys(lookup).length > 0 }
}

/* ----- Resolver: pure, no DB writes ----- */

/**
 * Output of the per-beat resolver. Ready to feed into the diff step
 * (against existing beat) and the apply step (write to DB). Warnings
 * carry every spot where the resolver landed on a different value than
 * the input.
 */
interface ResolvedBeatResult {
  resolved: ResolvedBeat
  warnings: BeatFieldWarning[]
}

/**
 * Resolve one incoming beat: validate enum fields, look up character /
 * motif refs by name, expand motifs string[] shorthand. Pure over the
 * already-loaded lookups.
 */
function resolveBeat(
  input: BeatImportInput,
  ctx: {
    sourceCharNameById: Record<string, string>
    sourceMotifNameById: Record<string, string>
    targetCharByName: Map<string, string>
    targetMotifByName: Map<string, string>
    unmatchedCharCollector: Set<string>
    unmatchedMotifCollector: Set<string>
    /** Whether the *NamesById lookup was present at all. */
    hasCharLookup: boolean
    hasMotifLookup: boolean
  }
): ResolvedBeatResult {
  const warnings: BeatFieldWarning[] = []

  function resolveCharRef(
    sourceId: string | null | undefined,
    fieldLabel: string
  ): string | null {
    if (!sourceId) return null
    const name = ctx.sourceCharNameById[sourceId]
    if (!name) {
      // Without a name lookup we can't even know what the id pointed at,
      // so we surface that distinctly from "name not found".
      if (!ctx.hasCharLookup) {
        warnings.push({
          field: fieldLabel,
          kind: 'missing_lookup',
          reason: `${fieldLabel}: id "${sourceId}" cannot be resolved — envelope has no characterNamesById and no characters[] to derive one`,
          inputValue: sourceId,
          resolvedValue: null,
        })
      }
      return null
    }
    const targetId = ctx.targetCharByName.get(name.trim().toLowerCase())
    if (targetId) return targetId
    ctx.unmatchedCharCollector.add(name)
    warnings.push({
      field: fieldLabel,
      kind: 'unmatched_name',
      reason: `${fieldLabel}: character "${name}" does not exist in this manuscript`,
      inputValue: name,
      resolvedValue: null,
    })
    return null
  }

  function resolveMotifRef(
    sourceId: string | null | undefined,
    fieldLabel: string
  ): string | null {
    if (!sourceId) return null
    const name = ctx.sourceMotifNameById[sourceId]
    if (!name) {
      if (!ctx.hasMotifLookup) {
        warnings.push({
          field: fieldLabel,
          kind: 'missing_lookup',
          reason: `${fieldLabel}: id "${sourceId}" cannot be resolved — envelope has no motifNamesById and no motifs[] to derive one`,
          inputValue: sourceId,
          resolvedValue: null,
        })
      }
      return null
    }
    const targetId = ctx.targetMotifByName.get(name.trim().toLowerCase())
    if (targetId) return targetId
    ctx.unmatchedMotifCollector.add(name)
    warnings.push({
      field: fieldLabel,
      kind: 'unmatched_name',
      reason: `${fieldLabel}: motif "${name}" does not exist in this manuscript`,
      inputValue: name,
      resolvedValue: null,
    })
    return null
  }

  const povCharacterId = resolveCharRef(input.povCharacterId ?? null, 'povCharacterId')

  // Enum checks
  const sceneFunctionCheck = checkEnum(input.sceneFunctionType, SCENE_FUNCTION_SET, 'sceneFunctionType')
  const sceneFunctionType: string | null = sceneFunctionCheck.ok ? sceneFunctionCheck.value : null
  if (!sceneFunctionCheck.ok) {
    warnings.push({
      field: 'sceneFunctionType',
      kind: 'unknown_enum',
      reason: sceneFunctionCheck.reason,
      inputValue: sceneFunctionCheck.input,
      resolvedValue: null,
    })
  }
  const withholdingCheck = checkEnum(input.withholdingLevel, WITHHOLDING_SET, 'withholdingLevel')
  const withholdingLevel: string | null = withholdingCheck.ok ? withholdingCheck.value : null
  if (!withholdingCheck.ok) {
    warnings.push({
      field: 'withholdingLevel',
      kind: 'unknown_enum',
      reason: withholdingCheck.reason,
      inputValue: withholdingCheck.input,
      resolvedValue: null,
    })
  }

  // Knowledge ledger
  const knowledge: ResolvedBeat['knowledge'] = []
  if (Array.isArray(input.knowledge)) {
    for (let i = 0; i < input.knowledge.length; i++) {
      const k = input.knowledge[i]
      if (!k || typeof k !== 'object') continue
      const kindCheck = checkEnum(k.knowledgeKind, KNOWLEDGE_KIND_SET, `knowledge[${i}].knowledgeKind`)
      const text = typeof k.text === 'string' ? k.text : ''
      if (!kindCheck.ok) {
        warnings.push({
          field: `knowledge[${i}].knowledgeKind`,
          kind: 'unknown_enum',
          reason: kindCheck.reason,
          inputValue: kindCheck.input,
          resolvedValue: null,
        })
        continue
      }
      if (!kindCheck.value) continue
      if (!text.trim()) continue
      // characterId === null is the reader row — preserve it. Otherwise
      // map by name through the lookup.
      const characterId =
        k.characterId === null
          ? null
          : resolveCharRef(
              typeof k.characterId === 'string' ? k.characterId : null,
              `knowledge[${i}].characterId`
            )
      knowledge.push({ characterId, knowledgeKind: kindCheck.value, text })
    }
  }

  // Motifs touched — accept either string[] (shorthand) or {motifId, variantNote}[].
  const motifs: ResolvedBeat['motifs'] = []
  if (Array.isArray(input.motifs)) {
    for (let i = 0; i < input.motifs.length; i++) {
      const entry = input.motifs[i]
      let sourceMotifId: string | null = null
      let variantNote: string | null = null
      if (typeof entry === 'string') {
        sourceMotifId = entry
      } else if (entry && typeof entry === 'object') {
        const o = entry as { motifId?: unknown; variantNote?: unknown }
        sourceMotifId = typeof o.motifId === 'string' ? o.motifId : null
        variantNote = typeof o.variantNote === 'string' ? o.variantNote : null
      }
      const targetMotifId = resolveMotifRef(sourceMotifId, `motifs[${i}]`)
      if (!targetMotifId) continue
      motifs.push({ motifId: targetMotifId, variantNote })
    }
  }

  const resolved: ResolvedBeat = {
    itemId: typeof input.itemId === 'string' ? input.itemId : null,
    povCharacterId,
    label: str(input.label),
    title: str(input.title),
    timelinePoint: str(input.timelinePoint),
    movement: str(input.movement),
    outerEvent: str(input.outerEvent),
    innerTurn: str(input.innerTurn),
    voiceConstraint: str(input.voiceConstraint),
    finalImage: str(input.finalImage),
    sceneFunctionType,
    withholdingLevel,
    uniquePerception: str(input.uniquePerception),
    blindSpot: str(input.blindSpot),
    misreading: str(input.misreading),
    readerInference: str(input.readerInference),
    reasonForNextPovSwitch: str(input.reasonForNextPovSwitch),
    knowledge,
    motifs,
  }

  return { resolved, warnings }
}

/* ----- Diff against existing beat ----- */

/**
 * Field-level diff between an existing beat and a resolved beat.
 *
 * Only scalar fields are diffed here; knowledge ledger and motifs are
 * additive on update (the existing repo upserts and never deletes), so
 * comparing them as ordered lists would falsely flag change.
 */
const SCALAR_FIELDS: (keyof ResolvedBeat)[] = [
  'povCharacterId',
  'label',
  'title',
  'timelinePoint',
  'movement',
  'outerEvent',
  'innerTurn',
  'voiceConstraint',
  'finalImage',
  'sceneFunctionType',
  'withholdingLevel',
  'uniquePerception',
  'blindSpot',
  'misreading',
  'readerInference',
  'reasonForNextPovSwitch',
]

function computeDiff(existing: Beat, resolved: ResolvedBeat): BeatFieldDiff[] {
  const diff: BeatFieldDiff[] = []
  for (const f of SCALAR_FIELDS) {
    const a = (existing as unknown as Record<string, unknown>)[f] ?? null
    const b = resolved[f] ?? null
    if (a !== b) {
      diff.push({ field: f as string, from: a, to: b })
    }
  }
  return diff
}

/* ----- Phase 1: preview ----- */

export async function previewBeatsImport(
  manuscriptId: string,
  userId: string,
  isAdmin: boolean,
  raw: unknown
): Promise<BeatsImportPlan> {
  const envelope = validateEnvelope(raw)

  // Read access via getBundle (same path the apply will use).
  const bundle = await storyCraftRepo.getBundle(manuscriptId, userId, isAdmin)

  const targetCharByName = new Map<string, string>()
  for (const c of bundle.characters) targetCharByName.set(c.name.trim().toLowerCase(), c.id)
  const targetMotifByName = new Map<string, string>()
  for (const m of bundle.motifs) targetMotifByName.set(m.name.trim().toLowerCase(), m.id)

  // Path B: derive the *NamesById lookups when missing.
  const charLookup = deriveNameLookup(
    envelope.characterNamesById,
    Array.isArray((envelope as unknown as { characters?: unknown[] }).characters)
      ? ((envelope as unknown as { characters?: { id?: unknown; name?: unknown }[] }).characters ?? [])
      : []
  )
  const motifLookup = deriveNameLookup(
    envelope.motifNamesById,
    Array.isArray((envelope as unknown as { motifs?: unknown[] }).motifs)
      ? ((envelope as unknown as { motifs?: { id?: unknown; name?: unknown }[] }).motifs ?? [])
      : []
  )

  const unmatchedCharSet = new Set<string>()
  const unmatchedMotifSet = new Set<string>()

  // Build the existing-beat indexes for dedup.
  const beatById = new Map<string, Beat>()
  const beatByLabel = new Map<string, Beat>() // lower-cased label -> beat
  for (const b of bundle.beats) {
    beatById.set(b.id, b)
    if (b.label && b.label.trim()) {
      beatByLabel.set(b.label.trim().toLowerCase(), b)
    }
  }

  const planItems: BeatImportPlanItem[] = []

  for (let i = 0; i < envelope.beats.length; i++) {
    const input: BeatImportInput = envelope.beats[i] as BeatImportInput
    const sourceId = typeof input?.id === 'string' && input.id.trim() ? input.id : `__index_${i}`

    if (!input || typeof input !== 'object') {
      // Defensive — produce a synthetic plan item so the UI doesn't lose
      // count. The apply phase will skip it anyway.
      planItems.push({
        sourceId,
        action: 'create',
        matchedBeatId: null,
        matchedBy: null,
        display: `Beat #${i + 1}`,
        resolved: emptyResolved(),
        warnings: [
          {
            field: '*',
            kind: 'unknown_enum',
            reason: 'Entry is not a JSON object',
            inputValue: input,
            resolvedValue: null,
          },
        ],
        diff: [],
      })
      continue
    }

    const { resolved, warnings } = resolveBeat(input, {
      sourceCharNameById: charLookup.lookup,
      sourceMotifNameById: motifLookup.lookup,
      targetCharByName,
      targetMotifByName,
      unmatchedCharCollector: unmatchedCharSet,
      unmatchedMotifCollector: unmatchedMotifSet,
      hasCharLookup: Object.keys(charLookup.lookup).length > 0,
      hasMotifLookup: Object.keys(motifLookup.lookup).length > 0,
    })

    // Dedup: id first, then label.
    let matched: Beat | undefined
    let matchedBy: 'id' | 'label' | null = null
    if (typeof input.id === 'string' && input.id.trim()) {
      matched = beatById.get(input.id.trim())
      if (matched) matchedBy = 'id'
    }
    if (!matched && resolved.label) {
      matched = beatByLabel.get(resolved.label.trim().toLowerCase())
      if (matched) matchedBy = 'label'
    }

    let action: 'create' | 'update' | 'no_change'
    let diff: BeatFieldDiff[] = []
    if (matched) {
      diff = computeDiff(matched, resolved)
      action = diff.length === 0 ? 'no_change' : 'update'
      // null_overwrite warnings — for each diff entry where resolved=null
      // and existing!=null, surface as a "would null this out" warning.
      for (const d of diff) {
        if (d.to === null && d.from !== null) {
          warnings.push({
            field: d.field,
            kind: 'null_overwrite',
            reason: `Update would null out "${d.field}" (currently set). Preserved by default — toggle "Overwrite with nulls" to apply.`,
            inputValue: null,
            resolvedValue: null,
            existingValue: d.from,
          })
        }
      }
    } else {
      action = 'create'
    }

    const labelStr = resolved.label ? `${resolved.label} — ` : ''
    const titleStr = resolved.title ?? '(untitled)'
    const display = `${labelStr}${titleStr.length > 80 ? titleStr.slice(0, 77) + '…' : titleStr}`

    planItems.push({
      sourceId,
      action,
      matchedBeatId: matched ? matched.id : null,
      matchedBy,
      display,
      resolved,
      warnings,
      diff,
    })
  }

  // Causal-link plan: which links will resolve given the planned beat
  // outcomes. We treat any beat whose plan is 'no_change' or 'update' or
  // 'create' as resolvable; only beats absent from the envelope are not.
  // The apply phase recomputes against the user's actual decisions.
  const knownSourceIds = new Set(planItems.map(p => p.sourceId))
  const causalLinks: CausalLinkPlanItem[] = []
  for (const link of envelope.causalLinks ?? []) {
    if (!link || typeof link !== 'object') continue
    const li = link as CausalLinkImportInput
    const linkType = typeof li.linkType === 'string' ? li.linkType : ''
    const fromSourceId = typeof li.fromBeatId === 'string' ? li.fromBeatId : ''
    const toSourceId = typeof li.toBeatId === 'string' ? li.toBeatId : ''
    let willResolve = true
    let reason: string | undefined
    if (!CAUSAL_LINK_SET.has(linkType)) {
      willResolve = false
      reason = `linkType "${linkType}" is not a recognized causal-link type`
    } else if (!knownSourceIds.has(fromSourceId) || !knownSourceIds.has(toSourceId)) {
      willResolve = false
      reason = 'one or both endpoints are not in the envelope'
    }
    causalLinks.push({
      fromSourceId,
      toSourceId,
      linkType,
      note: typeof li.note === 'string' ? li.note : null,
      willResolve,
      reason,
    })
  }

  return {
    total: envelope.beats.length,
    beats: planItems,
    causalLinks,
    unmatched: {
      characterNames: Array.from(unmatchedCharSet).sort(),
      motifNames: Array.from(unmatchedMotifSet).sort(),
    },
    derivedLookups: {
      characters: charLookup.derived,
      motifs: motifLookup.derived,
    },
  }
}

function emptyResolved(): ResolvedBeat {
  return {
    itemId: null,
    povCharacterId: null,
    label: null,
    title: null,
    timelinePoint: null,
    movement: null,
    outerEvent: null,
    innerTurn: null,
    voiceConstraint: null,
    finalImage: null,
    sceneFunctionType: null,
    withholdingLevel: null,
    uniquePerception: null,
    blindSpot: null,
    misreading: null,
    readerInference: null,
    reasonForNextPovSwitch: null,
    knowledge: [],
    motifs: [],
  }
}

/* ----- Phase 2: apply ----- */

export async function applyBeatsImport(
  manuscriptId: string,
  userId: string,
  isAdmin: boolean,
  raw: unknown,
  decisions: Record<string, BeatImportDecision> | undefined
): Promise<BeatsImportResult> {
  // Re-run the resolver from scratch so the apply doesn't depend on any
  // stale plan state passed by the client. The decisions map is the only
  // thing we trust from the client.
  const plan = await previewBeatsImport(manuscriptId, userId, isAdmin, raw)
  const envelope = validateEnvelope(raw)
  const decisionMap: Record<string, BeatImportDecision> = decisions ?? {}

  const result: BeatsImportResult = {
    total: plan.total,
    created: [],
    updated: [],
    skipped: [],
    errors: [],
    causalLinks: { created: 0, updated: 0, skipped: 0 },
    unmatched: plan.unmatched,
  }

  // Source id -> applied target beat id (newly created or matched). Used
  // for causal-link remapping after the beats loop.
  const beatIdMap = new Map<string, string>()

  // Append-after-end ordering for fresh creates so we don't fight existing
  // orderIndex values.
  const bundle = await storyCraftRepo.getBundle(manuscriptId, userId, isAdmin)
  let nextOrderIndex = bundle.beats.reduce(
    (max, b) => (b.orderIndex > max ? b.orderIndex : max),
    -1
  ) + 1

  for (const item of plan.beats) {
    const decision = decisionMap[item.sourceId] ?? { action: 'apply' }
    if (decision.action === 'skip' || item.action === 'no_change') {
      result.skipped.push({
        sourceId: item.sourceId,
        reason: decision.action === 'skip' ? 'User skipped' : 'No changes',
      })
      // Even on no_change, map the source id to the existing beat so
      // causal-link remapping still works.
      if (item.matchedBeatId) beatIdMap.set(item.sourceId, item.matchedBeatId)
      continue
    }

    try {
      if (item.action === 'create') {
        const created = await storyCraftRepo.createBeat(
          manuscriptId,
          userId,
          {
            povCharacterId: item.resolved.povCharacterId,
            itemId: null,
            orderIndex: nextOrderIndex++,
            label: item.resolved.label,
            title: item.resolved.title,
            timelinePoint: item.resolved.timelinePoint,
            movement: item.resolved.movement,
            outerEvent: item.resolved.outerEvent,
            innerTurn: item.resolved.innerTurn,
            voiceConstraint: item.resolved.voiceConstraint,
            finalImage: item.resolved.finalImage,
            sceneFunctionType: item.resolved.sceneFunctionType as SceneFunctionType | null,
            withholdingLevel: item.resolved.withholdingLevel as WithholdingLevel | null,
            uniquePerception: item.resolved.uniquePerception,
            blindSpot: item.resolved.blindSpot,
            misreading: item.resolved.misreading,
            readerInference: item.resolved.readerInference,
            reasonForNextPovSwitch: item.resolved.reasonForNextPovSwitch,
          },
          isAdmin
        )
        beatIdMap.set(item.sourceId, created.id)
        await applyBeatChildren(created.id, item.resolved, userId, isAdmin)
        result.created.push({
          sourceId: item.sourceId,
          newId: created.id,
          label: created.label ?? null,
          title: created.title ?? null,
        })
      } else if (item.action === 'update' && item.matchedBeatId) {
        // Build the update patch field-by-field. For null_overwrite cases
        // (resolved=null, existing=non-null) only write null when the user
        // opted in via decision.allowOverwriteWithNull.
        const allowNullOverwrite = decision.allowOverwriteWithNull === true
        const updates: Record<string, unknown> = {}
        let fieldsChanged = 0
        for (const d of item.diff) {
          const isNullOverwrite = d.to === null && d.from !== null
          if (isNullOverwrite && !allowNullOverwrite) continue
          updates[d.field] = d.to
          fieldsChanged++
        }
        if (fieldsChanged > 0) {
          await storyCraftRepo.updateBeat(item.matchedBeatId, userId, updates, isAdmin)
        }
        beatIdMap.set(item.sourceId, item.matchedBeatId)
        await applyBeatChildren(item.matchedBeatId, item.resolved, userId, isAdmin)
        result.updated.push({
          sourceId: item.sourceId,
          beatId: item.matchedBeatId,
          label: item.resolved.label ?? null,
          title: item.resolved.title ?? null,
          fieldsChanged,
        })
      }
    } catch (err) {
      result.errors.push({
        sourceId: item.sourceId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Causal links — remap to target beat ids and upsert via the repo (its
  // ON CONFLICT clause handles updates of the note column).
  for (const link of envelope.causalLinks ?? []) {
    if (!link || typeof link !== 'object') {
      result.causalLinks.skipped++
      continue
    }
    const li = link as CausalLinkImportInput
    if (typeof li.linkType !== 'string' || !CAUSAL_LINK_SET.has(li.linkType)) {
      result.causalLinks.skipped++
      continue
    }
    const fromId = typeof li.fromBeatId === 'string' ? beatIdMap.get(li.fromBeatId) : undefined
    const toId = typeof li.toBeatId === 'string' ? beatIdMap.get(li.toBeatId) : undefined
    if (!fromId || !toId) { result.causalLinks.skipped++; continue }
    try {
      // The repo upserts on the (from, to, linkType) unique key. That
      // means re-imports update the note rather than creating duplicates.
      // We don't easily distinguish created vs updated post-hoc here, so
      // we count everything that succeeded as 'created' for now and
      // recompute against the bundle below.
      await storyCraftRepo.createCausalLink(
        manuscriptId,
        userId,
        {
          fromBeatId: fromId,
          toBeatId: toId,
          linkType: li.linkType as CausalLinkType,
          note: typeof li.note === 'string' ? li.note : null,
        },
        isAdmin
      )
      result.causalLinks.created++
    } catch {
      result.causalLinks.skipped++
    }
  }

  // Distinguish created vs updated after the fact by comparing the post-
  // apply causal-link count to the pre-apply one. Anything beyond the
  // pre-apply set is genuinely new; the rest is updated.
  try {
    const after = await storyCraftRepo.getBundle(manuscriptId, userId, isAdmin)
    const before = bundle.causalLinks.length
    const created = Math.max(0, after.causalLinks.length - before)
    const updated = result.causalLinks.created - created
    result.causalLinks.created = created
    result.causalLinks.updated = Math.max(0, updated)
  } catch {
    // Non-fatal — leave the rough count as-is.
  }

  return result
}

/**
 * Apply knowledge ledger entries and motif touches to a beat. Both repo
 * methods upsert (insert-or-update by key); existing entries that aren't
 * in the incoming list are left alone so re-imports remain additive and
 * never silently destructive.
 */
async function applyBeatChildren(
  beatId: string,
  resolved: ResolvedBeat,
  userId: string,
  isAdmin: boolean
): Promise<void> {
  for (const k of resolved.knowledge) {
    await storyCraftRepo.setBeatKnowledge(
      beatId,
      userId,
      {
        characterId: k.characterId,
        knowledgeKind: k.knowledgeKind as KnowledgeKind,
        text: k.text,
      },
      isAdmin
    )
  }
  for (const bm of resolved.motifs) {
    await storyCraftRepo.setBeatMotif(beatId, bm.motifId, userId, bm.variantNote, isAdmin)
  }
}
