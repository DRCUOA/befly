/**
 * Vitest setup: log each test (number, name, result) with ANSI colors
 */
import { afterEach } from 'vitest'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

let testNum = 0

afterEach(({ task, onTestFinished }) => {
  onTestFinished(() => {
    testNum += 1
    const name = task.name ?? 'unknown'
    const result = task.result?.state ?? 'unknown'
    const color = result === 'pass' ? GREEN : result === 'fail' ? RED : DIM
    const status = result === 'pass' ? 'pass' : result === 'fail' ? 'fail' : result
    process.stdout.write(`${color}[${testNum}] ${name} ${status}${RESET}\n`)
  })
})
