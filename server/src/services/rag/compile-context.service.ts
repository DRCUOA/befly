/**
 * Manuscript context compiler.
 *
 * Reads everything that belongs to one manuscript and writes a clean,
 * AI-readable representation of it into manuscript_context_sources. The
 * compiler is the ONLY component that decides which domain rows turn
 * into which context sources — every other RAG component (chunker,
 * embedder, retriever) operates on the compiled rows alone.
 *
 * Why a compile step at all (rather than embedding domain rows directly):
 *   - Domain rows are JSON-shaped (characters.voice is JSONB, beats has
 *     20+ nullable text fields). Embedding raw JSON yields meaningless
 *     vectors — the model needs prose.
 *   - Membership rules differ per source. A writing_block is only in a
 *     manuscript if a manuscript_item links it. The compiler is the
 *     single place those rules live.
 *   - Idempotency. content_hash on the compiled body lets us short-
 *     circuit chunking + embedding when nothing actually changed, which
 *     is the common case (the user edited one beat, not the whole book).
 *
 * Manuscript-segregation guarantee: every source row written here carries
 * the manuscript_id of the manuscript being compiled. The compiler never
 * reads cross-manuscript data, and never writes to a different manuscript.
 */

import { createHash } from 'node:crypto'
import { pool } from '../../config/db.js'
import { manuscriptContextRepo } from '../../repositories/manuscript-context.repo.js'
import {
  CompileOptions,
  CompileResult,
  ContextRole,
  ContextSourceType,
} from '../../models/ManuscriptContext.js'
import { logger } from '../../utils/logger.js'

/* ----- helpers ----- */

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function normaliseBody(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim()
}

function bullet(label: string, value: string | null | undefined): string {
  if (!value || !value.trim()) return ''
  return `${label}: ${value.trim()}\n`
}

function listOrNull(arr: string[] | null | undefined): string | null {
  if (!arr || arr.length === 0) return null
  return arr.join(' · ')
}

function mapToText(obj: Record<string, unknown> | null | undefined): string {
  if (!obj || typeof obj !== 'object') return ''
  const lines: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    if (typeof v === 'string' && !v.trim()) continue
    if (Array.isArray(v)) {
      if (v.length === 0) continue
      lines.push(`  ${k}: ${v.map(x => String(x)).join(', ')}`)
    } else if (typeof v === 'object') {
      lines.push(`  ${k}: ${JSON.stringify(v)}`)
    } else {
      lines.push(`  ${k}: ${String(v)}`)
    }
  }
  return lines.join('\n')
}

/* ----- compiled-source factory ----- */

interface CompiledSource {
  sourceType: ContextSourceType
  sourceId: string | null
  title: string
  body: string
  metadata: Record<string, unknown>
  contextRole: ContextRole
  priority?: number
  canonical?: boolean
  includeInAi?: boolean
}

/* ----- per-table compilers ----- */

async function compileManuscriptProject(manuscriptId: string): Promise<{ ownerId: string; source: CompiledSource } | null> {
  const r = await pool.query(
    `SELECT id, user_id, title, working_subtitle, form, status,
            intended_reader, central_question, through_line,
            emotional_arc, narrative_promise
       FROM manuscript_projects
      WHERE id = $1`,
    [manuscriptId]
  )
  if (r.rows.length === 0) return null
  const m = r.rows[0]
  const body =
    `Manuscript: ${m.title}\n` +
    bullet('Subtitle', m.working_subtitle) +
    bullet('Form', m.form) +
    bullet('Status', m.status) +
    bullet('Intended reader', m.intended_reader) +
    bullet('Central question', m.central_question) +
    bullet('Through-line', m.through_line) +
    bullet('Emotional arc', m.emotional_arc) +
    bullet('Narrative promise', m.narrative_promise)
  return {
    ownerId: m.user_id,
    source: {
      sourceType: 'manuscript_project',
      sourceId: m.id,
      title: `Manuscript Direction: ${m.title}`,
      body: body.trim(),
      metadata: { form: m.form, status: m.status },
      contextRole: 'structure',
      priority: 100,
      canonical: true,
    },
  }
}

async function compileSections(manuscriptId: string): Promise<CompiledSource[]> {
  const r = await pool.query(
    `SELECT id, title, order_index, purpose, notes
       FROM manuscript_sections
      WHERE manuscript_id = $1
      ORDER BY order_index`,
    [manuscriptId]
  )
  return r.rows.map(row => ({
    sourceType: 'manuscript_section' as ContextSourceType,
    sourceId: row.id,
    title: `Section ${row.order_index}: ${row.title}`,
    body: (
      `Section: ${row.title}\n` +
      bullet('Purpose', row.purpose) +
      bullet('Notes', row.notes)
    ).trim(),
    metadata: { orderIndex: row.order_index, purpose: row.purpose },
    contextRole: 'structure',
    priority: 60,
  }))
}

async function compileItemsAndWritingBlocks(manuscriptId: string): Promise<CompiledSource[]> {
  // Pull items joined to their writing block (if any) and section title.
  const r = await pool.query(
    `SELECT mi.id          AS item_id,
            mi.title       AS item_title,
            mi.item_type,
            mi.structural_role,
            mi.summary,
            mi.ai_notes,
            mi.order_index,
            wb.id          AS wb_id,
            wb.title       AS wb_title,
            wb.body        AS wb_body,
            ms.title       AS section_title
       FROM manuscript_items mi
       LEFT JOIN writing_blocks      wb ON wb.id = mi.writing_block_id
       LEFT JOIN manuscript_sections ms ON ms.id = mi.section_id
      WHERE mi.manuscript_id = $1
      ORDER BY mi.order_index`,
    [manuscriptId]
  )

  const out: CompiledSource[] = []
  // Track writing_blocks we've already emitted so a block re-used in two
  // items still produces one writing_block source row, not two.
  const emittedBlockIds = new Set<string>()

  for (const row of r.rows) {
    // 1. The item itself — captures structural metadata even when there
    //    is no body yet (placeholder, bridge, etc.).
    const itemBody =
      `Manuscript Item: ${row.item_title}\n` +
      bullet('Item type', row.item_type) +
      bullet('Structural role', row.structural_role) +
      bullet('Section', row.section_title) +
      bullet('Summary', row.summary) +
      bullet('AI notes', row.ai_notes) +
      bullet('Source writing block title', row.wb_title) +
      (row.wb_body ? `\nSource writing block body:\n${normaliseBody(row.wb_body).slice(0, 8000)}` : '')

    out.push({
      sourceType: 'manuscript_item',
      sourceId: row.item_id,
      title: `Item: ${row.item_title}`,
      body: itemBody.trim(),
      metadata: {
        itemType: row.item_type,
        orderIndex: row.order_index,
        sectionTitle: row.section_title ?? null,
        writingBlockId: row.wb_id ?? null,
      },
      contextRole: 'manuscript_text',
      priority: 80,
      canonical: row.item_type === 'essay',
    })

    // 2. The writing block (essay body) as its own source so retrieval
    //    can match against the prose itself, not just the item title.
    if (row.wb_id && !emittedBlockIds.has(row.wb_id) && row.wb_body) {
      emittedBlockIds.add(row.wb_id)
      out.push({
        sourceType: 'writing_block',
        sourceId: row.wb_id,
        title: row.wb_title || row.item_title,
        body: normaliseBody(row.wb_body),
        metadata: { itemId: row.item_id },
        contextRole: 'manuscript_text',
        priority: 90,
        canonical: true,
      })
    }
  }
  return out
}

async function compileArtifacts(manuscriptId: string): Promise<CompiledSource[]> {
  const r = await pool.query(
    `SELECT id, type, title, content, status, source_model
       FROM manuscript_artifacts
      WHERE manuscript_id = $1
        AND status IN ('draft','accepted')`,
    [manuscriptId]
  )
  return r.rows.map(row => ({
    sourceType: 'manuscript_artifact' as ContextSourceType,
    sourceId: row.id,
    title: `Artifact (${row.type}): ${row.title}`,
    body: (
      `Artifact: ${row.title}\n` +
      bullet('Type', row.type) +
      bullet('Status', row.status) +
      bullet('Source model', row.source_model) +
      (row.content
        ? `\nContent:\n${typeof row.content === 'string' ? row.content : JSON.stringify(row.content, null, 2)}`
        : '')
    ).trim(),
    metadata: { type: row.type, status: row.status },
    contextRole: 'ai_output',
    priority: row.status === 'accepted' ? 70 : 30,
    // 'accepted' artifacts are treated as accepted-status context sources;
    // 'draft' artifacts stay 'draft'. Retrieval boosts accepted automatically.
    // This is set indirectly via status in run().
  }))
}

async function compileCharacters(manuscriptId: string): Promise<CompiledSource[]> {
  const charRows = await pool.query(
    `SELECT id, name, full_name, role, social_position,
            contradiction, public_want, private_want, hidden_need,
            greatest_fear, false_belief, wound, voice,
            arc_phases, plot_functions, notes
       FROM characters
      WHERE manuscript_id = $1`,
    [manuscriptId]
  )

  const misRows = await pool.query(
    `SELECT id, character_id, label, why
       FROM character_misreadings
      WHERE character_id IN (SELECT id FROM characters WHERE manuscript_id = $1)
      ORDER BY order_index`,
    [manuscriptId]
  )

  const out: CompiledSource[] = []
  for (const c of charRows.rows) {
    const voiceText = mapToText(c.voice as Record<string, unknown> | null)
    const body =
      `Character: ${c.name}\n` +
      bullet('Full name', c.full_name) +
      bullet('Role', c.role) +
      bullet('Social position', c.social_position) +
      bullet('Contradiction', c.contradiction) +
      bullet('Public want', c.public_want) +
      bullet('Private want', c.private_want) +
      bullet('Hidden need', c.hidden_need) +
      bullet('Greatest fear', c.greatest_fear) +
      bullet('False belief', c.false_belief) +
      bullet('Wound', c.wound) +
      (voiceText ? `Voice:\n${voiceText}\n` : '') +
      bullet('Arc phases', listOrNull(c.arc_phases as string[])) +
      bullet('Plot functions', listOrNull(c.plot_functions as string[])) +
      bullet('Notes', c.notes)
    out.push({
      sourceType: 'character',
      sourceId: c.id,
      title: `Character: ${c.name}`,
      body: body.trim(),
      metadata: { characterName: c.name, characterId: c.id },
      contextRole: 'character',
      priority: 95,
      canonical: true,
    })
  }

  // Misreadings are emitted as their own small sources so a query about
  // "what does X get wrong about Y?" can land directly on one.
  for (const m of misRows.rows) {
    const character = charRows.rows.find(c => c.id === m.character_id)
    out.push({
      sourceType: 'character_misreading',
      sourceId: m.id,
      title: `Misreading: ${character?.name ?? '(unknown)'} — ${m.label}`,
      body: (
        `Character: ${character?.name ?? '(unknown)'}\n` +
        bullet('Misreading', m.label) +
        bullet('Why', m.why)
      ).trim(),
      metadata: { characterId: m.character_id, characterName: character?.name ?? null },
      contextRole: 'character',
      priority: 50,
    })
  }
  return out
}

async function compileBeats(manuscriptId: string): Promise<CompiledSource[]> {
  const beats = await pool.query(
    `SELECT b.id, b.label, b.title, b.timeline_point, b.movement, b.order_index,
            b.outer_event, b.inner_turn, b.voice_constraint, b.final_image,
            b.scene_function_type, b.withholding_level,
            b.unique_perception, b.blind_spot, b.misreading,
            b.reader_inference, b.reason_for_next_pov_switch,
            c.name AS pov_name, c.id AS pov_id
       FROM beats b
       LEFT JOIN characters c ON c.id = b.pov_character_id
      WHERE b.manuscript_id = $1
      ORDER BY b.order_index`,
    [manuscriptId]
  )

  const out: CompiledSource[] = []
  for (const b of beats.rows) {
    const titleBit = b.title || b.label || `Beat ${b.order_index}`
    const body =
      `Beat ${b.order_index}: ${titleBit}\n` +
      bullet('Label', b.label) +
      bullet('Timeline point', b.timeline_point) +
      bullet('Movement', b.movement) +
      bullet('POV character', b.pov_name) +
      bullet('Outer event', b.outer_event) +
      bullet('Inner turn', b.inner_turn) +
      bullet('Voice constraint', b.voice_constraint) +
      bullet('Final image', b.final_image) +
      bullet('Scene function', b.scene_function_type) +
      bullet('Withholding level', b.withholding_level) +
      bullet('Unique perception', b.unique_perception) +
      bullet('Blind spot', b.blind_spot) +
      bullet('Misreading', b.misreading) +
      bullet('Reader inference', b.reader_inference) +
      bullet('Reason for next POV switch', b.reason_for_next_pov_switch)
    out.push({
      sourceType: 'beat',
      sourceId: b.id,
      title: `Beat ${b.order_index}: ${titleBit}`,
      body: body.trim(),
      metadata: {
        orderIndex: b.order_index,
        movement: b.movement,
        povCharacterId: b.pov_id ?? null,
        povCharacterName: b.pov_name ?? null,
      },
      contextRole: 'plot',
      priority: 75,
    })
  }
  return out
}

async function compileMotifs(manuscriptId: string): Promise<CompiledSource[]> {
  const motifs = await pool.query(
    `SELECT m.id, m.name, m.function,
            COALESCE(json_agg(
              json_build_object('character', c.name, 'meaning', mvv.meaning)
              ORDER BY c.name
            ) FILTER (WHERE c.id IS NOT NULL), '[]'::json) AS variants
       FROM motifs m
       LEFT JOIN motif_voice_variants mvv ON mvv.motif_id = m.id
       LEFT JOIN characters c            ON c.id = mvv.character_id
      WHERE m.manuscript_id = $1
      GROUP BY m.id`,
    [manuscriptId]
  )

  return motifs.rows.map(m => {
    const variants = m.variants as { character: string | null; meaning: string | null }[]
    const variantText = variants.length === 0
      ? ''
      : '\nVoice variants:\n' + variants
          .map(v => `- ${v.character ?? '(?)'}: ${v.meaning ?? ''}`)
          .join('\n')
    const body = (
      `Motif: ${m.name}\n` +
      bullet('Function', m.function) +
      variantText
    ).trim()
    return {
      sourceType: 'motif' as ContextSourceType,
      sourceId: m.id,
      title: `Motif: ${m.name}`,
      body,
      metadata: { motifName: m.name },
      contextRole: 'motif',
      priority: 65,
    }
  })
}

async function compileSilencesAndCausals(manuscriptId: string): Promise<CompiledSource[]> {
  const out: CompiledSource[] = []

  const silences = await pool.query(
    `SELECT s.id, s.what_unsaid, s.why, s.consequence, s.silence_type,
            c.name AS character_name
       FROM silences s
       LEFT JOIN characters c ON c.id = s.character_id
      WHERE s.manuscript_id = $1`,
    [manuscriptId]
  )
  for (const s of silences.rows) {
    out.push({
      sourceType: 'silence',
      sourceId: s.id,
      title: `Silence: ${s.what_unsaid.slice(0, 80)}`,
      body: (
        `Silence (${s.silence_type ?? 'unspecified'})\n` +
        bullet('Character', s.character_name) +
        bullet('What is unsaid', s.what_unsaid) +
        bullet('Why', s.why) +
        bullet('Consequence', s.consequence)
      ).trim(),
      metadata: { characterName: s.character_name ?? null, silenceType: s.silence_type },
      contextRole: 'continuity',
      priority: 45,
    })
  }

  const causals = await pool.query(
    `SELECT cl.id, cl.link_type, cl.note,
            f.title AS from_title, f.label AS from_label, f.order_index AS from_order,
            t.title AS to_title,   t.label AS to_label,   t.order_index AS to_order
       FROM causal_links cl
       JOIN beats f ON f.id = cl.from_beat_id
       JOIN beats t ON t.id = cl.to_beat_id
      WHERE cl.manuscript_id = $1`,
    [manuscriptId]
  )
  for (const c of causals.rows) {
    const fromName = c.from_title || c.from_label || `Beat ${c.from_order}`
    const toName = c.to_title || c.to_label || `Beat ${c.to_order}`
    out.push({
      sourceType: 'causal_link',
      sourceId: c.id,
      title: `Causal: ${fromName} → ${toName} (${c.link_type})`,
      body: (
        `Causal link (${c.link_type})\n` +
        `From: ${fromName}\n` +
        `To:   ${toName}\n` +
        bullet('Note', c.note)
      ).trim(),
      metadata: { linkType: c.link_type },
      contextRole: 'plot',
      priority: 40,
    })
  }
  return out
}

async function compileUploadedFiles(manuscriptId: string): Promise<CompiledSource[]> {
  // Only files explicitly attached to the manuscript via the join table
  // (migration 021) and marked include_in_ai. The body column is
  // intentionally a placeholder pointing at the file metadata — binary
  // content is handled by a separate pipeline (out of scope here).
  const r = await pool.query(
    `SELECT uf.id, uf.filename, uf.content_type, uf.size_bytes,
            muf.context_role, muf.include_in_ai
       FROM manuscript_uploaded_files muf
       JOIN uploaded_files uf ON uf.id = muf.uploaded_file_id
      WHERE muf.manuscript_id = $1
        AND muf.include_in_ai = TRUE`,
    [manuscriptId]
  )
  const out: CompiledSource[] = []
  for (const f of r.rows) {
    const role = (f.context_role as ContextRole) ?? 'supporting'
    out.push({
      sourceType: 'uploaded_file',
      sourceId: f.id,
      title: `Uploaded file: ${f.filename}`,
      body: (
        `Uploaded file: ${f.filename}\n` +
        bullet('Content type', f.content_type) +
        bullet('Size', f.size_bytes ? `${f.size_bytes} bytes` : null) +
        bullet('Context role', role) +
        '\n[File content is not extracted into the context layer in this version.]'
      ).trim(),
      metadata: { filename: f.filename, contentType: f.content_type, sizeBytes: f.size_bytes },
      contextRole: role,
      priority: 30,
    })
  }
  return out
}

/* ----- public API ----- */

export interface CompileManuscriptContextDeps {
  /** Override hook for tests; default reads ownership via SQL. */
  loadOwnerId?: (manuscriptId: string) => Promise<string | null>
}

/**
 * Compile every context source for a manuscript.
 *
 * Idempotent: rows with unchanged content_hash are left alone, so a
 * second compile pass with no upstream changes does no writes. Rows that
 * used to exist but no longer do (e.g. a deleted character) are marked
 * 'superseded' rather than deleted, so retrieval excludes them by
 * default but their history is preserved.
 */
export async function compileManuscriptContext(
  manuscriptId: string,
  options: CompileOptions = {},
  deps: CompileManuscriptContextDeps = {}
): Promise<CompileResult> {
  const project = await compileManuscriptProject(manuscriptId)
  if (!project) throw new Error(`compileManuscriptContext: manuscript ${manuscriptId} not found`)
  const ownerId = deps.loadOwnerId
    ? await deps.loadOwnerId(manuscriptId)
    : project.ownerId
  if (!ownerId) throw new Error(`compileManuscriptContext: cannot determine owner for ${manuscriptId}`)

  const all: CompiledSource[] = []
  all.push(project.source)
  all.push(...await compileSections(manuscriptId))
  all.push(...await compileItemsAndWritingBlocks(manuscriptId))
  // For artifacts, the status field on the source row mirrors the artifact
  // status (accepted/draft) — we set it via metadata first, then translate
  // when upserting below.
  const artifacts = await compileArtifacts(manuscriptId)
  all.push(...artifacts)
  all.push(...await compileCharacters(manuscriptId))
  all.push(...await compileBeats(manuscriptId))
  all.push(...await compileMotifs(manuscriptId))
  all.push(...await compileSilencesAndCausals(manuscriptId))
  all.push(...await compileUploadedFiles(manuscriptId))

  const filterTypes = options.sourceTypes && options.sourceTypes.length > 0
    ? new Set(options.sourceTypes)
    : null
  const planned = filterTypes
    ? all.filter(s => filterTypes.has(s.sourceType))
    : all

  const result: CompileResult = {
    manuscriptId,
    sources: [],
    superseded: [],
    totalActive: 0,
  }

  // Resolve artifact status -> source.status: artifact 'accepted' becomes
  // a context source 'accepted' (which retrieval boosts); 'draft' stays
  // 'draft'. For non-artifact sources we use the default 'active'.
  const upsertOne = async (s: CompiledSource) => {
    const status: 'active' | 'draft' | 'accepted' = s.sourceType === 'manuscript_artifact'
      ? ((s.metadata?.status === 'accepted') ? 'accepted' : 'draft')
      : 'active'
    // Salting the hash with a per-run nonce when `force` is true forces
    // every existing row to look stale, so the compiler rewrites and the
    // chunker/embedder downstream rebuild from scratch.
    const forceSalt = options.force ? `\nFORCE:${Date.now()}-${Math.random()}` : ''
    const hash = sha256(`${s.title}\n${s.body}${forceSalt}`)
    return manuscriptContextRepo.upsertSource({
      manuscriptId,
      userId: ownerId,
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      title: s.title,
      body: s.body,
      metadata: s.metadata,
      contextRole: s.contextRole,
      priority: s.priority ?? 0,
      status,
      canonical: s.canonical ?? false,
      includeInAi: s.includeInAi ?? true,
      contentHash: hash,
    })
  }

  // Track keepers so the supersede pass can find what's gone.
  const keepers: { sourceType: ContextSourceType; sourceId: string | null }[] = []

  for (const s of planned) {
    const { source, action } = await upsertOne(s)
    keepers.push({ sourceType: s.sourceType, sourceId: s.sourceId })
    result.sources.push({
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      sourceRowId: source.id,
      action,
    })
  }

  // Anything not in keepers transitions to 'superseded'. Skip this when
  // the caller scoped the run to specific source types — they're not
  // claiming completeness across all types.
  if (!filterTypes) {
    const superseded = await manuscriptContextRepo.markStaleAsSuperseded(manuscriptId, keepers)
    result.superseded = superseded
  }

  result.totalActive = result.sources.length
  logger.info('[rag.compile] done', {
    manuscriptId,
    totalActive: result.totalActive,
    superseded: result.superseded.length,
  })
  return result
}
