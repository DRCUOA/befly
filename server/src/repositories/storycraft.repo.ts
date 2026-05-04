import { pool } from '../config/db.js'
import {
  Character,
  CharacterMisreading,
  Motif,
  MotifVoiceVariant,
  Beat,
  BeatKnowledge,
  BeatMotif,
  CausalLink,
  Silence,
  StoryCraftBundle,
  VoiceBible,
  KnowledgeKind,
  CausalLinkType,
  WithholdingLevel,
  SceneFunctionType,
  SilenceType,
} from '../models/StoryCraft.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'

/**
 * Story-craft repository — DAO layer for the Character Studio, Polyphonic Map,
 * and Plot Causality views. All access is gated through assertManuscriptAccess
 * which mirrors the manuscript repo's read/write rules so visibility and
 * ownership behave identically across views.
 *
 * Beats are the planning unit (one scene). Items are the prose container.
 * They may be linked 1:1 but don't have to be.
 */

type AccessMode = 'read' | 'write'

const CHARACTER_COLUMNS = `
  id,
  manuscript_id     AS "manuscriptId",
  name,
  full_name         AS "fullName",
  role,
  social_position   AS "socialPosition",
  contradiction,
  public_want       AS "publicWant",
  private_want      AS "privateWant",
  hidden_need       AS "hiddenNeed",
  greatest_fear     AS "greatestFear",
  false_belief      AS "falseBelief",
  wound,
  voice,
  arc_phases        AS "arcPhases",
  plot_functions    AS "plotFunctions",
  order_index       AS "orderIndex",
  color,
  notes,
  created_at        AS "createdAt",
  updated_at        AS "updatedAt"
`

const MISREADING_COLUMNS = `
  id,
  character_id  AS "characterId",
  label,
  why,
  order_index   AS "orderIndex",
  created_at    AS "createdAt"
`

const MOTIF_COLUMNS = `
  id,
  manuscript_id AS "manuscriptId",
  name,
  function,
  order_index   AS "orderIndex",
  created_at    AS "createdAt",
  updated_at    AS "updatedAt"
`

const BEAT_COLUMNS = `
  id,
  manuscript_id            AS "manuscriptId",
  pov_character_id         AS "povCharacterId",
  item_id                  AS "itemId",
  order_index              AS "orderIndex",
  label,
  title,
  timeline_point           AS "timelinePoint",
  movement,
  outer_event              AS "outerEvent",
  inner_turn               AS "innerTurn",
  voice_constraint         AS "voiceConstraint",
  final_image              AS "finalImage",
  scene_function_type      AS "sceneFunctionType",
  withholding_level        AS "withholdingLevel",
  unique_perception        AS "uniquePerception",
  blind_spot               AS "blindSpot",
  misreading,
  reader_inference         AS "readerInference",
  reason_for_next_pov_switch AS "reasonForNextPovSwitch",
  created_at               AS "createdAt",
  updated_at               AS "updatedAt"
`

const BEAT_KNOWLEDGE_COLUMNS = `
  id,
  beat_id        AS "beatId",
  character_id   AS "characterId",
  knowledge_kind AS "knowledgeKind",
  text,
  order_index    AS "orderIndex",
  created_at     AS "createdAt"
`

const CAUSAL_LINK_COLUMNS = `
  id,
  manuscript_id AS "manuscriptId",
  from_beat_id  AS "fromBeatId",
  to_beat_id    AS "toBeatId",
  link_type     AS "linkType",
  note,
  created_at    AS "createdAt"
`

const SILENCE_COLUMNS = `
  id,
  manuscript_id AS "manuscriptId",
  character_id  AS "characterId",
  beat_id       AS "beatId",
  what_unsaid   AS "whatUnsaid",
  why,
  consequence,
  silence_type  AS "silenceType",
  created_at    AS "createdAt"
`

/**
 * Confirm the caller may read or write the given manuscript. Mirrors the
 * manuscript repo's rules exactly so story-craft visibility behaves the same.
 */
async function assertManuscriptAccess(
  manuscriptId: string,
  userId: string | null,
  isAdmin: boolean,
  mode: AccessMode
): Promise<void> {
  const result = await pool.query(
    `SELECT user_id, visibility FROM manuscript_projects WHERE id = $1`,
    [manuscriptId]
  )
  if (result.rows.length === 0) throw new NotFoundError('Manuscript not found')
  const ownerId: string = result.rows[0].user_id
  const visibility: string = result.rows[0].visibility

  if (isAdmin) return
  if (mode === 'read') {
    if (userId && ownerId === userId) return
    if (visibility === 'shared' || visibility === 'public') return
    throw new NotFoundError('Manuscript not found')
  }
  if (!userId) throw new ForbiddenError('Not authorized to modify this manuscript')
  if (ownerId !== userId) throw new ForbiddenError('Not authorized to modify this manuscript')
}

/** Resolve the manuscriptId for a row in a child table, then assert access on it. */
async function assertParentAccessByLookup(
  table: string,
  rowId: string,
  userId: string | null,
  isAdmin: boolean,
  mode: AccessMode,
  notFoundLabel: string
): Promise<string> {
  const result = await pool.query(
    `SELECT manuscript_id FROM ${table} WHERE id = $1`,
    [rowId]
  )
  if (result.rows.length === 0) throw new NotFoundError(notFoundLabel)
  const manuscriptId: string = result.rows[0].manuscript_id
  await assertManuscriptAccess(manuscriptId, userId, isAdmin, mode)
  return manuscriptId
}

async function assertCharacterAccess(
  characterId: string,
  userId: string | null,
  isAdmin: boolean,
  mode: AccessMode
): Promise<string> {
  // characters has manuscript_id directly
  return assertParentAccessByLookup('characters', characterId, userId, isAdmin, mode, 'Character not found')
}

async function assertBeatAccess(
  beatId: string,
  userId: string | null,
  isAdmin: boolean,
  mode: AccessMode
): Promise<string> {
  return assertParentAccessByLookup('beats', beatId, userId, isAdmin, mode, 'Beat not found')
}

export const storyCraftRepo = {
  /* ============================================================
   *  Bundle — one round-trip for all the story-craft state.
   * ============================================================ */

  /**
   * Fetch every piece of story-craft data for a manuscript in one pass. The
   * polyphonic and plot views need most of these together, so this is much
   * cheaper than 8 separate fetches. Visibility checked once at the top.
   */
  async getBundle(
    manuscriptId: string,
    userId: string | null,
    isAdmin: boolean = false
  ): Promise<StoryCraftBundle> {
    await assertManuscriptAccess(manuscriptId, userId, isAdmin, 'read')

    const [
      characters,
      misreadings,
      motifs,
      motifVariants,
      beats,
      beatKnowledge,
      beatMotifs,
      causalLinks,
      silences,
    ] = await Promise.all([
      pool.query(
        `SELECT ${CHARACTER_COLUMNS} FROM characters WHERE manuscript_id = $1
         ORDER BY order_index ASC, created_at ASC`,
        [manuscriptId]
      ),
      pool.query(
        `SELECT ${MISREADING_COLUMNS} FROM character_misreadings
         WHERE character_id IN (SELECT id FROM characters WHERE manuscript_id = $1)
         ORDER BY order_index ASC, created_at ASC`,
        [manuscriptId]
      ),
      pool.query(
        `SELECT ${MOTIF_COLUMNS} FROM motifs WHERE manuscript_id = $1
         ORDER BY order_index ASC, created_at ASC`,
        [manuscriptId]
      ),
      pool.query(
        `SELECT motif_id AS "motifId", character_id AS "characterId", meaning
         FROM motif_voice_variants
         WHERE motif_id IN (SELECT id FROM motifs WHERE manuscript_id = $1)`,
        [manuscriptId]
      ),
      pool.query(
        `SELECT ${BEAT_COLUMNS} FROM beats WHERE manuscript_id = $1
         ORDER BY order_index ASC, created_at ASC`,
        [manuscriptId]
      ),
      pool.query(
        `SELECT ${BEAT_KNOWLEDGE_COLUMNS} FROM beat_knowledge
         WHERE beat_id IN (SELECT id FROM beats WHERE manuscript_id = $1)
         ORDER BY beat_id, character_id NULLS FIRST, order_index ASC`,
        [manuscriptId]
      ),
      pool.query(
        `SELECT beat_id AS "beatId", motif_id AS "motifId", variant_note AS "variantNote"
         FROM beat_motifs
         WHERE beat_id IN (SELECT id FROM beats WHERE manuscript_id = $1)`,
        [manuscriptId]
      ),
      pool.query(
        `SELECT ${CAUSAL_LINK_COLUMNS} FROM causal_links WHERE manuscript_id = $1
         ORDER BY created_at ASC`,
        [manuscriptId]
      ),
      pool.query(
        `SELECT ${SILENCE_COLUMNS} FROM silences WHERE manuscript_id = $1
         ORDER BY created_at ASC`,
        [manuscriptId]
      ),
    ])

    return {
      characters: characters.rows,
      misreadings: misreadings.rows,
      motifs: motifs.rows,
      motifVariants: motifVariants.rows,
      beats: beats.rows,
      beatKnowledge: beatKnowledge.rows,
      beatMotifs: beatMotifs.rows,
      causalLinks: causalLinks.rows,
      silences: silences.rows,
    }
  },

  /* ============================================================
   *  Characters
   * ============================================================ */

  async listCharacters(
    manuscriptId: string,
    userId: string | null,
    isAdmin: boolean = false
  ): Promise<Character[]> {
    await assertManuscriptAccess(manuscriptId, userId, isAdmin, 'read')
    const result = await pool.query(
      `SELECT ${CHARACTER_COLUMNS} FROM characters WHERE manuscript_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [manuscriptId]
    )
    return result.rows
  },

  async createCharacter(
    manuscriptId: string,
    userId: string,
    input: {
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
      voice?: VoiceBible
      arcPhases?: string[]
      plotFunctions?: string[]
      orderIndex?: number
      color?: string | null
      notes?: string | null
    },
    isAdmin: boolean = false
  ): Promise<Character> {
    await assertManuscriptAccess(manuscriptId, userId, isAdmin, 'write')

    let orderIndex = input.orderIndex
    if (orderIndex === undefined) {
      const tail = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1) AS max FROM characters WHERE manuscript_id = $1`,
        [manuscriptId]
      )
      orderIndex = (tail.rows[0].max as number) + 1
    }

    const result = await pool.query(
      `INSERT INTO characters (
         manuscript_id, name, full_name, role, social_position,
         contradiction, public_want, private_want, hidden_need, greatest_fear,
         false_belief, wound, voice, arc_phases, plot_functions,
         order_index, color, notes
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING ${CHARACTER_COLUMNS}`,
      [
        manuscriptId,
        input.name,
        input.fullName ?? null,
        input.role ?? null,
        input.socialPosition ?? null,
        input.contradiction ?? null,
        input.publicWant ?? null,
        input.privateWant ?? null,
        input.hiddenNeed ?? null,
        input.greatestFear ?? null,
        input.falseBelief ?? null,
        input.wound ?? null,
        JSON.stringify(input.voice ?? {}),
        input.arcPhases ?? [],
        input.plotFunctions ?? [],
        orderIndex,
        input.color ?? null,
        input.notes ?? null,
      ]
    )
    return result.rows[0]
  },

  async updateCharacter(
    characterId: string,
    userId: string,
    updates: Partial<{
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
      orderIndex: number
      color: string | null
      notes: string | null
    }>,
    isAdmin: boolean = false
  ): Promise<Character> {
    await assertCharacterAccess(characterId, userId, isAdmin, 'write')

    const fields: string[] = []
    const values: unknown[] = []
    let i = 1
    const set = (col: string, val: unknown) => {
      fields.push(`${col} = $${i++}`)
      values.push(val)
    }

    if (updates.name !== undefined) set('name', updates.name)
    if (updates.fullName !== undefined) set('full_name', updates.fullName)
    if (updates.role !== undefined) set('role', updates.role)
    if (updates.socialPosition !== undefined) set('social_position', updates.socialPosition)
    if (updates.contradiction !== undefined) set('contradiction', updates.contradiction)
    if (updates.publicWant !== undefined) set('public_want', updates.publicWant)
    if (updates.privateWant !== undefined) set('private_want', updates.privateWant)
    if (updates.hiddenNeed !== undefined) set('hidden_need', updates.hiddenNeed)
    if (updates.greatestFear !== undefined) set('greatest_fear', updates.greatestFear)
    if (updates.falseBelief !== undefined) set('false_belief', updates.falseBelief)
    if (updates.wound !== undefined) set('wound', updates.wound)
    if (updates.voice !== undefined) set('voice', JSON.stringify(updates.voice))
    if (updates.arcPhases !== undefined) set('arc_phases', updates.arcPhases)
    if (updates.plotFunctions !== undefined) set('plot_functions', updates.plotFunctions)
    if (updates.orderIndex !== undefined) set('order_index', updates.orderIndex)
    if (updates.color !== undefined) set('color', updates.color)
    if (updates.notes !== undefined) set('notes', updates.notes)

    if (fields.length === 0) {
      const out = await pool.query(`SELECT ${CHARACTER_COLUMNS} FROM characters WHERE id = $1`, [characterId])
      return out.rows[0]
    }
    fields.push(`updated_at = NOW()`)
    values.push(characterId)
    const result = await pool.query(
      `UPDATE characters SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${CHARACTER_COLUMNS}`,
      values
    )
    return result.rows[0]
  },

  async deleteCharacter(characterId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    await assertCharacterAccess(characterId, userId, isAdmin, 'write')
    await pool.query('DELETE FROM characters WHERE id = $1', [characterId])
  },

  /* ============================================================
   *  Misreadings
   * ============================================================ */

  async createMisreading(
    characterId: string,
    userId: string,
    input: { label: string; why?: string | null; orderIndex?: number },
    isAdmin: boolean = false
  ): Promise<CharacterMisreading> {
    await assertCharacterAccess(characterId, userId, isAdmin, 'write')
    let orderIndex = input.orderIndex
    if (orderIndex === undefined) {
      const tail = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1) AS max FROM character_misreadings WHERE character_id = $1`,
        [characterId]
      )
      orderIndex = (tail.rows[0].max as number) + 1
    }
    const result = await pool.query(
      `INSERT INTO character_misreadings (character_id, label, why, order_index)
       VALUES ($1, $2, $3, $4)
       RETURNING ${MISREADING_COLUMNS}`,
      [characterId, input.label, input.why ?? null, orderIndex]
    )
    return result.rows[0]
  },

  async deleteMisreading(misreadingId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    // misreadings don't have manuscript_id directly; resolve via character
    const lookup = await pool.query(
      `SELECT cm.character_id FROM character_misreadings cm WHERE cm.id = $1`,
      [misreadingId]
    )
    if (lookup.rows.length === 0) throw new NotFoundError('Misreading not found')
    await assertCharacterAccess(lookup.rows[0].character_id, userId, isAdmin, 'write')
    await pool.query('DELETE FROM character_misreadings WHERE id = $1', [misreadingId])
  },

  /* ============================================================
   *  Motifs
   * ============================================================ */

  async createMotif(
    manuscriptId: string,
    userId: string,
    input: { name: string; function?: string | null; orderIndex?: number },
    isAdmin: boolean = false
  ): Promise<Motif> {
    await assertManuscriptAccess(manuscriptId, userId, isAdmin, 'write')
    let orderIndex = input.orderIndex
    if (orderIndex === undefined) {
      const tail = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1) AS max FROM motifs WHERE manuscript_id = $1`,
        [manuscriptId]
      )
      orderIndex = (tail.rows[0].max as number) + 1
    }
    const result = await pool.query(
      `INSERT INTO motifs (manuscript_id, name, function, order_index)
       VALUES ($1, $2, $3, $4)
       RETURNING ${MOTIF_COLUMNS}`,
      [manuscriptId, input.name, input.function ?? null, orderIndex]
    )
    return result.rows[0]
  },

  async updateMotif(
    motifId: string,
    userId: string,
    updates: Partial<{ name: string; function: string | null; orderIndex: number }>,
    isAdmin: boolean = false
  ): Promise<Motif> {
    await assertParentAccessByLookup('motifs', motifId, userId, isAdmin, 'write', 'Motif not found')
    const fields: string[] = []
    const values: unknown[] = []
    let i = 1
    if (updates.name !== undefined) { fields.push(`name = $${i++}`); values.push(updates.name) }
    if (updates.function !== undefined) { fields.push(`function = $${i++}`); values.push(updates.function) }
    if (updates.orderIndex !== undefined) { fields.push(`order_index = $${i++}`); values.push(updates.orderIndex) }
    if (fields.length === 0) {
      const out = await pool.query(`SELECT ${MOTIF_COLUMNS} FROM motifs WHERE id = $1`, [motifId])
      return out.rows[0]
    }
    fields.push(`updated_at = NOW()`)
    values.push(motifId)
    const result = await pool.query(
      `UPDATE motifs SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${MOTIF_COLUMNS}`,
      values
    )
    return result.rows[0]
  },

  async deleteMotif(motifId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    await assertParentAccessByLookup('motifs', motifId, userId, isAdmin, 'write', 'Motif not found')
    await pool.query('DELETE FROM motifs WHERE id = $1', [motifId])
  },

  async setMotifVariant(
    motifId: string,
    characterId: string,
    userId: string,
    meaning: string | null,
    isAdmin: boolean = false
  ): Promise<MotifVoiceVariant> {
    await assertParentAccessByLookup('motifs', motifId, userId, isAdmin, 'write', 'Motif not found')
    const result = await pool.query(
      `INSERT INTO motif_voice_variants (motif_id, character_id, meaning)
       VALUES ($1, $2, $3)
       ON CONFLICT (motif_id, character_id) DO UPDATE SET meaning = EXCLUDED.meaning
       RETURNING motif_id AS "motifId", character_id AS "characterId", meaning`,
      [motifId, characterId, meaning]
    )
    return result.rows[0]
  },

  /* ============================================================
   *  Beats
   * ============================================================ */

  async listBeats(
    manuscriptId: string,
    userId: string | null,
    isAdmin: boolean = false
  ): Promise<Beat[]> {
    await assertManuscriptAccess(manuscriptId, userId, isAdmin, 'read')
    const result = await pool.query(
      `SELECT ${BEAT_COLUMNS} FROM beats WHERE manuscript_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [manuscriptId]
    )
    return result.rows
  },

  async createBeat(
    manuscriptId: string,
    userId: string,
    input: Partial<Omit<Beat, 'id' | 'manuscriptId' | 'createdAt' | 'updatedAt'>>,
    isAdmin: boolean = false
  ): Promise<Beat> {
    await assertManuscriptAccess(manuscriptId, userId, isAdmin, 'write')
    let orderIndex = input.orderIndex
    if (orderIndex === undefined) {
      const tail = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1) AS max FROM beats WHERE manuscript_id = $1`,
        [manuscriptId]
      )
      orderIndex = (tail.rows[0].max as number) + 1
    }
    const result = await pool.query(
      `INSERT INTO beats (
         manuscript_id, pov_character_id, item_id, order_index,
         label, title, timeline_point, movement,
         outer_event, inner_turn, voice_constraint, final_image,
         scene_function_type, withholding_level,
         unique_perception, blind_spot, misreading, reader_inference, reason_for_next_pov_switch
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING ${BEAT_COLUMNS}`,
      [
        manuscriptId,
        input.povCharacterId ?? null,
        input.itemId ?? null,
        orderIndex,
        input.label ?? null,
        input.title ?? null,
        input.timelinePoint ?? null,
        input.movement ?? null,
        input.outerEvent ?? null,
        input.innerTurn ?? null,
        input.voiceConstraint ?? null,
        input.finalImage ?? null,
        input.sceneFunctionType ?? null,
        input.withholdingLevel ?? null,
        input.uniquePerception ?? null,
        input.blindSpot ?? null,
        input.misreading ?? null,
        input.readerInference ?? null,
        input.reasonForNextPovSwitch ?? null,
      ]
    )
    return result.rows[0]
  },

  async updateBeat(
    beatId: string,
    userId: string,
    updates: Partial<Omit<Beat, 'id' | 'manuscriptId' | 'createdAt' | 'updatedAt'>>,
    isAdmin: boolean = false
  ): Promise<Beat> {
    await assertBeatAccess(beatId, userId, isAdmin, 'write')

    const fields: string[] = []
    const values: unknown[] = []
    let i = 1
    const set = (col: string, val: unknown) => { fields.push(`${col} = $${i++}`); values.push(val) }

    if (updates.povCharacterId !== undefined) set('pov_character_id', updates.povCharacterId)
    if (updates.itemId !== undefined) set('item_id', updates.itemId)
    if (updates.orderIndex !== undefined) set('order_index', updates.orderIndex)
    if (updates.label !== undefined) set('label', updates.label)
    if (updates.title !== undefined) set('title', updates.title)
    if (updates.timelinePoint !== undefined) set('timeline_point', updates.timelinePoint)
    if (updates.movement !== undefined) set('movement', updates.movement)
    if (updates.outerEvent !== undefined) set('outer_event', updates.outerEvent)
    if (updates.innerTurn !== undefined) set('inner_turn', updates.innerTurn)
    if (updates.voiceConstraint !== undefined) set('voice_constraint', updates.voiceConstraint)
    if (updates.finalImage !== undefined) set('final_image', updates.finalImage)
    if (updates.sceneFunctionType !== undefined) set('scene_function_type', updates.sceneFunctionType)
    if (updates.withholdingLevel !== undefined) set('withholding_level', updates.withholdingLevel)
    if (updates.uniquePerception !== undefined) set('unique_perception', updates.uniquePerception)
    if (updates.blindSpot !== undefined) set('blind_spot', updates.blindSpot)
    if (updates.misreading !== undefined) set('misreading', updates.misreading)
    if (updates.readerInference !== undefined) set('reader_inference', updates.readerInference)
    if (updates.reasonForNextPovSwitch !== undefined) set('reason_for_next_pov_switch', updates.reasonForNextPovSwitch)

    if (fields.length === 0) {
      const out = await pool.query(`SELECT ${BEAT_COLUMNS} FROM beats WHERE id = $1`, [beatId])
      return out.rows[0]
    }
    fields.push(`updated_at = NOW()`)
    values.push(beatId)
    const result = await pool.query(
      `UPDATE beats SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${BEAT_COLUMNS}`,
      values
    )
    return result.rows[0]
  },

  async deleteBeat(beatId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    await assertBeatAccess(beatId, userId, isAdmin, 'write')
    await pool.query('DELETE FROM beats WHERE id = $1', [beatId])
  },

  /**
   * Bulk reorder for the beat strip on the polyphonic and plot views.
   */
  async reorderBeats(
    manuscriptId: string,
    userId: string,
    moves: { id: string; orderIndex: number }[],
    isAdmin: boolean = false
  ): Promise<Beat[]> {
    await assertManuscriptAccess(manuscriptId, userId, isAdmin, 'write')
    if (moves.length === 0) return this.listBeats(manuscriptId, userId, isAdmin)

    const ids = moves.map(m => m.id)
    const owns = await pool.query(
      `SELECT id FROM beats WHERE manuscript_id = $1 AND id = ANY($2::uuid[])`,
      [manuscriptId, ids]
    )
    if (owns.rows.length !== ids.length) {
      throw new ForbiddenError('Some beats do not belong to this manuscript')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const move of moves) {
        await client.query(
          `UPDATE beats SET order_index = $1, updated_at = NOW() WHERE id = $2`,
          [move.orderIndex, move.id]
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return this.listBeats(manuscriptId, userId, isAdmin)
  },

  /* ============================================================
   *  Beat knowledge (the ledger)
   * ============================================================ */

  /**
   * Set the knowledge entry for (beat, character, kind). The polyphonic grid
   * treats one cell as one (beat, character) pair with a single primary kind+text;
   * we use upsert semantics keyed on (beat_id, character_id, knowledge_kind).
   * Calling with `text === null` deletes the entry.
   */
  async setBeatKnowledge(
    beatId: string,
    userId: string,
    input: {
      characterId: string | null   // null = reader row
      knowledgeKind: KnowledgeKind
      text: string | null
    },
    isAdmin: boolean = false
  ): Promise<BeatKnowledge | null> {
    await assertBeatAccess(beatId, userId, isAdmin, 'write')

    if (input.text === null || input.text.trim() === '') {
      // Use IS NOT DISTINCT FROM so we match NULL character_id correctly.
      await pool.query(
        `DELETE FROM beat_knowledge
         WHERE beat_id = $1
           AND character_id IS NOT DISTINCT FROM $2
           AND knowledge_kind = $3`,
        [beatId, input.characterId, input.knowledgeKind]
      )
      return null
    }

    // Try update; if no row, insert.
    const updated = await pool.query(
      `UPDATE beat_knowledge
       SET text = $4
       WHERE beat_id = $1
         AND character_id IS NOT DISTINCT FROM $2
         AND knowledge_kind = $3
       RETURNING ${BEAT_KNOWLEDGE_COLUMNS}`,
      [beatId, input.characterId, input.knowledgeKind, input.text]
    )
    if (updated.rows.length > 0) return updated.rows[0]

    const inserted = await pool.query(
      `INSERT INTO beat_knowledge (beat_id, character_id, knowledge_kind, text)
       VALUES ($1, $2, $3, $4)
       RETURNING ${BEAT_KNOWLEDGE_COLUMNS}`,
      [beatId, input.characterId, input.knowledgeKind, input.text]
    )
    return inserted.rows[0]
  },

  /* ============================================================
   *  Beat motifs
   * ============================================================ */

  async setBeatMotif(
    beatId: string,
    motifId: string,
    userId: string,
    variantNote: string | null,
    isAdmin: boolean = false
  ): Promise<BeatMotif> {
    await assertBeatAccess(beatId, userId, isAdmin, 'write')
    const result = await pool.query(
      `INSERT INTO beat_motifs (beat_id, motif_id, variant_note)
       VALUES ($1, $2, $3)
       ON CONFLICT (beat_id, motif_id) DO UPDATE SET variant_note = EXCLUDED.variant_note
       RETURNING beat_id AS "beatId", motif_id AS "motifId", variant_note AS "variantNote"`,
      [beatId, motifId, variantNote]
    )
    return result.rows[0]
  },

  async unsetBeatMotif(
    beatId: string,
    motifId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<void> {
    await assertBeatAccess(beatId, userId, isAdmin, 'write')
    await pool.query(`DELETE FROM beat_motifs WHERE beat_id = $1 AND motif_id = $2`, [beatId, motifId])
  },

  /* ============================================================
   *  Causal links
   * ============================================================ */

  async createCausalLink(
    manuscriptId: string,
    userId: string,
    input: { fromBeatId: string; toBeatId: string; linkType: CausalLinkType; note?: string | null },
    isAdmin: boolean = false
  ): Promise<CausalLink> {
    await assertManuscriptAccess(manuscriptId, userId, isAdmin, 'write')

    // Sanity-check both beats live in this manuscript.
    const owns = await pool.query(
      `SELECT id FROM beats WHERE manuscript_id = $1 AND id IN ($2, $3)`,
      [manuscriptId, input.fromBeatId, input.toBeatId]
    )
    if (owns.rows.length !== 2) {
      throw new ForbiddenError('Both beats must belong to this manuscript')
    }

    const result = await pool.query(
      `INSERT INTO causal_links (manuscript_id, from_beat_id, to_beat_id, link_type, note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (from_beat_id, to_beat_id, link_type) DO UPDATE
         SET note = EXCLUDED.note
       RETURNING ${CAUSAL_LINK_COLUMNS}`,
      [manuscriptId, input.fromBeatId, input.toBeatId, input.linkType, input.note ?? null]
    )
    return result.rows[0]
  },

  async deleteCausalLink(linkId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    await assertParentAccessByLookup('causal_links', linkId, userId, isAdmin, 'write', 'Causal link not found')
    await pool.query('DELETE FROM causal_links WHERE id = $1', [linkId])
  },

  /* ============================================================
   *  Silences
   * ============================================================ */

  async createSilence(
    manuscriptId: string,
    userId: string,
    input: {
      characterId?: string | null
      beatId?: string | null
      whatUnsaid: string
      why?: string | null
      consequence?: string | null
      silenceType?: SilenceType | null
    },
    isAdmin: boolean = false
  ): Promise<Silence> {
    await assertManuscriptAccess(manuscriptId, userId, isAdmin, 'write')
    const result = await pool.query(
      `INSERT INTO silences (manuscript_id, character_id, beat_id, what_unsaid, why, consequence, silence_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SILENCE_COLUMNS}`,
      [
        manuscriptId,
        input.characterId ?? null,
        input.beatId ?? null,
        input.whatUnsaid,
        input.why ?? null,
        input.consequence ?? null,
        input.silenceType ?? null,
      ]
    )
    return result.rows[0]
  },

  async deleteSilence(silenceId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    await assertParentAccessByLookup('silences', silenceId, userId, isAdmin, 'write', 'Silence not found')
    await pool.query('DELETE FROM silences WHERE id = $1', [silenceId])
  },

  /* ============================================================
   *  Internal helpers exported for the seed importer.
   * ============================================================ */

  _internal: {
    assertManuscriptAccess,
  },
}

// Re-export types for convenience in the service layer.
export type { CausalLinkType, SceneFunctionType, WithholdingLevel, KnowledgeKind, SilenceType }
