export interface User {
  id: string
  email: string
  displayName: string
  role: 'user' | 'admin'
  status: 'active' | 'inactive' | 'suspended'
  /**
   * Admin-gated access to other users' shared-visibility content.
   * False by default for new signups; toggled by an admin via the
   * user-edit form. Does NOT affect ability to set one's own frags
   * to shared visibility (that's unrestricted).
   */
  sharedAccess: boolean
  createdAt: string
  updatedAt: string
  /** Optional: used for admin map pins */
  latitude?: number
  longitude?: number
}

export interface UserWithPassword extends User {
  passwordHash: string
}
