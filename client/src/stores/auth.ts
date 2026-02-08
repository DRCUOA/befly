import { ref, computed } from 'vue'
import { api } from '../api/client'
import type { User } from '../domain/User'
import type { ApiResponse } from '@shared/ApiResponses'

/**
 * Auth store - manages authentication state
 * No sensitive data in localStorage per requirements
 */
const currentUser = ref<User | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

export function useAuth() {
  /**
   * Check if user is authenticated
   */
  const isAuthenticated = computed(() => currentUser.value !== null)

  /**
   * Check if user has admin role
   */
  const isAdmin = computed(() => currentUser.value?.role === 'admin')

  /**
   * Get current user
   */
  const user = computed(() => currentUser.value)

  /**
   * Sign up new user
   */
  const signup = async (email: string, password: string, displayName: string) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/signup', {
        email,
        password,
        displayName
      })

      currentUser.value = response.data.user
      // Token is stored in httpOnly cookie automatically
      
      return response.data.user
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Signup failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sign in existing user
   */
  const signin = async (email: string, password: string) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', {
        email,
        password
      })

      currentUser.value = response.data.user
      // Token is stored in httpOnly cookie automatically
      
      return response.data.user
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sign out current user
   */
  const signout = async () => {
    try {
      isLoading.value = true
      error.value = null

      await api.post('/auth/logout')
      currentUser.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Logout failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get current user from server
   * Call this on app initialization to restore session
   */
  const fetchCurrentUser = async () => {
    try {
      isLoading.value = true
      error.value = null

      const response = await api.get<ApiResponse<User>>('/auth/me')
      currentUser.value = response.data
      
      return response.data
    } catch (err: any) {
      // Not authenticated - clear user (401 is expected when not logged in)
      // Only log non-401 errors
      if (err.message && !err.message.includes('401') && !err.message.includes('Unauthorized')) {
        console.error('Error fetching current user:', err)
      }
      currentUser.value = null
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Clear error
   */
  const clearError = () => {
    error.value = null
  }

  return {
    // State
    user,
    isAuthenticated,
    isAdmin,
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    
    // Actions
    signup,
    signin,
    signout,
    fetchCurrentUser,
    clearError
  }
}
