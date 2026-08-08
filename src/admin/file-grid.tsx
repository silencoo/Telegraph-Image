import type { AdminCopy } from "@/admin/copy"
import { FileActions, type FileActionProps } from "@/admin/file-actions"
import { FilePreview } from "@/admin/file-preview"
import { FileStatus } from "@/admin/file-status"
import { formatFileSize, formatTimestamp, getFileKind } from "@/admin/file-utils"
import type { ManagedFile } from "@/admin/types"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface FileGridProps extends Omit<FileActionProps, "file"> {
  files: ManagedFile[]
  forceVisible?: boolean
  locale: string
  onSelect: (file: ManagedFile, selected: boolean) => void
  onPreview: (file: ManagedFile) => void
  selected: Set<string>
}

export function FileGrid({
  copy,
  files,
  forceVisible,
  locale,
  onConfirm,
  onCopy,
  onPreview,
  onRename,
  onSelect,
  onToggleFavorite,
  selected,
}: FileGridProps) {
  return (
    <div className={cn(
      "grid grid-cols-1 gap-4 sm:grid-cols-2",
      forceVisible ? "lg:grid-cols-3 xl:grid-cols-4" : "md:hidden",
    )}>
      {files.map((file) => {
        const checked = selected.has(file.name)
        const kind = getFileKind(file.name)
        return (
          <article
            key={file.name}
            className={cn(
              "group overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs transition-[border-color,box-shadow]",
              checked && "border-primary ring-2 ring-primary/15",
            )}
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
              <button
                type="button"
                onClick={() => onPreview(file)}
                className="block size-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                aria-label={`${copy.preview}: ${file.metadata.fileName}`}
              >
                <FilePreview file={file} className="transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none" />
              </button>
              <div className="absolute left-3 top-3 rounded-md bg-background/90 p-2 shadow-sm backdrop-blur-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => onSelect(file, value === true)}
                  aria-label={copy.selectFile(file.metadata.fileName)}
                />
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium" title={file.metadata.fileName}>{file.metadata.fileName}</h3>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={file.name}>{file.name}</p>
                </div>
                <FileActions
                  copy={copy}
                  file={file}
                  onConfirm={onConfirm}
                  onCopy={onCopy}
                  onRename={onRename}
                  onToggleFavorite={onToggleFavorite}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{copy[kind]}</span>
                <span aria-hidden="true">·</span>
                <span>{formatFileSize(file.metadata.fileSize, locale)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatTimestamp(file.metadata.TimeStamp, locale)}</span>
              </div>
              <FileStatus copy={copy} file={file} />
            </div>
          </article>
        )
      })}
    </div>
  )
}
