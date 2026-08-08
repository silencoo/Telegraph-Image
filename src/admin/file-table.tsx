import type { ReactNode } from "react"
import { ArrowUpDown } from "lucide-react"

import type { AdminCopy } from "@/admin/copy"
import { FileActions, type FileActionProps } from "@/admin/file-actions"
import { FilePreview } from "@/admin/file-preview"
import { FileStatus } from "@/admin/file-status"
import { formatFileSize, formatTimestamp, getExtension, getFileKind } from "@/admin/file-utils"
import type { FileSort, ManagedFile } from "@/admin/types"
import { Button } from "@/components/ui/button"
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
  onPreview: (file: ManagedFile) => void
  onSort: (sort: FileSort) => void
  selected: Set<string>
  sort: FileSort
}

export function FileTable({
  copy,
  files,
  locale,
  onConfirm,
  onCopy,
  onPreview,
  onRename,
  onSelect,
  onSort,
  onToggleFavorite,
  selected,
  sort,
}: FileTableProps) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"><span className="sr-only">{copy.selectAll}</span></TableHead>
            <TableHead className="w-20">{copy.preview}</TableHead>
            <TableHead className="min-w-56"><SortButton active={sort === "name"} onClick={() => onSort("name")}>{copy.fileName}</SortButton></TableHead>
            <TableHead>{copy.kind}</TableHead>
            <TableHead><SortButton active={sort === "size"} onClick={() => onSort("size")}>{copy.size}</SortButton></TableHead>
            <TableHead>{copy.status}</TableHead>
            <TableHead className="min-w-40"><SortButton active={sort === "newest"} onClick={() => onSort("newest")}>{copy.uploadedAt}</SortButton></TableHead>
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
                  <button
                    type="button"
                    onClick={() => onPreview(file)}
                    className="block size-12 overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${copy.preview}: ${file.metadata.fileName}`}
                  >
                    <FilePreview file={file} />
                  </button>
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

function SortButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
      <ArrowUpDown aria-hidden="true" className={active ? "text-foreground" : "text-muted-foreground"} />
    </Button>
  )
}
