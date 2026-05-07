/**
 * Beat import service.
 *
 * Validates a BeatsImportEnvelope, resolves character / motif refs by NAME
 * against the target manuscript (using the optional source-side id→name
 * lookups in the envelope), and creates each beat through the existing
 * storyCraftRepo so all the normal access checks and constraints apply.
 *
 * Per-beat errors don't stop the import: the result lists what was created
 * and what failed, so the writer can see partial success and act on the
 * unmatched character / motif names without losing the rest.
 *
 * Ownership / access: the controller already requires authMiddleware. This
 * service goes through storyCraftRepo.createBeat / setBeatKnowledge / etc.,
 * each of which calls assertManuscriptAccess(..., 'write') — so the import
 * inherits the same write-access rule as creating beats by hand.
 */
import { storyCraftRepo } from '../repositories/storycraft.repo.js'
import {
  CAUSAL_LINK_TYPES,
  KNOWLEDGE_KINDS,
  SCENE_FUNCTION_TYPES,
  WITHHOLDING_LEVELS,
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
} from '../models/ManuscriptBriefing.js'
import { ValidationError } from '../utils/errors.js'

/* ----- Validation helpers ----- */

const SCENE_FUNCTION_SET = new Set<string>(SCENE_FUNCTION_TYPES)
const WITHHOLDING_SET = new Set<string>(WITHHOLDING_LEVELS)
const KNOWLEDGE_KIND_SET = new Set<string>(KNOWLEDGE_KINDS)
const CAUSAL_LINK_SET = new Set<string>(CAUSAL_LINK_TYPES)

/**
 * Strict shape check. Refuses payloads that aren't roughly the right shape;
 * downstream code can then assume `beats` is an array of objects.
 */
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
  if (obj.characterNamesById !== undefined && (typeof obj.characterNamesById !== 'object' || Array.isArray(obj.characterNamesById))) {
    throw new ValidationError('"characterNamesById" must be an object if present')
  }
  if (obj.motifNamesById !== undefined && (typeof obj.motifNamesById !== 'object' || Array.isArray(obj.motifNamesById))) {
    throw new ValidationError('"motifNamesById" must be an object if present')
  }
  return obj as unknown as BeatsImportEnvelope
}

/** Coerce to a non-empty trimmed string or null. */
function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

/** Coerce to a non-negative finite integer, or null. */
function nonNegInt(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null
  return Math.floor(v)
}

function asSceneFunction(v: unknown): SceneFunctionType | null {
  if (typeof v !== 'string') return null
  return SCENE_FUNCTION_SET.has(v) ? (v as SceneFunctionType) : null
}

function asWithholding(v: unknown): WithholdingLevel | null {
  if (typeof v !== 'string') return null
  return WITHHOLDING_SET.has(v) ? (v as WithholdingLevel) : null
}

function asKnowledgeKind(v: unknown): KnowledgeKind | null {
  if (typeof v !== 'string') return null
  return KNOWLEDGE_KIND_SET.has(v) ? (v as KnowledgeKind) : null
}

function asCausalLinkType(v: unknown): CausalLinkType | null {
  if (typeof v !== 'string') return null
  return CAUSAL_LINK_SET.has(v) ? (v as CausalLinkType) : null
}

/* ----- The importer ----- */

export async function importBeats(
  manuscriptId: string,
  userId: string,
  isAdmin: boolean,
  raw: unknown
): Promise<BeatsImportResult> {
  const envelope = validateEnvelope(raw)

  // Pull current state once. This both enforces read access (storyCraftRepo
  // checks visibility internally) and gives us name → id lookups for the
  // target manuscript's characters and motifs.
  const bundle = await storyCraftRepo.getBundle(manuscriptId, userId, isAdmin)

  const charByName = new Map<string, string>() // lower-cased name -> id
  for (const c of bundle.characters) {
    charByName.set(c.name.trim().toLowerCase(), c.id)
  }
  const motifByName = new Map<string, string>()
  for (const m of bundle.motifs) {
    motifByName.set(m.name.trim().toLowerCase(), m.id)
  }

  // Source-side lookups. Every name will be looked up many times during the
  // import; cache them to avoid recomputing.
  const sourceCharNameById: Record<string, string> = envelope.characterNamesById ?? {}
  const sourceMotifNameById: Record<string, string> = envelope.motifNamesById ?? {}

  const result: BeatsImportResult = {
    total: envelope.beats.length,
    created: [],
    errors: [],
    causalLinks: { created: 0, skipped: 0 },
    unmatched: { characterNames: [], motifNames: [] },
  }

  // De-duplicated unmatched-name collectors.
  const unmatchedCharSet = new Set<string>()
  const unmatchedMotifSet = new Set<string>()

  /** Resolve a source character id to a target id by name. Records unmatched names. */
  function resolveCharacterId(sourceId: string | null | undefined): string | null {
    if (!sourceId) return null
    const name = sourceCharNameById[sourceId]
    if (!name) {
      // We can't tell what it pointed at — silently drop. The user just gets
      // a null pov, which is the right default.
      return null
    }
    const targetId = charByName.get(name.trim().toLowerCase())
    if (targetId) return targetId
    unmatchedCharSet.add(name)
    return null
  }

  /** Resolve a source motif id to a target id by name. */
  function resolveMotifId(sourceId: string | null | undefined): string | null {
    if (!sourceId) return null
    const name = sourceMotifNameById[sourceId]
    if (!name) return null
    const targetId = motifByName.get(name.trim().toLowerCase())
    if (targetId) return targetId
    unmatchedMotifSet.add(name)
    return null
  }

  // Source beat id -> new beat id. Used after the beat loop to remap causal-link refs.
  const beatIdMap = new Map<string, string>()

  // We append imported beats after the highest existing orderIndex so they
  // don't collide with the writer's current ordering.
  const baseOrder = bundle.beats.reduce(
    (max, b) => (b.orderIndex > max ? b.orderIndex : max),
    -1
  ) + 1

  // ---- Beats ----

  for (let i = 0; i < envelope.beats.length; i++) {
    const input: BeatImportInput = envelope.beats[i] as BeatImportInput
    const sourceId = typeof input?.id === 'string' ? input.id : `__index_${i}`

    if (!input || typeof input !== 'object') {
      result.errors.push({ sourceId, error: 'Beat entry is not an object' })
      continue
    }

    try {
      const povCharacterId = resolveCharacterId(input.povCharacterId ?? null)

      // itemId is preserved only if it points at an item in this manuscript.
      // We don't have item ids in the bundle here, so we conservatively drop
      // it; the writer can re-link via the editor.
      const created = await storyCraftRepo.createBeat(
        manuscriptId,
        userId,
        {
          povCharacterId,
          itemId: null,
          orderIndex: baseOrder + i,
          label: str(input.label),
          title: str(input.title),
          timelinePoint: str(input.timelinePoint),
          movement: str(input.movement),
          outerEvent: str(input.outerEvent),
          innerTurn: str(input.innerTurn),
          voiceConstraint: str(input.voiceConstraint),
          finalImage: str(input.finalImage),
          sceneFunctionType: asSceneFunction(input.sceneFunctionType),
          withholdingLevel: asWithholding(input.withholdingLevel),
          uniquePerception: str(input.uniquePerception),
          blindSpot: str(input.blindSpot),
          misreading: str(input.misreading),
          readerInference: str(input.readerInference),
          reasonForNextPovSwitch: str(input.reasonForNextPovSwitch),
        },
        isAdmin
      )

      // Track id mapping for causal-link remapping after this loop.
      if (typeof input.id === 'string') beatIdMap.set(input.id, created.id)

      // Knowledge entries — preserve null characterId for "reader" rows.
      if (Array.isArray(input.knowledge)) {
        for (const k of input.knowledge) {
          if (!k || typeof k !== 'object') continue
          const kind = asKnowledgeKind(k.knowledgeKind)
          const text = typeof k.text === 'string' ? k.text : ''
          if (!kind || !text.trim()) continue
          // characterId === null in the source means the reader row; preserve.
          // characterId set means look it up by name.
          const characterId =
            k.characterId === null
              ? null
              : resolveCharacterId(typeof k.characterId === 'string' ? k.characterId : null)
          await storyCraftRepo.setBeatKnowledge(
            created.id,
            userId,
            { characterId, knowledgeKind: kind, text },
            isAdmin
          )
        }
      }

      // Beat motifs.
      if (Array.isArray(input.motifs)) {
        for (const bm of input.motifs) {
          if (!bm || typeof bm !== 'object') continue
          const motifId = resolveMotifId(typeof bm.motifId === 'string' ? bm.motifId : null)
          if (!motifId) continue // unmatched motif; drop the link, beat still imports
          await storyCraftRepo.setBeatMotif(
            created.id,
            motifId,
            userId,
            typeof bm.variantNote === 'string' ? bm.variantNote : null,
            isAdmin
          )
        }
      }

      result.created.push({
        sourceId,
        newId: created.id,
        label: created.label ?? null,
        title: created.title ?? null,
      })
    } catch (err) {
      result.errors.push({
        sourceId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // ---- Causal links ----
  // Only links whose endpoints both mapped to newly-created beats are
  // created. Anything else is counted as skipped — including links whose
  // referenced beat failed validation above.

  for (const link of envelope.causalLinks ?? []) {
    if (!link || typeof link !== 'object') {
      result.causalLinks.skipped++
      continue
    }
    const li = link as CausalLinkImportInput
    const linkType = asCausalLinkType(li.linkType)
    if (!linkType) { result.causalLinks.skipped++; continue }
    const fromId = typeof li.fromBeatId === 'string' ? beatIdMap.get(li.fromBeatId) : undefined
    const toId = typeof li.toBeatId === 'string' ? beatIdMap.get(li.toBeatId) : undefined
    if (!fromId || !toId) { result.causalLinks.skipped++; continue }
    try {
      await storyCraftRepo.createCausalLink(
        manuscriptId,
        userId,
        {
          fromBeatId: fromId,
          toBeatId: toId,
          linkType,
          note: typeof li.note === 'string' ? li.note : null,
        },
        isAdmin
      )
      result.causalLinks.created++
    } catch {
      result.causalLinks.skipped++
    }
  }

  result.unmatched.characterNames = Array.from(unmatchedCharSet).sort()
  result.unmatched.motifNames = Array.from(unmatchedMotifSet).sort()

  return result
}
