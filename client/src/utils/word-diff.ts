/**
 * Word-level diff for prose. Splits both strings on whitespace boundaries
 * (keeping the whitespace tokens so rendering preserves spacing), trims
 * common prefix/suffix to limit the DP work, then runs an LCS table over
 * the middle. Returns a flat run of segments suitable for rendering.
 *
 * For essay-sized inputs (≤ ~3k words) this is fast enough to run on
 * every preview open without async work.
 */

export type DiffSegmentType = 'eq' | 'ins' | 'del'

export interface DiffSegment {
  type: DiffSegmentType
  text: string
}

export function wordDiff(a: string, b: string): DiffSegment[] {
  const at = tokenize(a)
  const bt = tokenize(b)

  // Strip common prefix and suffix to shrink the LCS problem.
  let pre = 0
  while (pre < at.length && pre < bt.length && at[pre] === bt[pre]) pre++
  let suf = 0
  while (
    suf < at.length - pre &&
    suf < bt.length - pre &&
    at[at.length - 1 - suf] === bt[bt.length - 1 - suf]
  ) suf++

  const aMid = at.slice(pre, at.length - suf)
  const bMid = bt.slice(pre, bt.length - suf)

  const segs: DiffSegment[] = []
  if (pre > 0) segs.push({ type: 'eq', text: at.slice(0, pre).join('') })
  if (aMid.length || bMid.length) segs.push(...lcsDiff(aMid, bMid))
  if (suf > 0) segs.push({ type: 'eq', text: at.slice(at.length - suf).join('') })

  return mergeSegments(segs)
}

function tokenize(s: string): string[] {
  // Split on whitespace runs but keep the runs as their own tokens so
  // the reassembled text preserves the original spacing.
  return s.split(/(\s+)/).filter(t => t.length > 0)
}

function lcsDiff(a: string[], b: string[]): DiffSegment[] {
  const n = a.length
  const m = b.length
  if (n === 0 && m === 0) return []
  if (n === 0) return [{ type: 'ins', text: b.join('') }]
  if (m === 0) return [{ type: 'del', text: a.join('') }]

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const out: DiffSegment[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.unshift({ type: 'eq', text: a[i - 1] })
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.unshift({ type: 'del', text: a[i - 1] })
      i--
    } else {
      out.unshift({ type: 'ins', text: b[j - 1] })
      j--
    }
  }
  while (i > 0) {
    out.unshift({ type: 'del', text: a[i - 1] })
    i--
  }
  while (j > 0) {
    out.unshift({ type: 'ins', text: b[j - 1] })
    j--
  }
  return out
}

function mergeSegments(segs: DiffSegment[]): DiffSegment[] {
  const merged: DiffSegment[] = []
  for (const s of segs) {
    if (!s.text) continue
    const last = merged[merged.length - 1]
    if (last && last.type === s.type) last.text += s.text
    else merged.push({ type: s.type, text: s.text })
  }
  return merged
}
