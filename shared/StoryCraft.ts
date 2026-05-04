/**
 * Story-craft domain types: characters, beats, knowledge ledger, motifs, causal
 * links, silences. Used by the Character Studio, Polyphonic Map, and Plot
 * Causality views.
 *
 * Beats are the planning unit (one scene). They sit alongside ManuscriptItems
 * (the prose container) and may be linked 1:1 once prose exists.
 */

/* ----- Voice bible ----- */

export interface VoiceBible {
  /** Short prose: e.g. "Short to medium, especially early." */
  sentenceLength?: string
  rhythm?: string
  punctuationHabits?: string
  preferredWords?: string[]
  forbiddenWords?: string[]
  metaphorSources?: string[]
  whatTheyNotice?: string[]
  whatTheyMiss?: string[]
  whatTheyLieAbout?: string
  whatTheySelectivelyTell?: string
  whatTheyNeverSayDirectly?: string
  howEmotionLeaks?: string
  howPressureChangesTheVoice?: string
  attentionPattern?: string
  avoidancePattern?: string
  /** Two-sentence calibration. */
  sampleSentenceNeutral?: string
  sampleSentenceUnderPressure?: string
}

/* ----- Characters ----- */

export interface Character {
  id: string
  manuscriptId: string

  name: string
  fullName?: string | null
  role?: string | null
  socialPosition?: string | null

  contradiction?: string | null
  publicWant?: string | null
  privateWant?: string | null
  hiddenNeed?: string | null
  greatestFear?: string | null
  falseBelief?: string | null
  wound?: string | null

  voice: VoiceBible
  arcPhases: string[]
  plotFunctions: string[]

  orderIndex: number
  color?: string | null
  notes?: string | null

  createdAt: string
  updatedAt: string
}

export interface CharacterMisreading {
  id: string
  characterId: string
  label: string
  why?: string | null
  orderIndex: number
  createdAt: string
}

/* ----- Motifs ----- */

export interface Motif {
  id: string
  manuscriptId: string
  name: string
  function?: string | null
  orderIndex: number
  createdAt: string
  updatedAt: string
}

export interface MotifVoiceVariant {
  motifId: string
  characterId: string
  meaning?: string | null
}

/* ----- Beats ----- */

export type SceneFunctionType =
  | 'establishing_voice'
  | 'counterpoint'
  | 'correction'
  | 'echo'
  | 'withholding'
  | 'fragment'
  | 'reframing'
  | 'stretto'
  | 'other'

export type WithholdingLevel = 'low' | 'medium' | 'high'

export interface Beat {
  id: string
  manuscriptId: string
  povCharacterId?: string | null
  itemId?: string | null

  orderIndex: number

  label?: string | null
  title?: string | null
  timelinePoint?: string | null
  movement?: string | null

  outerEvent?: string | null
  innerTurn?: string | null
  voiceConstraint?: string | null
  finalImage?: string | null

  sceneFunctionType?: SceneFunctionType | null
  withholdingLevel?: WithholdingLevel | null

  uniquePerception?: string | null
  blindSpot?: string | null
  misreading?: string | null
  readerInference?: string | null
  reasonForNextPovSwitch?: string | null

  createdAt: string
  updatedAt: string
}

/* ----- Beat knowledge (the ledger) ----- */

export type KnowledgeKind = 'known' | 'suspected' | 'misread' | 'hidden' | 'silent'

export interface BeatKnowledge {
  id: string
  beatId: string
  /** NULL = reader row (the dramatic-irony spine). */
  characterId: string | null
  knowledgeKind: KnowledgeKind
  text: string
  orderIndex: number
  createdAt: string
}

/* ----- Beat motifs ----- */

export interface BeatMotif {
  beatId: string
  motifId: string
  variantNote?: string | null
}

/* ----- Causal links ----- */

export type CausalLinkType =
  | 'because'
  | 'therefore'
  | 'but_because'
  | 'until'
  | 'reversal'
  | 'recognition'
  | 'crisis_choice'
  | 'climax'
  | 'plant'
  | 'payoff'
  | 'and_then'

export interface CausalLink {
  id: string
  manuscriptId: string
  fromBeatId: string
  toBeatId: string
  linkType: CausalLinkType
  note?: string | null
  createdAt: string
}

/* ----- Silences ----- */

export type SilenceType =
  | 'psychological'
  | 'social'
  | 'institutional'
  | 'formal'
  | 'ethical'

export interface Silence {
  id: string
  manuscriptId: string
  /** NULL = global silence (not tied to a single character). */
  characterId?: string | null
  /** NULL = silence is a structural pattern, not local to one beat. */
  beatId?: string | null
  whatUnsaid: string
  why?: string | null
  consequence?: string | null
  silenceType?: SilenceType | null
  createdAt: string
}

/* ----- Convenience composites ----- */

/** Everything the story-craft views need in one round-trip. */
export interface StoryCraftBundle {
  characters: Character[]
  misreadings: CharacterMisreading[]
  beats: Beat[]
  beatKnowledge: BeatKnowledge[]
  beatMotifs: BeatMotif[]
  motifs: Motif[]
  motifVariants: MotifVoiceVariant[]
  causalLinks: CausalLink[]
  silences: Silence[]
}

/* ----- Constants exported for client + server validation ----- */

export const SCENE_FUNCTION_TYPES: readonly SceneFunctionType[] = [
  'establishing_voice',
  'counterpoint',
  'correction',
  'echo',
  'withholding',
  'fragment',
  'reframing',
  'stretto',
  'other',
] as const

export const WITHHOLDING_LEVELS: readonly WithholdingLevel[] = ['low', 'medium', 'high'] as const

export const KNOWLEDGE_KINDS: readonly KnowledgeKind[] = [
  'known',
  'suspected',
  'misread',
  'hidden',
  'silent',
] as const

export const CAUSAL_LINK_TYPES: readonly CausalLinkType[] = [
  'because',
  'therefore',
  'but_because',
  'until',
  'reversal',
  'recognition',
  'crisis_choice',
  'climax',
  'plant',
  'payoff',
  'and_then',
] as const

export const SILENCE_TYPES: readonly SilenceType[] = [
  'psychological',
  'social',
  'institutional',
  'formal',
  'ethical',
] as const
