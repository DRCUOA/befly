export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry'

export interface Appreciation {
  id: string
  writingId: string
  userId: string
  userDisplayName?: string // Display name of the user who appreciated
  reactionType: ReactionType // Type of reaction/emotion
  createdAt: string
}

export interface ReactionCount {
  type: ReactionType
  count: number
}

export interface WritingReactionSummary {
  writingId: string
  total: number
  reactions: ReactionCount[]
}
