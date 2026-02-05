import bcrypt from 'bcrypt'
import pg from 'pg'
import { config } from '../config/env.js'

const { Pool } = pg

/**
 * Seed script that generates password hash at runtime
 * Run: npx tsx src/db/seed-with-hash.ts
 */
async function seed() {
  const pool = new Pool({
    connectionString: config.databaseUrl
  })

  try {
    const password = 'demo123'
    const passwordHash = await bcrypt.hash(password, 12)

    console.log('Seeding database...')
    console.log(`Password: ${password}`)
    console.log(`Generated hash: ${passwordHash}`)

    // Insert user
    await pool.query(
      `INSERT INTO users (id, email, password_hash, display_name, status) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name,
         status = EXCLUDED.status`,
      ['00000000-0000-0000-0000-000000000001', 'demo@example.com', passwordHash, 'Demo User', 'active']
    )

    // Insert themes
    // Note: SQL reuses $2 (user_id) and $5 (visibility), so we only need 11 parameters total
    await pool.query(
      `INSERT INTO themes (id, user_id, name, slug, visibility) VALUES
       ($1, $2, $3, $4, $5),
       ($6, $2, $7, $8, $5),
       ($9, $2, $10, $11, $5)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         visibility = EXCLUDED.visibility`,
      [
        '10000000-0000-0000-0000-000000000001', // $1: first theme id
        '00000000-0000-0000-0000-000000000001', // $2: user_id (reused for all themes)
        'Reflection',                            // $3: first theme name
        'reflection',                            // $4: first theme slug
        'shared',                                // $5: visibility (reused for all themes)
        '10000000-0000-0000-0000-000000000002', // $6: second theme id
        'Technology',                            // $7: second theme name
        'technology',                            // $8: second theme slug
        '10000000-0000-0000-0000-000000000003', // $9: third theme id
        'Philosophy',                            // $10: third theme name
        'philosophy'                             // $11: third theme slug
      ]
    )

    // Insert writing block
    await pool.query(
      `INSERT INTO writing_blocks (id, user_id, title, body, visibility) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         visibility = EXCLUDED.visibility`,
      ['20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Welcome', 'This is a sample writing block. Start writing!', 'shared']
    )

    // Link writing to theme
    await pool.query(
      `INSERT INTO writing_themes (writing_id, theme_id) 
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      ['20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001']
    )

    console.log('Seed data inserted successfully!')
  } catch (error) {
    console.error('Error seeding database:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seed()
