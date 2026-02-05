export interface Theme {
  id: string
  userId: string
  name: string
  slug: string
  visibility: 'private' | 'shared' | 'public'
  createdAt: string
}
