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
            class="inline-flex items-center px-2 py-1 rounded-md text-sm border border-line bg-paper hover:bg-gray-50 disabled:opacity-50"
            :class="{ 'bg-[#E5E5E5] border-[#717171]': userReaction === group.type }"
          >
            <span v-html="getReactionIcon(group.type)"></span>
            <span class="ml-1 text-xs text-[#717171]">{{ group.count }}</span>
          </button>

          <!-- Reaction picker dropdown for this type -->
          <div
            v-if="showPicker && pickerType === group.type"
            class="reaction-picker absolute top-full left-0 mt-1 bg-paper border border-line rounded-lg shadow-lg p-2 z-50"
            @click.stop
          >
            <div class="flex space-x-1">
              <button
                v-for="reaction in reactions"
                :key="reaction.type"
                @click="handleReactionClick(reaction.type)"
                class="p-2 rounded hover:bg-gray-100"
                :class="{ 'bg-[#E5E5E5]': userReaction === reaction.type }"
                :title="reaction.label"
              >
                <span v-html="getReactionIcon(reaction.type)"></span>
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
            class="relative inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-white text-[#717171] text-xs font-medium hover:z-10"
            :class="getReactionColor(group.type)"
            :style="{ zIndex: group.users.length - index }"
          >
            {{ getInitials(appreciator.userDisplayName || '?') }}
          </div>
          <div
            v-if="group.users.length > 3"
            class="relative inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-white bg-[#D3D3D3] text-[#717171] text-xs font-medium hover:z-10"
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
        class="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed border border-line bg-paper hover:bg-gray-50"
      >
        <span v-if="loading">...</span>
        <span v-else v-html="getReactionIcon('like')"></span>
        <span v-if="totalCount > 0" class="ml-1 text-xs text-[#717171]">{{ totalCount }}</span>
      </button>

      <!-- Reaction picker dropdown -->
      <div
        v-if="showPicker"
        class="reaction-picker absolute top-full left-0 mt-1 bg-paper border border-line rounded-lg shadow-lg p-2 z-50"
        @click.stop
      >
        <div class="flex space-x-1">
          <button
            v-for="reaction in reactions"
            :key="reaction.type"
            @click="handleReactionClick(reaction.type)"
            class="p-2 rounded hover:bg-gray-100"
            :class="{ 'bg-[#E5E5E5]': userReaction === reaction.type }"
            :title="reaction.label"
          >
            <span v-html="getReactionIcon(reaction.type)"></span>
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

// Available reactions with conservative icons
const reactions = [
  { type: 'like' as ReactionType, label: 'Like' },
  { type: 'love' as ReactionType, label: 'Love' },
  { type: 'laugh' as ReactionType, label: 'Laugh' },
  { type: 'wow' as ReactionType, label: 'Wow' },
  { type: 'sad' as ReactionType, label: 'Sad' },
  { type: 'angry' as ReactionType, label: 'Angry' }
]

// Get icon SVG markup for reaction type - conservative icons in dark silver (#717171)
const getReactionIcon = (type: ReactionType | null): string => {
  if (!type) type = 'like'
  
  const icons: Record<ReactionType, string> = {
    like: `<svg class="w-4 h-4" fill="none" stroke="#717171" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>`,
    love: `<svg class="w-4 h-4" fill="none" stroke="#717171" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>`,
    laugh: `<svg class="w-4 h-4" fill="none" stroke="#717171" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    wow: `<svg class="w-4 h-4" fill="none" stroke="#717171" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>`,
    sad: `<svg class="w-4 h-4" fill="none" stroke="#717171" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    angry: `<svg class="w-4 h-4" fill="none" stroke="#717171" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`
  }
  
  return icons[type] || icons.like
}

// Get color class for reaction avatar - pastel grey and dark silver
const getReactionColor = (_type: ReactionType): string => {
  // All reactions use the same conservative color scheme
  return 'bg-[#D3D3D3]' // Pastel grey
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
