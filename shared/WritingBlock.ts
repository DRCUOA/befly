export interface WritingBlock {
  id: string
  userId: string
  title: string
  body: string
  themeIds: string[]
  visibility: 'private' | 'shared' | 'public'
  createdAt: string
  updatedAt?: string
}
