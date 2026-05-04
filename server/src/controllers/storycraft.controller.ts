import { Request, Response } from 'express'
import { storyCraftService } from '../services/storycraft.service.js'
import { storyCraftSeedService } from '../services/storycraft-seed.service.js'
import { UnauthorizedError } from '../utils/errors.js'
import { isAdminRequest } from '../middleware/authorize.middleware.js'
import { activityService } from '../services/activity.service.js'
import { getClientIp, getUserAgent } from '../utils/activity-logger.js'

/**
 * Story-craft controller — handles HTTP requests for the Character Studio,
 * Polyphonic Map, and Plot Causality views. Mirrors the manuscript controller
 * pattern: thin shells that delegate to the service.
 */
export const storyCraftController = {
  /* ----- bundle ----- */

  async getBundle(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null
    const admin = isAdminRequest(req)
    const bundle = await storyCraftService.getBundle(id, userId, admin)
    res.json({ data: bundle })
  },

  /* ----- characters ----- */

  async listCharacters(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null
    const admin = isAdminRequest(req)
    const characters = await storyCraftService.listCharacters(id, userId, admin)
    res.json({ data: characters })
  },

  async createCharacter(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const character = await storyCraftService.createCharacter(id, userId, req.body, isAdminRequest(req))
    await activityService.logManuscript('character_create', id, userId, getClientIp(req), getUserAgent(req), {
      characterId: character.id,
      name: character.name,
    })
    res.status(201).json({ data: character })
  },

  async updateCharacter(req: Request, res: Response) {
    const { characterId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const character = await storyCraftService.updateCharacter(characterId, userId, req.body, isAdminRequest(req))
    await activityService.logManuscript('character_update', character.manuscriptId, userId, getClientIp(req), getUserAgent(req), { characterId })
    res.json({ data: character })
  },

  async deleteCharacter(req: Request, res: Response) {
    const { characterId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    await storyCraftService.deleteCharacter(characterId, userId, isAdminRequest(req))
    res.status(204).send()
  },

  /* ----- misreadings ----- */

  async createMisreading(req: Request, res: Response) {
    const { characterId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const created = await storyCraftService.createMisreading(characterId, userId, req.body, isAdminRequest(req))
    res.status(201).json({ data: created })
  },

  async deleteMisreading(req: Request, res: Response) {
    const { misreadingId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    await storyCraftService.deleteMisreading(misreadingId, userId, isAdminRequest(req))
    res.status(204).send()
  },

  /* ----- motifs ----- */

  async createMotif(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const motif = await storyCraftService.createMotif(id, userId, req.body, isAdminRequest(req))
    res.status(201).json({ data: motif })
  },

  async updateMotif(req: Request, res: Response) {
    const { motifId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const motif = await storyCraftService.updateMotif(motifId, userId, req.body, isAdminRequest(req))
    res.json({ data: motif })
  },

  async deleteMotif(req: Request, res: Response) {
    const { motifId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    await storyCraftService.deleteMotif(motifId, userId, isAdminRequest(req))
    res.status(204).send()
  },

  async setMotifVariant(req: Request, res: Response) {
    const { motifId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const variant = await storyCraftService.setMotifVariant(motifId, userId, req.body, isAdminRequest(req))
    res.json({ data: variant })
  },

  /* ----- beats ----- */

  async listBeats(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId || null
    const admin = isAdminRequest(req)
    const beats = await storyCraftService.listBeats(id, userId, admin)
    res.json({ data: beats })
  },

  async createBeat(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const beat = await storyCraftService.createBeat(id, userId, req.body, isAdminRequest(req))
    await activityService.logManuscript('beat_create', id, userId, getClientIp(req), getUserAgent(req), { beatId: beat.id })
    res.status(201).json({ data: beat })
  },

  async updateBeat(req: Request, res: Response) {
    const { beatId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const beat = await storyCraftService.updateBeat(beatId, userId, req.body, isAdminRequest(req))
    res.json({ data: beat })
  },

  async deleteBeat(req: Request, res: Response) {
    const { beatId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    await storyCraftService.deleteBeat(beatId, userId, isAdminRequest(req))
    res.status(204).send()
  },

  async reorderBeats(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const moves = (req.body && (req.body.moves ?? req.body)) as unknown
    const beats = await storyCraftService.reorderBeats(id, userId, moves, isAdminRequest(req))
    res.json({ data: beats })
  },

  /* ----- beat knowledge ----- */

  async setBeatKnowledge(req: Request, res: Response) {
    const { beatId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const result = await storyCraftService.setBeatKnowledge(beatId, userId, req.body, isAdminRequest(req))
    res.json({ data: result })
  },

  /* ----- beat motifs ----- */

  async setBeatMotif(req: Request, res: Response) {
    const { beatId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const result = await storyCraftService.setBeatMotif(beatId, userId, req.body, isAdminRequest(req))
    res.json({ data: result })
  },

  async unsetBeatMotif(req: Request, res: Response) {
    const { beatId, motifId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    await storyCraftService.unsetBeatMotif(beatId, motifId, userId, isAdminRequest(req))
    res.status(204).send()
  },

  /* ----- causal links ----- */

  async createCausalLink(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const link = await storyCraftService.createCausalLink(id, userId, req.body, isAdminRequest(req))
    res.status(201).json({ data: link })
  },

  async deleteCausalLink(req: Request, res: Response) {
    const { linkId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    await storyCraftService.deleteCausalLink(linkId, userId, isAdminRequest(req))
    res.status(204).send()
  },

  /* ----- silences ----- */

  async createSilence(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const silence = await storyCraftService.createSilence(id, userId, req.body, isAdminRequest(req))
    res.status(201).json({ data: silence })
  },

  async deleteSilence(req: Request, res: Response) {
    const { silenceId } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    await storyCraftService.deleteSilence(silenceId, userId, isAdminRequest(req))
    res.status(204).send()
  },

  /* ----- St Cormac's seed importer (Phase 4) ----- */

  async importStCormacSeed(req: Request, res: Response) {
    const { id } = req.params
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')
    const result = await storyCraftSeedService.importStCormacs(id, userId, isAdminRequest(req))
    await activityService.logManuscript('storycraft_seed_import', id, userId, getClientIp(req), getUserAgent(req), {
      characters: result.characters,
      beats: result.beats,
      motifs: result.motifs,
    })
    res.json({ data: result })
  },
}
