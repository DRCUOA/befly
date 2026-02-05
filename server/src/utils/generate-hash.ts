import bcrypt from 'bcrypt'

/**
 * Utility to generate bcrypt hash for seed data
 * Run: npx tsx src/utils/generate-hash.ts
 */
async function generateHash() {
  const password = 'demo123'
  const hash = await bcrypt.hash(password, 12)
  console.log('Password:', password)
  console.log('Hash:', hash)
  console.log('\nUse this hash in seed.sql:')
  console.log(`'${hash}'`)
}

generateHash().catch(console.error)
