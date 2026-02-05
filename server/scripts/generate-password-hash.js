import bcrypt from 'bcrypt'

const password = 'demo123'
const rounds = 12

bcrypt.hash(password, rounds)
  .then(hash => {
    console.log(`Password: ${password}`)
    console.log(`Hash: ${hash}`)
    console.log(`\nSQL INSERT statement:`)
    console.log(`password_hash = '${hash}'`)
    process.exit(0)
  })
  .catch(err => {
    console.error('Error generating hash:', err)
    process.exit(1)
  })
