import { storyCraftRepo } from '../repositories/storycraft.repo.js'
import { Beat, Character, VoiceBible } from '../models/StoryCraft.js'
import { ValidationError, NotFoundError } from '../utils/errors.js'

/**
 * Voice-bible-aware prompt builder for story-craft assist modes.
 *
 * Phase 4 deliberately ships only the *prompt construction* layer. The actual
 * LLM call wiring is identical in shape to manuscript-assist.service.ts so it
 * can be plugged in once the OpenAI key path is enabled, but we don't make
 * live calls here — keeping the surface area small and unsurprising.
 *
 * The point is that any future generator that takes a beat must respect the
 * character's voice bible. This module is the single place that turns a beat
 * + character + voice bible into a structured prompt, so we don't end up with
 * five different prompt-builders that drift apart.
 */

export interface BeatPromptContext {
  manuscriptId: string
  beatId: string
}

export interface VoiceAwareBeatPrompt {
  /** The fully constructed system message. Stable across modes. */
  system: string
  /** The user message — beat-specific. */
  user: string
  /** Snapshot of the inputs the prompt was built from, for provenance. */
  meta: {
    beatId: string
    povCharacterId: string | null
    povCharacterName: string | null
    voiceConstraint?: string | null
    withholdingLevel?: string | null
  }
}

export const storyCraftAssistService = {
  /**
   * Build a voice-aware prompt for drafting a single beat. Caller may pass the
   * resulting prompt to whatever LLM client they want; this service is
   * deliberately decoupled from any provider.
   */
  async buildBeatDraftPrompt(
    ctx: BeatPromptContext,
    userId: string,
    isAdmin: boolean = false
  ): Promise<VoiceAwareBeatPrompt> {
    const bundle = await storyCraftRepo.getBundle(ctx.manuscriptId, userId, isAdmin)
    const beat = bundle.beats.find(b => b.id === ctx.beatId)
    if (!beat) throw new NotFoundError('Beat not found')

    const pov = beat.povCharacterId
      ? bundle.characters.find(c => c.id === beat.povCharacterId) ?? null
      : null

    const motifsAtBeat = bundle.beatMotifs
      .filter(bm => bm.beatId === beat.id)
      .map(bm => bundle.motifs.find(m => m.id === bm.motifId)?.name)
      .filter((s): s is string => Boolean(s))

    const knowledgeAtBeat = bundle.beatKnowledge.filter(k => k.beatId === beat.id)
    const readerKnowsHere = knowledgeAtBeat.filter(k => k.characterId === null)
    const povKnowsHere = pov ? knowledgeAtBeat.filter(k => k.characterId === pov.id) : []

    return {
      system: buildSystemPrompt(pov, beat),
      user: buildUserPrompt(beat, pov, motifsAtBeat, readerKnowsHere, povKnowsHere),
      meta: {
        beatId: beat.id,
        povCharacterId: pov?.id ?? null,
        povCharacterName: pov?.name ?? null,
        voiceConstraint: beat.voiceConstraint,
        withholdingLevel: beat.withholdingLevel,
      },
    }
  },
}

/* ---- internal prompt construction ---- */

function buildSystemPrompt(pov: Character | null, beat: Beat): string {
  const parts: string[] = [
    'You are a careful prose-fiction collaborator. You draft a single scene from a planned beat, in the voice of a specific character whose voice bible is given.',
    '',
    'Rules:',
    '- Stay strictly in the named POV. Do not switch.',
    '- Honour the voice bible: respect the listed sentence length, rhythm, preferred and forbidden vocabulary, metaphor sources, attention pattern, and avoidance pattern.',
    '- Never use modern therapeutic vocabulary inside a period character\'s consciousness unless the bible explicitly allows it.',
    '- Show emotion through behaviour, syntax, omission, and setting — never through abstract emotional naming.',
    '- Treat the "withholding level" as a constraint on what may be named directly. high = imply only.',
    '- The "reader inference" field tells you what the reader should understand that the POV character does not. Make sure the prose preserves that gap.',
  ]
  if (pov?.voice) {
    const v = pov.voice as VoiceBible
    parts.push('', `Voice bible for ${pov.name}:`)
    if (v.sentenceLength) parts.push(`- Sentence length: ${v.sentenceLength}`)
    if (v.rhythm) parts.push(`- Rhythm: ${v.rhythm}`)
    if (v.preferredWords?.length) parts.push(`- Preferred lexicon: ${v.preferredWords.join(', ')}`)
    if (v.forbiddenWords?.length) parts.push(`- Forbidden / rare: ${v.forbiddenWords.join(', ')}`)
    if (v.metaphorSources?.length) parts.push(`- Metaphor sources: ${v.metaphorSources.join(', ')}`)
    if (v.attentionPattern) parts.push(`- Attention pattern: ${v.attentionPattern}`)
    if (v.avoidancePattern) parts.push(`- Avoidance pattern: ${v.avoidancePattern}`)
    if (v.howEmotionLeaks) parts.push(`- How emotion leaks: ${v.howEmotionLeaks}`)
    if (v.sampleSentenceNeutral) parts.push(`- Sample (neutral): "${v.sampleSentenceNeutral}"`)
    if (v.sampleSentenceUnderPressure) parts.push(`- Sample (under pressure): "${v.sampleSentenceUnderPressure}"`)
  }
  if (beat.voiceConstraint) parts.push('', `Beat-specific voice constraint: ${beat.voiceConstraint}`)
  parts.push('', 'Output: prose only. No headings, no bracketed annotations, no meta commentary.')
  return parts.join('\n')
}

function buildUserPrompt(
  beat: Beat,
  pov: Character | null,
  motifs: string[],
  readerKnows: { knowledgeKind: string; text: string }[],
  povKnows: { knowledgeKind: string; text: string }[]
): string {
  const parts: string[] = [
    `Draft this beat in ${pov?.name ?? '(no POV set)'}'s voice.`,
    '',
    `Beat label: ${beat.label ?? '—'}`,
    `Timeline point: ${beat.timelinePoint ?? '—'}`,
    `Withholding level: ${beat.withholdingLevel ?? 'unset'}`,
    `Scene function: ${beat.sceneFunctionType ?? 'unset'}`,
  ]
  if (beat.outerEvent) parts.push('', `Outer event: ${beat.outerEvent}`)
  if (beat.innerTurn) parts.push(`Inner turn: ${beat.innerTurn}`)
  if (beat.uniquePerception) parts.push(`Unique perception this voice provides: ${beat.uniquePerception}`)
  if (beat.blindSpot) parts.push(`This voice's blind spot at this beat: ${beat.blindSpot}`)
  if (beat.misreading) parts.push(`This voice's misreading: ${beat.misreading}`)
  if (beat.readerInference) parts.push(`What the reader should understand that the POV does not: ${beat.readerInference}`)
  if (beat.finalImage) parts.push(`Final image: ${beat.finalImage}`)
  if (motifs.length) parts.push('', `Motifs in play: ${motifs.join(', ')}`)
  if (povKnows.length) {
    parts.push('', `${pov?.name ?? 'POV'} knowledge state at this beat:`)
    for (const k of povKnows) parts.push(`- ${k.knowledgeKind}: ${k.text}`)
  }
  if (readerKnows.length) {
    parts.push('', 'Reader knowledge at this beat (do NOT have the POV character name these directly):')
    for (const k of readerKnows) parts.push(`- ${k.knowledgeKind}: ${k.text}`)
  }
  parts.push('', 'Draft now. 200–500 words.')
  return parts.join('\n')
}
