/**
 * Throttle function to limit function calls to at most once per limit milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastRun = 0
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
    if (now - lastRun >= limit) {
      func.apply(this, args)
      lastRun = now
    }
  }
}
