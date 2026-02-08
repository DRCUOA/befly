<template>
  <div class="comment-section">
    <div class="mb-6 sm:mb-8">
      <h2 class="text-xl sm:text-2xl font-light tracking-tight mb-3 sm:mb-4">Comments</h2>
      <p class="text-xs sm:text-sm font-light text-ink-lighter">
        {{ isAuthenticated ? 'Share your thoughts' : 'Sign in to comment' }}
      </p>
    </div>

    <!-- Comment Form (authenticated users only) -->
    <div v-if="isAuthenticated" class="mb-8 sm:mb-12">
      <form @submit.prevent="handleSubmit" class="space-y-3 sm:space-y-4">
        <textarea
          v-model="newCommentContent"
          :disabled="submitting"
          placeholder="Write your comment..."
          rows="4"
          class="w-full px-3 sm:px-4 py-2 sm:py-3 border border-line bg-paper text-ink rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-[#717171] focus:border-[#717171] disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          maxlength="5000"
        ></textarea>
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <span class="text-xs text-ink-lighter">{{ newCommentContent.length }} / 5000</span>
          <button
            type="submit"
            :disabled="submitting || !newCommentContent.trim()"
            class="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm border border-line bg-paper hover:bg-[#E5E5E5] disabled:opacity-50 disabled:cursor-not-allowed text-[#717171]"
          >
            {{ submitting ? 'Posting...' : 'Post Comment' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Sign in prompt (non-authenticated users) -->
    <div v-else class="mb-8 sm:mb-12 text-xs sm:text-sm text-ink-lighter">
      <router-link to="/signin" class="hover:text-ink">Sign in</router-link> to join the conversation
    </div>

    <!-- Comments List -->
    <div v-if="loading" class="text-center py-6 sm:py-8">
      <p class="text-xs sm:text-sm text-ink-lighter">Loading comments...</p>
    </div>

    <div v-else-if="comments.length === 0" class="text-center py-6 sm:py-8">
      <p class="text-xs sm:text-sm text-ink-lighter">No comments yet. Be the first to share your thoughts.</p>
    </div>

    <div v-else class="space-y-6 sm:space-y-8">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="comment-item border-b border-line pb-6 sm:pb-8 last:border-b-0"
      >
        <div class="flex items-start justify-between mb-3 gap-3">
          <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#D3D3D3] flex items-center justify-center text-xs font-medium text-[#717171] flex-shrink-0">
              {{ getInitials(comment.userDisplayName || '?') }}
            </div>
            <div class="min-w-0">
              <p class="text-xs sm:text-sm font-medium text-ink truncate">{{ comment.userDisplayName || 'Anonymous' }}</p>
              <p class="text-xs text-ink-lighter">{{ formatDate(comment.createdAt) }}</p>
            </div>
          </div>
          
          <!-- Edit/Delete buttons (own comments only) -->
          <div v-if="isAuthenticated && user?.id === comment.userId" class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              v-if="editingCommentId !== comment.id"
              @click="startEdit(comment)"
              class="text-xs text-ink-lighter hover:text-ink"
            >
              Edit
            </button>
            <button
              v-if="editingCommentId !== comment.id"
              @click="handleDelete(comment.id)"
              :disabled="deletingCommentId === comment.id"
              class="text-xs text-ink-lighter hover:text-ink disabled:opacity-50"
            >
              {{ deletingCommentId === comment.id ? 'Deleting...' : 'Delete' }}
            </button>
            <button
              v-if="editingCommentId === comment.id"
              @click="cancelEdit"
              class="text-xs text-ink-lighter hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- Comment Content -->
        <div v-if="editingCommentId !== comment.id" class="text-sm sm:text-base text-ink leading-relaxed whitespace-pre-wrap break-words">
          {{ comment.content }}
        </div>

        <!-- Edit Form -->
        <form v-else @submit.prevent="handleUpdate(comment.id)" class="space-y-3">
          <textarea
            v-model="editingContent"
            :disabled="updating"
            rows="4"
            class="w-full px-3 sm:px-4 py-2 sm:py-3 border border-line bg-paper text-ink rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-[#717171] focus:border-[#717171] disabled:opacity-50 text-sm sm:text-base"
            maxlength="5000"
          ></textarea>
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <span class="text-xs text-ink-lighter">{{ editingContent.length }} / 5000</span>
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                @click="cancelEdit"
                class="flex-1 sm:flex-none px-3 py-1 text-xs border border-line bg-paper hover:bg-[#E5E5E5] text-[#717171]"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="updating || !editingContent.trim()"
                class="flex-1 sm:flex-none px-3 py-1 text-xs border border-line bg-paper hover:bg-[#E5E5E5] disabled:opacity-50 disabled:cursor-not-allowed text-[#717171]"
              >
                {{ updating ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../../api/client'
import { useAuth } from '../../stores/auth'
import type { Comment } from '../../domain/Comment'
import type { ApiResponse } from '@shared/ApiResponses'

interface Props {
  writingId: string
}

const props = defineProps<Props>()
const { user, isAuthenticated } = useAuth()

const comments = ref<Comment[]>([])
const loading = ref(false)
const submitting = ref(false)
const updating = ref(false)
const newCommentContent = ref('')
const editingCommentId = ref<string | null>(null)
const editingContent = ref('')
const deletingCommentId = ref<string | null>(null)

const emit = defineEmits<{
  commentAdded: []
  commentUpdated: []
  commentDeleted: []
}>()

const loadComments = async () => {
  try {
    loading.value = true
    const response = await api.get<ApiResponse<Comment[]>>(`/comments/writing/${props.writingId}`)
    comments.value = response.data
  } catch (err) {
    console.error('Failed to load comments:', err)
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  if (!newCommentContent.value.trim() || submitting.value) return

  try {
    submitting.value = true
    await api.post<ApiResponse<Comment>>(`/comments/writing/${props.writingId}`, {
      content: newCommentContent.value.trim()
    })
    
    newCommentContent.value = ''
    await loadComments()
    emit('commentAdded')
  } catch (err) {
    console.error('Failed to post comment:', err)
    alert(err instanceof Error ? err.message : 'Failed to post comment')
  } finally {
    submitting.value = false
  }
}

const startEdit = (comment: Comment) => {
  editingCommentId.value = comment.id
  editingContent.value = comment.content
}

const cancelEdit = () => {
  editingCommentId.value = null
  editingContent.value = ''
}

const handleUpdate = async (commentId: string) => {
  if (!editingContent.value.trim() || updating.value) return

  try {
    updating.value = true
    await api.put<ApiResponse<Comment>>(`/comments/${commentId}`, {
      content: editingContent.value.trim()
    })
    
    editingCommentId.value = null
    editingContent.value = ''
    await loadComments()
    emit('commentUpdated')
  } catch (err) {
    console.error('Failed to update comment:', err)
    alert(err instanceof Error ? err.message : 'Failed to update comment')
  } finally {
    updating.value = false
  }
}

const handleDelete = async (commentId: string) => {
  if (!confirm('Are you sure you want to delete this comment?')) return

  try {
    deletingCommentId.value = commentId
    await api.delete(`/comments/${commentId}`)
    
    await loadComments()
    emit('commentDeleted')
  } catch (err) {
    console.error('Failed to delete comment:', err)
    alert(err instanceof Error ? err.message : 'Failed to delete comment')
  } finally {
    deletingCommentId.value = null
  }
}

const getInitials = (name: string): string => {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

onMounted(() => {
  loadComments()
})
</script>

<style scoped>
.comment-section {
  @apply w-full;
}
</style>
