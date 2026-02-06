export interface Comment {
  id: string
  writingId: string
  userId: string
  userDisplayName?: string // Display name of the user who commented
  content: string
  createdAt: string
  updatedAt: string
}

export interface CreateCommentRequest {
  content: string
}
