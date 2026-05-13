export interface WritingBlock {
  id: string
  userId: string
  title: string
  body: string
  themeIds: string[]
  visibility: 'private' | 'shared' | 'public'
  coverImageUrl?: string
  coverImagePosition?: string
  createdAt: string
  updatedAt?: string
  /**
   * Monotonic per-frag counter, bumped on every update. Clients send the
   * version they loaded as `expectedVersion` in update requests; mismatch
   * returns 409 so a co-editor's change is never silently overwritten.
   */
  currentVersion: number
  /**
   * Per-owner position in the frags list. 1..n where n is the owner's
   * total frag count. Edited via the move endpoint; updating it directly
   * is not supported because reorder must shift every other frag.
   */
  sortOrder: number
}
