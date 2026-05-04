import { storyCraftRepo } from '../repositories/storycraft.repo.js'
import {
  Character,
  Beat,
  Motif,
  CausalLink,
  Silence,
  CharacterMisreading,
  BeatKnowledge,
  BeatMotif,
  MotifVoiceVariant,
  StoryCraftBundle,
  KNOWLEDGE_KINDS,
  CAUSAL_LINK_TYPES,
  SCENE_FUNCTION_TYPES,
  WITHHOLDING_LEVELS,
  SILENCE_TYPES,
  KnowledgeKind,
  CausalLinkType,
  SceneFunctionType,
  WithholdingLevel,
  SilenceType,
  VoiceBible,
} from '../models/StoryCraft.js'
import { sanitizeString } from '../utils/sanitize.js'
import { ValidationError } from '../utils/errors.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function ensureUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ValidationError(`${label} must be a valid UUID`)
  }
  return value
}

function nullableUuid(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null
  return ensureUuid(value, label)
}

function ensureEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`${label} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

function nullableEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T | null {
  if (value === null || value === undefined || value === '') return null
  return ensureEnum(value, allowed, label)
}

function nullableText(value: unknown, label: string, maxLen = 8_000): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw new ValidationError(`${label} must be a string`)
  const cleaned = sanitizeString(value)
  if (cleaned.length > maxLen) {
    throw new ValidationError(`${label} must be ${maxLen} characters or less`)
  }
  return cleaned
}

function ensureStringArray(value: unknown, label: string, maxItems = 64, maxLen = 500): string[] {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value)) throw new ValidationError(`${label} must be an array`)
  if (value.length > maxItems) throw new ValidationError(`${label} must have at most ${maxItems} items`)
  return value.map((v, i) => {
    if (typeof v !== 'string') throw new ValidationError(`${label}[${i}] must be a string`)
    const s = sanitizeString(v)
    if (s.length > maxLen) throw new ValidationError(`${label}[${i}] must be ${maxLen} characters or less`)
    return s
  })
}

/**
 * Validate the voice bible JSON. Strings get sanitized, arrays of strings get
 * length-checked. Anything else is rejected.
 */
function ensureVoiceBible(value: unknown): VoiceBible {
  if (value === null || value === undefined) return {}
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('voice must be an object')
  }
  const v = value as Record<string, unknown>
  const out: VoiceBible = {}
  const STR_FIELDS: (keyof VoiceBible)[] = [
    'sentenceLength','rhythm','punctuationHabits',
    'whatTheyLieAbout','whatTheySelectivelyTell','whatTheyNeverSayDirectly',
    'howEmotionLeaks','howPressureChangesTheVoice',
    'attentionPattern','avoidancePattern',
    'sampleSentenceNeutral','sampleSentenceUnderPressure',
  ]
  const ARR_FIELDS: (keyof VoiceBible)[] = [
    'preferredWords','forbiddenWords','metaphorSources',
    'whatTheyNotice','whatTheyMiss',
  ]
  for (const f of STR_FIELDS) {
    if (v[f] !== undefined) {
      const cleaned = nullableText(v[f], f, 4000)
      if (cleaned !== null) (out as any)[f] = cleaned
    }
  }
  for (const f of ARR_FIELDS) {
    if (v[f] !== undefined) (out as any)[f] = ensureStringArray(v[f], f, 64, 200)
  }
  return out
}

export const storyCraftService = {
  /* ============================================================
   *  Bundle
   * ============================================================ */

  async getBundle(
    manuscriptId: string,
    userId: string | null,
    isAdmin: boolean = false
  ): Promise<StoryCraftBundle> {
    return storyCraftRepo.getBundle(ensureUuid(manuscriptId, 'manuscriptId'), userId, isAdmin)
  },

  /* ============================================================
   *  Characters
   * ============================================================ */

  async listCharacters(manuscriptId: string, userId: string | null, isAdmin = false): Promise<Character[]> {
    return storyCraftRepo.listCharacters(ensureUuid(manuscriptId, 'manuscriptId'), userId, isAdmin)
  },

  async createCharacter(
    manuscriptId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<Character> {
    const name = sanitizeString(typeof input.name === 'string' ? input.name : '')
    if (!name) throw new ValidationError('Character name is required')
    if (name.length > 255) throw new ValidationError('Character name must be 255 characters or less')

    return storyCraftRepo.createCharacter(
      ensureUuid(manuscriptId, 'manuscriptId'),
      userId,
      {
        name,
        fullName: nullableText(input.fullName, 'fullName', 255),
        role: nullableText(input.role, 'role', 1000),
        socialPosition: nullableText(input.socialPosition, 'socialPosition', 1000),
        contradiction: nullableText(input.contradiction, 'contradiction', 1000),
        publicWant: nullableText(input.publicWant, 'publicWant', 1000),
        privateWant: nullableText(input.privateWant, 'privateWant', 1000),
        hiddenNeed: nullableText(input.hiddenNeed, 'hiddenNeed', 1000),
        greatestFear: nullableText(input.greatestFear, 'greatestFear', 1000),
        falseBelief: nullableText(input.falseBelief, 'falseBelief', 1000),
        wound: nullableText(input.wound, 'wound', 2000),
        voice: ensureVoiceBible(input.voice),
        arcPhases: ensureStringArray(input.arcPhases, 'arcPhases', 32, 120),
        plotFunctions: ensureStringArray(input.plotFunctions, 'plotFunctions', 32, 500),
        color: nullableText(input.color, 'color', 32),
        notes: nullableText(input.notes, 'notes', 8000),
        orderIndex: typeof input.orderIndex === 'number' ? input.orderIndex : undefined,
      },
      isAdmin
    )
  },

  async updateCharacter(
    characterId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<Character> {
    const updates: Parameters<typeof storyCraftRepo.updateCharacter>[2] = {}
    if (input.name !== undefined) {
      const n = sanitizeString(typeof input.name === 'string' ? input.name : '')
      if (!n) throw new ValidationError('Character name cannot be empty')
      if (n.length > 255) throw new ValidationError('Character name must be 255 characters or less')
      updates.name = n
    }
    if (input.fullName !== undefined) updates.fullName = nullableText(input.fullName, 'fullName', 255)
    if (input.role !== undefined) updates.role = nullableText(input.role, 'role', 1000)
    if (input.socialPosition !== undefined) updates.socialPosition = nullableText(input.socialPosition, 'socialPosition', 1000)
    if (input.contradiction !== undefined) updates.contradiction = nullableText(input.contradiction, 'contradiction', 1000)
    if (input.publicWant !== undefined) updates.publicWant = nullableText(input.publicWant, 'publicWant', 1000)
    if (input.privateWant !== undefined) updates.privateWant = nullableText(input.privateWant, 'privateWant', 1000)
    if (input.hiddenNeed !== undefined) updates.hiddenNeed = nullableText(input.hiddenNeed, 'hiddenNeed', 1000)
    if (input.greatestFear !== undefined) updates.greatestFear = nullableText(input.greatestFear, 'greatestFear', 1000)
    if (input.falseBelief !== undefined) updates.falseBelief = nullableText(input.falseBelief, 'falseBelief', 1000)
    if (input.wound !== undefined) updates.wound = nullableText(input.wound, 'wound', 2000)
    if (input.voice !== undefined) updates.voice = ensureVoiceBible(input.voice)
    if (input.arcPhases !== undefined) updates.arcPhases = ensureStringArray(input.arcPhases, 'arcPhases', 32, 120)
    if (input.plotFunctions !== undefined) updates.plotFunctions = ensureStringArray(input.plotFunctions, 'plotFunctions', 32, 500)
    if (input.color !== undefined) updates.color = nullableText(input.color, 'color', 32)
    if (input.notes !== undefined) updates.notes = nullableText(input.notes, 'notes', 8000)
    if (input.orderIndex !== undefined) {
      if (typeof input.orderIndex !== 'number' || !Number.isFinite(input.orderIndex)) {
        throw new ValidationError('orderIndex must be a number')
      }
      updates.orderIndex = Math.trunc(input.orderIndex)
    }
    return storyCraftRepo.updateCharacter(ensureUuid(characterId, 'characterId'), userId, updates, isAdmin)
  },

  async deleteCharacter(characterId: string, userId: string, isAdmin = false): Promise<void> {
    return storyCraftRepo.deleteCharacter(ensureUuid(characterId, 'characterId'), userId, isAdmin)
  },

  /* ============================================================
   *  Misreadings
   * ============================================================ */

  async createMisreading(
    characterId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<CharacterMisreading> {
    const label = sanitizeString(typeof input.label === 'string' ? input.label : '')
    if (!label) throw new ValidationError('Misreading label is required')
    return storyCraftRepo.createMisreading(
      ensureUuid(characterId, 'characterId'),
      userId,
      {
        label,
        why: nullableText(input.why, 'why', 2000),
        orderIndex: typeof input.orderIndex === 'number' ? input.orderIndex : undefined,
      },
      isAdmin
    )
  },

  async deleteMisreading(misreadingId: string, userId: string, isAdmin = false): Promise<void> {
    return storyCraftRepo.deleteMisreading(ensureUuid(misreadingId, 'misreadingId'), userId, isAdmin)
  },

  /* ============================================================
   *  Motifs
   * ============================================================ */

  async createMotif(
    manuscriptId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<Motif> {
    const name = sanitizeString(typeof input.name === 'string' ? input.name : '')
    if (!name) throw new ValidationError('Motif name is required')
    return storyCraftRepo.createMotif(
      ensureUuid(manuscriptId, 'manuscriptId'),
      userId,
      {
        name,
        function: nullableText(input.function, 'function', 2000),
        orderIndex: typeof input.orderIndex === 'number' ? input.orderIndex : undefined,
      },
      isAdmin
    )
  },

  async updateMotif(
    motifId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<Motif> {
    const updates: Parameters<typeof storyCraftRepo.updateMotif>[2] = {}
    if (input.name !== undefined) {
      const n = sanitizeString(typeof input.name === 'string' ? input.name : '')
      if (!n) throw new ValidationError('Motif name cannot be empty')
      updates.name = n
    }
    if (input.function !== undefined) updates.function = nullableText(input.function, 'function', 2000)
    if (input.orderIndex !== undefined) {
      if (typeof input.orderIndex !== 'number') throw new ValidationError('orderIndex must be a number')
      updates.orderIndex = Math.trunc(input.orderIndex)
    }
    return storyCraftRepo.updateMotif(ensureUuid(motifId, 'motifId'), userId, updates, isAdmin)
  },

  async deleteMotif(motifId: string, userId: string, isAdmin = false): Promise<void> {
    return storyCraftRepo.deleteMotif(ensureUuid(motifId, 'motifId'), userId, isAdmin)
  },

  async setMotifVariant(
    motifId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<MotifVoiceVariant> {
    return storyCraftRepo.setMotifVariant(
      ensureUuid(motifId, 'motifId'),
      ensureUuid(input.characterId, 'characterId'),
      userId,
      nullableText(input.meaning, 'meaning', 2000),
      isAdmin
    )
  },

  /* ============================================================
   *  Beats
   * ============================================================ */

  async listBeats(manuscriptId: string, userId: string | null, isAdmin = false): Promise<Beat[]> {
    return storyCraftRepo.listBeats(ensureUuid(manuscriptId, 'manuscriptId'), userId, isAdmin)
  },

  async createBeat(
    manuscriptId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<Beat> {
    return storyCraftRepo.createBeat(
      ensureUuid(manuscriptId, 'manuscriptId'),
      userId,
      cleanBeatInput(input),
      isAdmin
    )
  },

  async updateBeat(
    beatId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<Beat> {
    return storyCraftRepo.updateBeat(
      ensureUuid(beatId, 'beatId'),
      userId,
      cleanBeatInput(input),
      isAdmin
    )
  },

  async deleteBeat(beatId: string, userId: string, isAdmin = false): Promise<void> {
    return storyCraftRepo.deleteBeat(ensureUuid(beatId, 'beatId'), userId, isAdmin)
  },

  async reorderBeats(
    manuscriptId: string,
    userId: string,
    moves: unknown,
    isAdmin = false
  ): Promise<Beat[]> {
    if (!Array.isArray(moves)) throw new ValidationError('moves must be an array')
    const cleaned = moves.map((m, i) => {
      if (typeof m !== 'object' || m === null) throw new ValidationError(`moves[${i}] must be an object`)
      const o = m as Record<string, unknown>
      const id = ensureUuid(String(o.id), `moves[${i}].id`)
      if (typeof o.orderIndex !== 'number' || !Number.isFinite(o.orderIndex)) {
        throw new ValidationError(`moves[${i}].orderIndex must be a number`)
      }
      return { id, orderIndex: Math.trunc(o.orderIndex) }
    })
    return storyCraftRepo.reorderBeats(ensureUuid(manuscriptId, 'manuscriptId'), userId, cleaned, isAdmin)
  },

  /* ============================================================
   *  Beat knowledge
   * ============================================================ */

  async setBeatKnowledge(
    beatId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<BeatKnowledge | null> {
    const knowledgeKind = ensureEnum(input.knowledgeKind, KNOWLEDGE_KINDS, 'knowledgeKind') as KnowledgeKind
    const characterId = input.characterId === null || input.characterId === undefined || input.characterId === ''
      ? null
      : ensureUuid(input.characterId, 'characterId')
    const text = input.text === null || input.text === undefined
      ? null
      : nullableText(input.text, 'text', 4000)
    return storyCraftRepo.setBeatKnowledge(
      ensureUuid(beatId, 'beatId'),
      userId,
      { characterId, knowledgeKind, text },
      isAdmin
    )
  },

  /* ============================================================
   *  Beat motifs
   * ============================================================ */

  async setBeatMotif(
    beatId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<BeatMotif> {
    return storyCraftRepo.setBeatMotif(
      ensureUuid(beatId, 'beatId'),
      ensureUuid(input.motifId, 'motifId'),
      userId,
      nullableText(input.variantNote, 'variantNote', 2000),
      isAdmin
    )
  },

  async unsetBeatMotif(
    beatId: string,
    motifId: string,
    userId: string,
    isAdmin = false
  ): Promise<void> {
    return storyCraftRepo.unsetBeatMotif(
      ensureUuid(beatId, 'beatId'),
      ensureUuid(motifId, 'motifId'),
      userId,
      isAdmin
    )
  },

  /* ============================================================
   *  Causal links
   * ============================================================ */

  async createCausalLink(
    manuscriptId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<CausalLink> {
    const linkType = ensureEnum(input.linkType, CAUSAL_LINK_TYPES, 'linkType') as CausalLinkType
    return storyCraftRepo.createCausalLink(
      ensureUuid(manuscriptId, 'manuscriptId'),
      userId,
      {
        fromBeatId: ensureUuid(input.fromBeatId, 'fromBeatId'),
        toBeatId: ensureUuid(input.toBeatId, 'toBeatId'),
        linkType,
        note: nullableText(input.note, 'note', 2000),
      },
      isAdmin
    )
  },

  async deleteCausalLink(linkId: string, userId: string, isAdmin = false): Promise<void> {
    return storyCraftRepo.deleteCausalLink(ensureUuid(linkId, 'linkId'), userId, isAdmin)
  },

  /* ============================================================
   *  Silences
   * ============================================================ */

  async createSilence(
    manuscriptId: string,
    userId: string,
    input: Record<string, unknown>,
    isAdmin = false
  ): Promise<Silence> {
    const whatUnsaid = sanitizeString(typeof input.whatUnsaid === 'string' ? input.whatUnsaid : '')
    if (!whatUnsaid) throw new ValidationError('whatUnsaid is required')
    return storyCraftRepo.createSilence(
      ensureUuid(manuscriptId, 'manuscriptId'),
      userId,
      {
        characterId: nullableUuid(input.characterId, 'characterId'),
        beatId: nullableUuid(input.beatId, 'beatId'),
        whatUnsaid,
        why: nullableText(input.why, 'why', 2000),
        consequence: nullableText(input.consequence, 'consequence', 2000),
        silenceType: nullableEnum(input.silenceType, SILENCE_TYPES, 'silenceType') as SilenceType | null,
      },
      isAdmin
    )
  },

  async deleteSilence(silenceId: string, userId: string, isAdmin = false): Promise<void> {
    return storyCraftRepo.deleteSilence(ensureUuid(silenceId, 'silenceId'), userId, isAdmin)
  },
}

/**
 * Shared input cleaner for createBeat / updateBeat. Input is unknown (raw HTTP
 * body); output is a partial of the beat update shape.
 */
function cleanBeatInput(input: Record<string, unknown>) {
  const out: Parameters<typeof storyCraftRepo.updateBeat>[2] = {}
  if (input.povCharacterId !== undefined) out.povCharacterId = nullableUuid(input.povCharacterId, 'povCharacterId')
  if (input.itemId !== undefined) out.itemId = nullableUuid(input.itemId, 'itemId')
  if (input.orderIndex !== undefined) {
    if (typeof input.orderIndex !== 'number') throw new ValidationError('orderIndex must be a number')
    out.orderIndex = Math.trunc(input.orderIndex)
  }
  if (input.label !== undefined) out.label = nullableText(input.label, 'label', 64)
  if (input.title !== undefined) out.title = nullableText(input.title, 'title', 500)
  if (input.timelinePoint !== undefined) out.timelinePoint = nullableText(input.timelinePoint, 'timelinePoint', 255)
  if (input.movement !== undefined) out.movement = nullableText(input.movement, 'movement', 64)
  if (input.outerEvent !== undefined) out.outerEvent = nullableText(input.outerEvent, 'outerEvent', 4000)
  if (input.innerTurn !== undefined) out.innerTurn = nullableText(input.innerTurn, 'innerTurn', 4000)
  if (input.voiceConstraint !== undefined) out.voiceConstraint = nullableText(input.voiceConstraint, 'voiceConstraint', 2000)
  if (input.finalImage !== undefined) out.finalImage = nullableText(input.finalImage, 'finalImage', 2000)
  if (input.sceneFunctionType !== undefined) out.sceneFunctionType = nullableEnum(input.sceneFunctionType, SCENE_FUNCTION_TYPES, 'sceneFunctionType') as SceneFunctionType | null
  if (input.withholdingLevel !== undefined) out.withholdingLevel = nullableEnum(input.withholdingLevel, WITHHOLDING_LEVELS, 'withholdingLevel') as WithholdingLevel | null
  if (input.uniquePerception !== undefined) out.uniquePerception = nullableText(input.uniquePerception, 'uniquePerception', 4000)
  if (input.blindSpot !== undefined) out.blindSpot = nullableText(input.blindSpot, 'blindSpot', 4000)
  if (input.misreading !== undefined) out.misreading = nullableText(input.misreading, 'misreading', 4000)
  if (input.readerInference !== undefined) out.readerInference = nullableText(input.readerInference, 'readerInference', 4000)
  if (input.reasonForNextPovSwitch !== undefined) out.reasonForNextPovSwitch = nullableText(input.reasonForNextPovSwitch, 'reasonForNextPovSwitch', 2000)
  return out
}
