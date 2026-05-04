import { Router } from 'express'
import { storyCraftController } from '../controllers/storycraft.controller.js'
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

/**
 * Story-craft routes.
 *
 * Mounted at `/api/storycraft`. Naming convention:
 *   - Read endpoints accept optional auth (so visibility filtering applies).
 *   - Write endpoints require auth and ownership.
 *
 * Manuscript-scoped reads use `/manuscripts/:id/...` so the URL clearly states
 * which manuscript the data belongs to. Mutations on individual rows that have
 * unique IDs (characters, beats, etc.) skip the manuscript prefix because the
 * service resolves the parent manuscript from the row itself.
 */
const router = Router()

/* ----- bundle (one shot for the views) ----- */
router.get('/manuscripts/:id/bundle', optionalAuthMiddleware, asyncHandler(storyCraftController.getBundle))

/* ----- characters ----- */
router.get('/manuscripts/:id/characters', optionalAuthMiddleware, asyncHandler(storyCraftController.listCharacters))
router.post('/manuscripts/:id/characters', authMiddleware, asyncHandler(storyCraftController.createCharacter))
router.put('/characters/:characterId', authMiddleware, asyncHandler(storyCraftController.updateCharacter))
router.delete('/characters/:characterId', authMiddleware, asyncHandler(storyCraftController.deleteCharacter))

/* ----- misreadings (nested under character) ----- */
router.post('/characters/:characterId/misreadings', authMiddleware, asyncHandler(storyCraftController.createMisreading))
router.delete('/misreadings/:misreadingId', authMiddleware, asyncHandler(storyCraftController.deleteMisreading))

/* ----- motifs ----- */
router.post('/manuscripts/:id/motifs', authMiddleware, asyncHandler(storyCraftController.createMotif))
router.put('/motifs/:motifId', authMiddleware, asyncHandler(storyCraftController.updateMotif))
router.delete('/motifs/:motifId', authMiddleware, asyncHandler(storyCraftController.deleteMotif))
router.put('/motifs/:motifId/variants', authMiddleware, asyncHandler(storyCraftController.setMotifVariant))

/* ----- beats ----- */
router.get('/manuscripts/:id/beats', optionalAuthMiddleware, asyncHandler(storyCraftController.listBeats))
router.post('/manuscripts/:id/beats', authMiddleware, asyncHandler(storyCraftController.createBeat))
router.put('/manuscripts/:id/beats/reorder', authMiddleware, asyncHandler(storyCraftController.reorderBeats))
router.put('/beats/:beatId', authMiddleware, asyncHandler(storyCraftController.updateBeat))
router.delete('/beats/:beatId', authMiddleware, asyncHandler(storyCraftController.deleteBeat))

/* ----- beat knowledge ----- */
router.put('/beats/:beatId/knowledge', authMiddleware, asyncHandler(storyCraftController.setBeatKnowledge))

/* ----- beat motifs ----- */
router.put('/beats/:beatId/motifs', authMiddleware, asyncHandler(storyCraftController.setBeatMotif))
router.delete('/beats/:beatId/motifs/:motifId', authMiddleware, asyncHandler(storyCraftController.unsetBeatMotif))

/* ----- causal links ----- */
router.post('/manuscripts/:id/causal-links', authMiddleware, asyncHandler(storyCraftController.createCausalLink))
router.delete('/causal-links/:linkId', authMiddleware, asyncHandler(storyCraftController.deleteCausalLink))

/* ----- silences ----- */
router.post('/manuscripts/:id/silences', authMiddleware, asyncHandler(storyCraftController.createSilence))
router.delete('/silences/:silenceId', authMiddleware, asyncHandler(storyCraftController.deleteSilence))

/* ----- St Cormac's seed importer ----- */
router.post('/manuscripts/:id/import/st-cormacs-seed', authMiddleware, asyncHandler(storyCraftController.importStCormacSeed))

export default router
