<template>
  <div class="reactions-container">
    <!-- Reaction groups with avatars (Teams-style) -->
    <div class="flex items-center space-x-2 flex-wrap">
      <div
        v-for="group in reactionGroups"
        :key="group.type"
        class="flex items-center space-x-1"
      >
        <!-- Reaction emoji button with picker -->
        <div class="relative inline-block">
          <button
            @click.stop="showPickerForType(group.type)"
            :disabled="loading"
            class="inline-flex items-center px-2 py-1 rounded-md text-sm border border-gray-200 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
            :class="{ 'bg-blue-50 border-blue-300': userReaction === group.type }"
          >
            <span class="text-base">{{ getReactionEmoji(group.type) }}</span>
            <span class="ml-1 text-xs text-gray-600">{{ group.count }}</span>
          </button>

          <!-- Reaction picker dropdown for this type -->
          <div
            v-if="showPicker && pickerType === group.type"
            class="reaction-picker absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50"
            @click.stop
          >
            <div class="flex space-x-1">
              <button
                v-for="reaction in reactions"
                :key="reaction.type"
                @click="handleReactionClick(reaction.type)"
                class="p-2 rounded hover:bg-gray-100 transition-colors text-xl"
                :class="{ 'bg-blue-50': userReaction === reaction.type }"
                :title="reaction.label"
              >
                {{ reaction.emoji }}
              </button>
            </div>
          </div>
        </div>

        <!-- Avatars for this reaction type -->
        <div class="flex items-center -space-x-2">
          <div
            v-for="(appreciator, index) in group.users.slice(0, 3)"
            :key="appreciator.userId"
            :title="appreciator.userDisplayName || 'Unknown'"
            class="relative inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-white text-white text-xs font-medium hover:z-10 transition-transform hover:scale-110"
            :class="getReactionColor(group.type)"
            :style="{ zIndex: group.users.length - index }"
          >
            {{ getInitials(appreciator.userDisplayName || '?') }}
          </div>
          <div
            v-if="group.users.length > 3"
            class="relative inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-white bg-gray-400 text-white text-xs font-medium hover:z-10"
            :title="`${group.users.length - 3} more`"
            :style="{ zIndex: 0 }"
          >
            +{{ group.users.length - 3 }}
          </div>
        </div>
      </div>
    </div>

    <!-- Add reaction button (when no reactions exist) -->
    <div v-if="reactionGroups.length === 0" class="relative inline-block">
      <button
        @click.stop="showPicker = !showPicker"
        :disabled="loading"
        class="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 bg-white hover:bg-gray-50"
      >
        <span v-if="loading">...</span>
        <span v-else class="text-lg">👍</span>
        <span v-if="totalCount > 0" class="ml-1 text-xs">{{ totalCount }}</span>
      </button>

      <!-- Reaction picker dropdown -->
      <div
        v-if="showPicker"
        class="reaction-picker absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50"
        @click.stop
      >
        <div class="flex space-x-1">
          <button
            v-for="reaction in reactions"
            :key="reaction.type"
            @click="handleReactionClick(reaction.type)"
            class="p-2 rounded hover:bg-gray-100 transition-colors text-xl"
            :class="{ 'bg-blue-50': userReaction === reaction.type }"
            :title="reaction.label"
          >
            {{ reaction.emoji }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { api } from '../../api/client'
import { useAuth } from '../../stores/auth'
import type { Appreciation, ReactionType } from '../../domain/Appreciation'

interface Props {
  writingId: string
  initialCount?: number
  isAppreciated?: boolean
  appreciators?: Appreciation[] // List of appreciations with user info
}

const props = defineProps<Props>()

const { user } = useAuth()
const loading = ref(false)
const appreciators = ref<Appreciation[]>(props.appreciators || [])
const showPicker = ref(false)
const pickerType = ref<ReactionType | null>(null)
const userReaction = ref<ReactionType | null>(null)

// Handle click outside to close picker
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  // Check if click is inside any reaction picker (using class selector)
  const isClickInsidePicker = target.closest('.reaction-picker') !== null
  
  if (!isClickInsidePicker) {
    showPicker.value = false
    pickerType.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const emit = defineEmits<{
  appreciated: []
  unappreciated: []
}>()

// Available reactions
const reactions = [
  { type: 'like' as ReactionType, emoji: '👍', label: 'Like' },
  { type: 'love' as ReactionType, emoji: '❤️', label: 'Love' },
  { type: 'laugh' as ReactionType, emoji: '😂', label: 'Laugh' },
  { type: 'wow' as ReactionType, emoji: '😮', label: 'Wow' },
  { type: 'sad' as ReactionType, emoji: '😢', label: 'Sad' },
  { type: 'angry' as ReactionType, emoji: '😠', label: 'Angry' }
]

// Get emoji for reaction type
const getReactionEmoji = (type: ReactionType | null): string => {
  if (!type) return '👍'
  const reaction = reactions.find(r => r.type === type)
  return reaction?.emoji || '👍'
}

// Get color class for reaction avatar
const getReactionColor = (type: ReactionType): string => {
  const colors: Record<ReactionType, string> = {
    like: 'bg-blue-500',
    love: 'bg-red-500',
    laugh: 'bg-yellow-500',
    wow: 'bg-purple-500',
    sad: 'bg-indigo-500',
    angry: 'bg-orange-500'
  }
  return colors[type] || 'bg-gray-500'
}

// Group appreciations by reaction type
const reactionGroups = computed(() => {
  const groups: Record<ReactionType, Appreciation[]> = {
    like: [],
    love: [],
    laugh: [],
    wow: [],
    sad: [],
    angry: []
  }

  appreciators.value.forEach(app => {
    const type = app.reactionType || 'like'
    if (groups[type]) {
      groups[type].push(app)
    } else {
      // Fallback to like if type is invalid
      groups.like.push(app)
    }
  })

  return Object.entries(groups)
    .filter(([_, users]) => users.length > 0)
    .map(([type, users]) => ({
      type: type as ReactionType,
      count: users.length,
      users
    }))
    .sort((a, b) => b.count - a.count) // Sort by count descending
})

// Total count of all reactions
const totalCount = computed(() => {
  return appreciators.value.length
})

// Get initials from display name or email
const getInitials = (name: string): string => {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const showPickerForType = (type: ReactionType) => {
  if (pickerType.value === type && showPicker.value) {
    // Close if clicking the same button
    showPicker.value = false
    pickerType.value = null
  } else {
    // Open picker for this reaction type
    showPicker.value = true
    pickerType.value = type
  }
}

const handleReactionClick = async (reactionType: ReactionType) => {
  if (loading.value) return

  // Check if user already has this exact reaction
  const isCurrentReaction = userReaction.value === reactionType

  try {
    loading.value = true
    showPicker.value = false
    pickerType.value = null
    
    if (isCurrentReaction) {
      // Remove reaction
      await api.delete(`/appreciations/writing/${props.writingId}?reactionType=${reactionType}`)
      userReaction.value = null
      emit('unappreciated')
    } else {
      // Add or change reaction
      try {
        await api.post(`/appreciations/writing/${props.writingId}`, { reactionType })
        userReaction.value = reactionType
        emit('appreciated')
      } catch (err: any) {
        // If error says "already exists", it means backend returned existing reaction (idempotent)
        // Refresh appreciations to get updated state
        if (err.message && err.message.includes('already exists')) {
          emit('appreciated') // Trigger refresh
        } else {
          throw err // Re-throw other errors
        }
      }
    }
  } catch (err) {
    console.error('Failed to toggle reaction:', err)
    // Show user-friendly error
    alert(err instanceof Error ? err.message : 'Failed to update reaction')
  } finally {
    loading.value = false
  }
}

// Watch for prop changes to update local state
watch(() => props.appreciators, (newVal) => {
  if (newVal) {
    appreciators.value = newVal
    
    // Update user's current reaction
    if (user.value) {
      const userAppreciation = newVal.find(a => a.userId === user.value!.id)
      userReaction.value = userAppreciation?.reactionType || null
    } else {
      userReaction.value = null
    }
  } else {
    appreciators.value = []
    userReaction.value = null
  }
}, { immediate: true })

// Watch for user changes
watch(() => user.value, (newUser) => {
  if (newUser && appreciators.value.length > 0) {
    const userAppreciation = appreciators.value.find(a => a.userId === newUser.id)
    userReaction.value = userAppreciation?.reactionType || null
  } else {
    userReaction.value = null
  }
}, { immediate: true })
</script>

<style scoped>
.reactions-container {
  @apply flex items-center gap-3 flex-wrap;
}
</style>
