// Lazy config getters to ensure dotenv has loaded
function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

export const config = {
  get nodeEnv() {
    return getEnv('NODE_ENV', 'development')
  },
  get port() {
    return parseInt(getEnv('PORT', '3005'), 10)
  },
  get databaseUrl() {
    return getEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/writing')
  },
  get corsOrigin() {
    return getEnv('CORS_ORIGIN', 'http://localhost:5178')
  },
  get appName() {
    return getEnv('APP_NAME', 'Rambulations')
  }
}
