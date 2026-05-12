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
}
