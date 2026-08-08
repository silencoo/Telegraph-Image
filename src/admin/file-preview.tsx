import { FileAudio, FileText } from "lucide-react"

import { getFileHref, getFileKind } from "@/admin/file-utils"
import type { ManagedFile } from "@/admin/types"
import { cn } from "@/lib/utils"

interface FilePreviewProps {
  className?: string
  file: ManagedFile
}

export function FilePreview({ className, file }: FilePreviewProps) {
  const kind = getFileKind(file.name)
  const source = getFileHref(file)
  const commonClass = cn("size-full object-cover", className)

  if (kind === "image") {
    return (
      <img
        src={source}
        alt=""
        className={commonClass}
        loading="lazy"
        decoding="async"
      />
    )
  }

  if (kind === "video") {
    return (
      <video className={commonClass} preload="metadata" muted playsInline>
        <source src={source} />
      </video>
    )
  }

  const Icon = kind === "audio" ? FileAudio : FileText

  return (
    <div className={cn("flex size-full items-center justify-center bg-muted text-muted-foreground", className)}>
      <Icon className="size-8" aria-hidden="true" />
    </div>
  )
}
