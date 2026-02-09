export interface User {
  id: string
  email: string
  displayName: string
  role: 'user' | 'admin'
  status: 'active' | 'inactive' | 'suspended'
  createdAt: string
  updatedAt: string
  /** Optional: used for admin map pins */
  latitude?: number
  longitude?: number
}

export interface UserWithPassword extends User {
  passwordHash: string
}
