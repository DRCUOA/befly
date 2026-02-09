import { ref } from 'vue'
import { api } from '../api/client'
import type { ApiResponse } from '@shared/ApiResponses'

interface ConfigResponse {
  appName: string
}

const appName = ref<string>('Rambulations') // Default fallback
let configLoaded = false

/**
 * Load app configuration from server
 */
export async function loadAppConfig(): Promise<void> {
  if (configLoaded) return
  
  try {
    const response = await api.get<ApiResponse<ConfigResponse>>('/config')
    appName.value = response.data.appName
    configLoaded = true
  } catch {
    // Keep default value
  }
}

/**
 * Application configuration
 */
export const appConfig = {
  get appName(): string {
    return appName.value
  }
}
