import { WritingBlock } from './WritingBlock'
import { Theme } from './Theme'
import { Appreciation } from './Appreciation'

export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
}

export type WritingBlockResponse = ApiResponse<WritingBlock>
export type WritingBlocksResponse = PaginatedResponse<WritingBlock>
export type ThemeResponse = ApiResponse<Theme>
export type ThemesResponse = ApiResponse<Theme[]>
export type AppreciationResponse = ApiResponse<Appreciation>
export type AppreciationsResponse = ApiResponse<Appreciation[]>
