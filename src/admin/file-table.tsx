import type { AdminCopy } from "@/admin/copy"
import { FileActions, type FileActionProps } from "@/admin/file-actions"
import { FilePreview } from "@/admin/file-preview"
import { FileStatus } from "@/admin/file-status"
import { formatFileSize, formatTimestamp, getExtension, getFileHref, getFileKind } from "@/admin/file-utils"
import type { ManagedFile } from "@/admin/types"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface FileTableProps extends Omit<FileActionProps, "file"> {
  files: ManagedFile[]
  locale: string
  onSelect: (file: ManagedFile, selected: boolean) => void
  selected: Set<string>
}

export function FileTable({
  copy,
  files,
  locale,
  onConfirm,
  onCopy,
  onRename,
  onSelect,
  onToggleFavorite,
  selected,
}: FileTableProps) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"><span className="sr-only">{copy.selectAll}</span></TableHead>
            <TableHead className="w-20">{copy.preview}</TableHead>
            <TableHead className="min-w-56">{copy.fileName}</TableHead>
            <TableHead>{copy.kind}</TableHead>
            <TableHead>{copy.size}</TableHead>
            <TableHead>{copy.status}</TableHead>
            <TableHead className="min-w-40">{copy.uploadedAt}</TableHead>
            <TableHead className="w-14"><span className="sr-only">{copy.actions}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            const checked = selected.has(file.name)
            const kind = getFileKind(file.name)
            return (
              <TableRow key={file.name} data-state={checked ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => onSelect(file, value === true)}
                    aria-label={copy.selectFile(file.metadata.fileName)}
                  />
                </TableCell>
                <TableCell>
                  <a
                    href={getFileHref(file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block size-12 overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${copy.open}: ${file.metadata.fileName}`}
                  >
                    <FilePreview file={file} />
                  </a>
                </TableCell>
                <TableCell>
                  <div className="max-w-72">
                    <p className="truncate font-medium" title={file.metadata.fileName}>{file.metadata.fileName}</p>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={file.name}>{file.name}</p>
                  </div>
                </TableCell>
                <TableCell className="capitalize">{copy[kind]}{getExtension(file.name) ? ` · ${getExtension(file.name).toUpperCase()}` : ""}</TableCell>
                <TableCell className="tabular-nums">{formatFileSize(file.metadata.fileSize, locale)}</TableCell>
                <TableCell><FileStatus copy={copy} file={file} /></TableCell>
                <TableCell>{formatTimestamp(file.metadata.TimeStamp, locale)}</TableCell>
                <TableCell>
                  <FileActions
                    copy={copy}
                    file={file}
                    onConfirm={onConfirm}
                    onCopy={onCopy}
                    onRename={onRename}
                    onToggleFavorite={onToggleFavorite}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
