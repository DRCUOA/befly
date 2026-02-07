import pg from 'pg'
import { config } from './env.js'

const { Pool } = pg

// Lazy initialization - pool is created when initDb() is called
// This ensures dotenv has loaded before reading config.databaseUrl
let _pool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (!_pool) {
    const connectionConfig: pg.PoolConfig = {
      connectionString: config.databaseUrl
    }
    
    // Enable SSL for any non-localhost database (Heroku Postgres, AWS RDS, etc.)
    // Check if DATABASE_URL is NOT pointing to localhost
    const isLocalhost = config.databaseUrl.includes('localhost') || 
                        config.databaseUrl.includes('127.0.0.1') ||
                        config.databaseUrl.includes('::1')
    
    // Always enable SSL in production OR for remote databases
    if (config.nodeEnv === 'production' || !isLocalhost) {
      connectionConfig.ssl = {
        rejectUnauthorized: false // Heroku and most cloud providers use self-signed certificates
      }
    }
    
    _pool = new Pool(connectionConfig)
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
  if (_pool) {
    try {
      await _pool.end()
      _pool = null
      console.log('Database pool closed')
    } catch (error) {
      console.error('Error closing database pool:', error)
      throw error
    }
  }
}
