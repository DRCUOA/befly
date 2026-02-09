import pg from 'pg'
import { config } from './env.js'

const { Pool } = pg

// Lazy initialization - pool is created when initDb() is called
// This ensures dotenv has loaded before reading config.databaseUrl
let _pool: pg.Pool | null = null

function buildPoolConfig(): pg.PoolConfig {
  const connectionString = config.databaseUrl

  // pg can override `ssl` object settings when ssl query params are present
  // in DATABASE_URL, so strip them and control SSL explicitly in code.
  const url = new URL(connectionString)
  url.searchParams.delete('sslmode')
  url.searchParams.delete('sslrootcert')
  url.searchParams.delete('sslcert')
  url.searchParams.delete('sslkey')

  const isProduction = config.nodeEnv === 'production'

  return {
    connectionString: url.toString(),
    ssl: isProduction
      ? { rejectUnauthorized: false }
      : false
  }
}

function getPool(): pg.Pool {
  if (!_pool) {
    const poolConfig = buildPoolConfig()
    _pool = new Pool(poolConfig)
  }
  return _pool
}


// Export pool with lazy initialization
export const pool = {
  query: (...args: Parameters<pg.Pool['query']>) => getPool().query(...args),
  connect: (...args: Parameters<pg.Pool['connect']>) => getPool().connect(...args),
  end: (...args: Parameters<pg.Pool['end']>) => getPool().end(...args),
  get totalCount() { return getPool().totalCount },
  get idleCount() { return getPool().idleCount },
  get waitingCount() { return getPool().waitingCount }
} as pg.Pool

export async function initDb() {
  try {
    await pool.query('SELECT NOW()')
  } catch (error) {
    console.error('Database connection error:', error)
    throw error
  }
}

export async function closeDb() {
  if (_pool) {
    try {
      await _pool.end()
      _pool = null
    } catch (error) {
      console.error('Error closing database pool:', error)
      throw error
    }
  }
}
