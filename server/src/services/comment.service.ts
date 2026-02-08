import { commentRepo } from '../repositories/comment.repo.js'
import { Comment } from '../models/Comment.js'

/**
 * Comment service - business logic layer
 */
export const commentService = {
  async getByWritingId(writingId: string): Promise<Comment[]> {
    return commentRepo.findByWritingId(writingId)
  },

  async create(writingId: string, userId: string, content: string): Promise<Comment> {
    // Validate content
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      throw new Error('Comment content cannot be empty')
    }
    if (trimmedContent.length > 5000) {
      throw new Error('Comment content cannot exceed 5000 characters')
    }
    
    return commentRepo.create({ writingId, userId, content: trimmedContent })
  },

  async update(commentId: string, userId: string, content: string): Promise<Comment> {
    // Validate content
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      throw new Error('Comment content cannot be empty')
    }
    if (trimmedContent.length > 5000) {
      throw new Error('Comment content cannot exceed 5000 characters')
    }
    
    return commentRepo.update(commentId, userId, trimmedContent)
  },

  async getById(commentId: string): Promise<Comment> {
    const comment = await commentRepo.findById(commentId)
    if (!comment) {
      throw new Error('Comment not found')
    }
    return comment
  },

  async remove(commentId: string, userId: string): Promise<void> {
    return commentRepo.delete(commentId, userId)
  }
}
