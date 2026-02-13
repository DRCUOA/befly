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
}
