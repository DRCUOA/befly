export type WritingBlockEditorPermission = 'edit' | 'manage'

export interface WritingBlockEditor {
  id: string
  writingBlockId: string
  userId: string
  grantedBy: string
  permission: WritingBlockEditorPermission
  createdAt: string
  updatedAt: string

  userDisplayName?: string
  userEmail?: string
  grantedByDisplayName?: string
}
