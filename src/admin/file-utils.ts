import type { FileKind, ManagedFile } from "@/admin/types"

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp", "avif", "ico"])
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "avi", "mkv", "m4v"])
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"])

export function getExtension(name: string) {
  const part = name.split(".").pop()
  return part && part !== name ? part.toLowerCase() : ""
}

export function getFileKind(name: string): FileKind {
  const extension = getExtension(name)
  if (IMAGE_EXTENSIONS.has(extension)) return "image"
  if (VIDEO_EXTENSIONS.has(extension)) return "video"
  if (AUDIO_EXTENSIONS.has(extension)) return "audio"
  return "document"
}

export function normalizeFile(file: { metadata?: unknown; name: string }): ManagedFile {
  const source = file.metadata && typeof file.metadata === "object"
    ? file.metadata as Record<string, unknown>
    : {}

  return {
    name: file.name,
    metadata: {
      ...source,
      fileName: typeof source.fileName === "string" ? source.fileName : file.name,
      fileSize: typeof source.fileSize === "number" ? source.fileSize : 0,
      liked: Boolean(source.liked),
      shortId: typeof source.shortId === "string" ? source.shortId : undefined,
      TimeStamp: typeof source.TimeStamp === "number" ? source.TimeStamp : undefined,
      Label: typeof source.Label === "string" ? source.Label : undefined,
      ListType: source.ListType === "Block" || source.ListType === "White"
        ? source.ListType
        : undefined,
    },
  }
}

export function formatFileSize(bytes: number, locale: string) {
  if (!bytes) return "—"
  const units = ["B", "KB", "MB", "GB"]
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unit
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value)} ${units[unit]}`
}

export function formatTimestamp(value: number | undefined, locale: string) {
  if (!value) return "—"
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function getPublicUrl(file: ManagedFile) {
  return `${window.location.origin}/file/${encodeURIComponent(file.metadata.shortId || file.name)}`
}

export function getFileHref(file: ManagedFile) {
  return `/file/${encodeURIComponent(file.name)}`
}
