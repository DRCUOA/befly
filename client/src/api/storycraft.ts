/**
 * Story-craft API client. Mirrors the server route shape under /api/storycraft.
 *
 * Read endpoints accept optional auth (visibility filtered server-side).
 * Write endpoints require auth + ownership.
 */
import { api } from './client'
import type { ApiResponse } from '@shared/ApiResponses'
import type {
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
  KnowledgeKind,
  CausalLinkType,
  VoiceBible,
} from '@shared/StoryCraft'

export const storyCraftApi = {
  /* ----- bundle ----- */
  getBundle: (manuscriptId: string) =>
    api
      .get<ApiResponse<StoryCraftBundle>>(`/storycraft/manuscripts/${manuscriptId}/bundle`)
      .then(r => r.data),

  /* ----- characters ----- */
  listCharacters: (manuscriptId: string) =>
    api
      .get<ApiResponse<Character[]>>(`/storycraft/manuscripts/${manuscriptId}/characters`)
      .then(r => r.data),

  createCharacter: (manuscriptId: string, input: Partial<Character>) =>
    api
      .post<ApiResponse<Character>>(`/storycraft/manuscripts/${manuscriptId}/characters`, input)
      .then(r => r.data),

  updateCharacter: (characterId: string, input: Partial<Character>) =>
    api.put<ApiResponse<Character>>(`/storycraft/characters/${characterId}`, input).then(r => r.data),

  deleteCharacter: (characterId: string) =>
    api.delete(`/storycraft/characters/${characterId}`),

  /* ----- misreadings ----- */
  createMisreading: (characterId: string, input: { label: string; why?: string | null }) =>
    api
      .post<ApiResponse<CharacterMisreading>>(`/storycraft/characters/${characterId}/misreadings`, input)
      .then(r => r.data),

  deleteMisreading: (misreadingId: string) =>
    api.delete(`/storycraft/misreadings/${misreadingId}`),

  /* ----- motifs ----- */
  createMotif: (manuscriptId: string, input: { name: string; function?: string | null }) =>
    api
      .post<ApiResponse<Motif>>(`/storycraft/manuscripts/${manuscriptId}/motifs`, input)
      .then(r => r.data),

  updateMotif: (motifId: string, input: Partial<Motif>) =>
    api.put<ApiResponse<Motif>>(`/storycraft/motifs/${motifId}`, input).then(r => r.data),

  deleteMotif: (motifId: string) => api.delete(`/storycraft/motifs/${motifId}`),

  setMotifVariant: (motifId: string, characterId: string, meaning: string | null) =>
    api
      .put<ApiResponse<MotifVoiceVariant>>(`/storycraft/motifs/${motifId}/variants`, {
        characterId,
        meaning,
      })
      .then(r => r.data),

  /* ----- beats ----- */
  listBeats: (manuscriptId: string) =>
    api.get<ApiResponse<Beat[]>>(`/storycraft/manuscripts/${manuscriptId}/beats`).then(r => r.data),

  createBeat: (manuscriptId: string, input: Partial<Beat>) =>
    api.post<ApiResponse<Beat>>(`/storycraft/manuscripts/${manuscriptId}/beats`, input).then(r => r.data),

  updateBeat: (beatId: string, input: Partial<Beat>) =>
    api.put<ApiResponse<Beat>>(`/storycraft/beats/${beatId}`, input).then(r => r.data),

  deleteBeat: (beatId: string) => api.delete(`/storycraft/beats/${beatId}`),

  reorderBeats: (manuscriptId: string, moves: { id: string; orderIndex: number }[]) =>
    api
      .put<ApiResponse<Beat[]>>(`/storycraft/manuscripts/${manuscriptId}/beats/reorder`, { moves })
      .then(r => r.data),

  /* ----- beat knowledge ----- */
  setBeatKnowledge: (
    beatId: string,
    input: { characterId: string | null; knowledgeKind: KnowledgeKind; text: string | null }
  ) =>
    api
      .put<ApiResponse<BeatKnowledge | null>>(`/storycraft/beats/${beatId}/knowledge`, input)
      .then(r => r.data),

  /* ----- beat motifs ----- */
  setBeatMotif: (beatId: string, motifId: string, variantNote: string | null) =>
    api
      .put<ApiResponse<BeatMotif>>(`/storycraft/beats/${beatId}/motifs`, { motifId, variantNote })
      .then(r => r.data),

  unsetBeatMotif: (beatId: string, motifId: string) =>
    api.delete(`/storycraft/beats/${beatId}/motifs/${motifId}`),

  /* ----- causal links ----- */
  createCausalLink: (
    manuscriptId: string,
    input: { fromBeatId: string; toBeatId: string; linkType: CausalLinkType; note?: string | null }
  ) =>
    api
      .post<ApiResponse<CausalLink>>(`/storycraft/manuscripts/${manuscriptId}/causal-links`, input)
      .then(r => r.data),

  deleteCausalLink: (linkId: string) =>
    api.delete(`/storycraft/causal-links/${linkId}`),

  /* ----- silences ----- */
  createSilence: (
    manuscriptId: string,
    input: {
      characterId?: string | null
      beatId?: string | null
      whatUnsaid: string
      why?: string | null
      consequence?: string | null
      silenceType?: string | null
    }
  ) =>
    api.post<ApiResponse<Silence>>(`/storycraft/manuscripts/${manuscriptId}/silences`, input).then(r => r.data),

  deleteSilence: (silenceId: string) => api.delete(`/storycraft/silences/${silenceId}`),

  /* ----- St Cormac's seed importer ----- */
  importStCormacsSeed: (manuscriptId: string) =>
    api
      .post<ApiResponse<{ characters: number; motifs: number; beats: number; causalLinks: number; skipped: { characters: number; motifs: number; beats: number } }>>(
        `/storycraft/manuscripts/${manuscriptId}/import/st-cormacs-seed`
      )
      .then(r => r.data),
}

// Re-export VoiceBible so component code can import from one place.
export type { VoiceBible }
