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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>)
  }

  // Add CSRF token for POST/PUT/DELETE/PATCH
  // If token is missing, we'll let the server return an error (it will set the cookie)
  if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
    headers['X-CSRF-Token'] = csrfToken
  } else if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
    // CSRF token missing for state-changing operations; server may reject
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

  // Handle empty responses (204 No Content, etc.)
  if (response.status === 204 || response.status === 205) {
    return {} as T
  }

  // Check if response has content
  const contentType = response.headers.get('content-type')
  const contentLength = response.headers.get('content-length')
  
  // If no content type or content length is 0, return empty object
  if (!contentType || contentLength === '0') {
    return {} as T
  }

  // Only parse JSON if content-type indicates JSON
  if (contentType.includes('application/json')) {
    try {
      const text = await response.text()
      return text ? JSON.parse(text) : ({} as T)
    } catch (err) {
      // If parsing fails, return empty object
      return {} as T
    }
  }

  // For non-JSON responses, return empty object
  return {} as T
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
