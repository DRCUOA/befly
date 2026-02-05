/**
 * Plain fetch wrapper for API calls
 * No proprietary clients or SDKs
 * Handles authentication via httpOnly cookies
 */

const API_BASE = '/api'

export interface RequestOptions extends RequestInit {
  params?: Record<string, string>
}

// Get CSRF token from cookie (set by server)
function getCsrfToken(): string | null {
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === 'csrf-token') {
      return decodeURIComponent(value)
    }
  }
  return null
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options

  let url = `${API_BASE}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }

  // Get CSRF token for state-changing operations
  const csrfToken = getCsrfToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers
  }

  // Add CSRF token for POST/PUT/DELETE/PATCH
  if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
    headers['X-CSRF-Token'] = csrfToken
  }

  // Include credentials for cookies (httpOnly auth token)
  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include', // Important for httpOnly cookies
    headers
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' })
}
