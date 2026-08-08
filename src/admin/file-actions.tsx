import {
  Ban,
  Copy,
  ExternalLink,
  Heart,
  HeartOff,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import type { AdminCopy } from "@/admin/copy"
import { getFileHref } from "@/admin/file-utils"
import type { ConfirmOperation, ManagedFile } from "@/admin/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface FileActionProps {
  copy: AdminCopy
  file: ManagedFile
  onConfirm: (operation: ConfirmOperation) => void
  onCopy: (file: ManagedFile) => void
  onRename: (file: ManagedFile) => void
  onToggleFavorite: (file: ManagedFile) => void
}

export function FileActions({
  copy,
  file,
  onConfirm,
  onCopy,
  onRename,
  onToggleFavorite,
}: FileActionProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${copy.actions}: ${file.metadata.fileName}`}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <a href={getFileHref(file)} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            {copy.open}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCopy(file)}>
          <Copy aria-hidden="true" />
          {copy.copyLink}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onRename(file)}>
          <Pencil aria-hidden="true" />
          {copy.rename}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onToggleFavorite(file)}>
          {file.metadata.liked ? <HeartOff aria-hidden="true" /> : <Heart aria-hidden="true" />}
          {file.metadata.liked ? copy.unfavorite : copy.favorite}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onConfirm({ files: [file], type: "white" })}>
          <ShieldCheck aria-hidden="true" />
          {copy.addWhite}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onConfirm({ files: [file], type: "block" })}>
          <Ban aria-hidden="true" />
          {copy.addBlock}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => onConfirm({ files: [file], type: "delete" })}
        >
          <Trash2 aria-hidden="true" />
          {copy.deleteRecord}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
