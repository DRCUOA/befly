import pg from 'pg'
import { config } from './env.js'

const { Pool } = pg

// Lazy initialization - pool is created when initDb() is called
// This ensures dotenv has loaded before reading config.databaseUrl
let _pool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: config.databaseUrl
    })
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
    const result = await pool.query('SELECT NOW()')
    console.log('Database connected:', result.rows[0].now)
  } catch (error) {
    console.error('Database connection error:', error)
    throw error
  }
}

export async function closeDb() {
  await pool.end()
}
