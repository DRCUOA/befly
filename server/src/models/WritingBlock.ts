export interface WritingBlock {
  id: string
  userId: string
  title: string
  body: string
  createdAt: Date
  updatedAt?: Date
}

export interface WritingBlockWithThemes extends WritingBlock {
  themeIds: string[]
}
