/**
 * RAG service barrel.
 *
 * Public API used by AI call sites and the CLI:
 *   compileManuscriptContext  — turn manuscript data into context sources
 *   chunkManuscriptContext    — split sources into chunks
 *   embedManuscriptContext    — embed chunks (idempotent)
 *   reindexManuscript         — compile + chunk + embed in one call
 *   retrieveManuscriptContext — manuscript-scoped semantic search
 *   buildPromptWithContext    — wrap a userRequest with the retrieved pack
 *
 * Repo helpers also re-exported so admin/CLI commands have one import.
 */

import { compileManuscriptContext } from './compile-context.service.js'
import { chunkManuscriptContext } from './chunker.js'
import { embedManuscriptContext } from './embed.service.js'
import { manuscriptContextRepo } from '../../repositories/manuscript-context.repo.js'

export { compileManuscriptContext } from './compile-context.service.js'
export { chunkManuscriptContext, chunkContextSource, chunkText } from './chunker.js'
export {
  embedManuscriptContext,
  setEmbeddingClientForTests,
  getEmbeddingClient,
  resetEmbeddingClientCache,
  type EmbeddingClient,
} from './embed.service.js'
export {
  retrieveManuscriptContext,
  buildPromptWithContext,
} from './retrieve.service.js'

export const listManuscriptContextSources = (manuscriptId: string) =>
  manuscriptContextRepo.listSources(manuscriptId)

export const listContextChunks = (manuscriptId: string) =>
  manuscriptContextRepo.listChunks(manuscriptId)

export const deleteManuscriptContextSource = (contextSourceId: string) =>
  manuscriptContextRepo.deleteSource(contextSourceId)

export const manuscriptContextStats = (manuscriptId: string) =>
  manuscriptContextRepo.stats(manuscriptId)

/**
 * Compile + chunk + embed in one pass. Idempotent at every stage:
 * unchanged sources are skipped at the compile step, unchanged chunks
 * are skipped at the chunk step, already-embedded chunks are skipped at
 * the embed step.
 *
 * Pass `force: true` to bypass the compile-stage hash short-circuit
 * (which forces chunks and embeddings to rebuild downstream too).
 */
export async function reindexManuscript(
  manuscriptId: string,
  options: { force?: boolean } = {}
): Promise<{
  manuscriptId: string
  compile: Awaited<ReturnType<typeof compileManuscriptContext>>
  chunk: Awaited<ReturnType<typeof chunkManuscriptContext>>
  embed: Awaited<ReturnType<typeof embedManuscriptContext>>
}> {
  const compile = await compileManuscriptContext(manuscriptId, { force: options.force })
  const chunk = await chunkManuscriptContext(manuscriptId)
  const embed = await embedManuscriptContext(manuscriptId)
  return { manuscriptId, compile, chunk, embed }
}
