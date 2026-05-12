export type WritingBlockRevisionKind = 'create' | 'edit' | 'restore'

export interface WritingBlockRevision {
  id: string
  writingBlockId: string
  versionNumber: number
  editedBy: string | null
  editedAt: string

  title: string
  body: string
  visibility: 'private' | 'shared' | 'public'
  coverImageUrl?: string | null
  coverImagePosition?: string | null

  revisionKind: WritingBlockRevisionKind
  restoredFromVersion?: number | null
  note?: string | null

  editorDisplayName?: string | null
}

export interface WritingBlockRevisionSummary {
  id: string
  writingBlockId: string
  versionNumber: number
  editedBy: string | null
  editedAt: string
  revisionKind: WritingBlockRevisionKind
  restoredFromVersion?: number | null
  note?: string | null
  editorDisplayName?: string | null
}
