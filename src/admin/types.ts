export type FileKind = "image" | "video" | "audio" | "document"
export type FileFilter = "all" | "favorites" | "white" | "block" | "adult"
export type FileSort = "newest" | "name" | "size"
export type FileView = "table" | "grid"
export type ListType = "Block" | "White"

export interface FileMetadata {
  Label?: string
  ListType?: ListType
  TimeStamp?: number
  fileName: string
  fileSize: number
  liked: boolean
  shortId?: string
  [key: string]: unknown
}

export interface ManagedFile {
  metadata: FileMetadata
  name: string
}

export interface ListResponse {
  cursor?: string
  keys?: Array<{ metadata?: unknown; name: string }>
  list_complete?: boolean
}

export interface ConfirmOperation {
  files: ManagedFile[]
  type: "delete" | "block" | "white"
}
