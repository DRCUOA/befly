/**
 * RAG admin CLI.
 *
 * Run with `npx tsx server/scripts/rag-cli.ts <command> [args...]`, or via
 * the npm scripts in server/package.json:
 *   npm run rag:compile    -- --manuscript <id>
 *   npm run rag:chunk      -- --manuscript <id>
 *   npm run rag:embed      -- --manuscript <id>
 *   npm run rag:reindex    -- --manuscript <id> [--force]
 *   npm run rag:search     -- --manuscript <id> --query "voice guide for Marcus"
 *   npm run rag:stats      -- --manuscript <id>
 *   npm run rag:list       -- --manuscript <id>
 *
 * The CLI is deliberately thin — it wires argv to the same service
 * functions the AI assist code uses, so a CLI run and a server-side
 * trigger produce identical state.
 */
import '../src/config/env-loader.js'

import { closeDb } from '../src/config/db.js'
import {
  compileManuscriptContext,
  chunkManuscriptContext,
  embedManuscriptContext,
  reindexManuscript,
  retrieveManuscriptContext,
  manuscriptContextStats,
  listManuscriptContextSources,
} from '../src/services/rag/index.js'

interface ParsedArgs {
  manuscript?: string
  query?: string
  force?: boolean
  topK?: number
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--manuscript' || a === '-m') out.manuscript = argv[++i]
    else if (a === '--query' || a === '-q') out.query = argv[++i]
    else if (a === '--force') out.force = true
    else if (a === '--topK' || a === '-k') out.topK = parseInt(argv[++i], 10)
  }
  return out
}

function requireManuscript(args: ParsedArgs): string {
  if (!args.manuscript) {
    throw new Error('--manuscript <id> is required')
  }
  return args.manuscript
}

async function main() {
  const [, , cmd = 'help', ...rest] = process.argv
  const args = parseArgs(rest)

  switch (cmd) {
    case 'compile': {
      const id = requireManuscript(args)
      const r = await compileManuscriptContext(id, { force: args.force })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'chunk': {
      const id = requireManuscript(args)
      const r = await chunkManuscriptContext(id)
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'embed': {
      const id = requireManuscript(args)
      const r = await embedManuscriptContext(id)
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'reindex': {
      const id = requireManuscript(args)
      const r = await reindexManuscript(id, { force: args.force })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'search': {
      const id = requireManuscript(args)
      if (!args.query) throw new Error('--query "..." is required for search')
      const r = await retrieveManuscriptContext(id, args.query, { topK: args.topK ?? 8 })
      // Pretty-print with the contextPack last so the headline (chunks)
      // is easy to scan in a terminal.
      console.log(JSON.stringify({
        query: r.query,
        chunkCount: r.chunks.length,
        chunks: r.chunks.map(c => ({
          score: c.score.toFixed(3),
          title: c.title,
          sourceType: c.sourceType,
          contextRole: c.contextRole,
          excerpt: c.text.slice(0, 200),
        })),
      }, null, 2))
      console.log('\n---\nContext pack:\n')
      console.log(r.contextPack)
      break
    }
    case 'stats': {
      const id = requireManuscript(args)
      const r = await manuscriptContextStats(id)
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'list': {
      const id = requireManuscript(args)
      const r = await listManuscriptContextSources(id)
      console.log(JSON.stringify(r.map(s => ({
        id: s.id,
        sourceType: s.sourceType,
        sourceId: s.sourceId,
        title: s.title,
        contextRole: s.contextRole,
        status: s.status,
        canonical: s.canonical,
        priority: s.priority,
        bodyChars: s.body?.length ?? 0,
      })), null, 2))
      break
    }
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(`
rag-cli — manuscript-scoped RAG admin commands

Usage:
  npx tsx server/scripts/rag-cli.ts <command> --manuscript <id> [...]

Commands:
  compile   Compile manuscript data into manuscript_context_sources.
  chunk     Split context sources into chunks. Skips unchanged sources.
  embed     Embed unembedded chunks via the configured EMBEDDING_MODEL.
  reindex   compile + chunk + embed in one pass.
  search    Manuscript-scoped semantic search. Requires --query.
  stats     Show source/chunk/embedding counts for a manuscript.
  list      List context sources for a manuscript (no chunks).

Flags:
  --manuscript, -m  UUID of the manuscript (required for every command)
  --query, -q       Search query (search only)
  --topK, -k        Top-K chunks (search only)
  --force           Force re-compile / re-embed even if hashes match
`)
      break
    default:
      throw new Error(`Unknown command: ${cmd}. Run with --help.`)
  }
}

main()
  .then(() => closeDb().then(() => process.exit(0)))
  .catch(async err => {
    console.error('rag-cli error:', err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) console.error(err.stack)
    try { await closeDb() } catch { /* ignore */ }
    process.exit(1)
  })
